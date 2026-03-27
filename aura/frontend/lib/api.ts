import { clientEnv } from './env';
import { useAuthStore } from './auth-store';
import type {
  StatusPayload,
  Project,
  ChatResponse,
  ClaudeMission,
  CommandResult,
  LongMemory,
  MemoryPreference,
  MemoryProject,
  CompanionMemorySnapshot,
  CompanionOverview,
  CompanionTrustSnapshot,
  AuthStatusPayload,
  Agent,
  AgentJobDetail,
  AgentJobSummary,
  AgentTask,
  SystemMetrics,
  Activity,
  ProcessInfo,
  Routine,
  RoutineExecution,
  RoutineListResponse,
  RoutineExecutionListResponse,
  RoutineCreateRequest,
  RoutineUpdateRequest,
  VoiceProcessPayload,
  VoiceStatusPayload,
  ProvidersPayload,
  ProviderOverrideResponse,
  ProviderName,
  EngineStatusPayload,
} from './types';

const API_URL = clientEnv.apiUrl || 'http://localhost:8000';

function normalizeUrl(endpoint: string) {
  const base = API_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (base.endsWith('/api/v1') && path.startsWith('/api/v1')) {
    return `${base}${path.slice('/api/v1'.length)}`;
  }

  return `${base}${path}`;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  timestamp: string;
}

type HealthServiceStatus = {
  name: string;
  status: string;
  latency_ms: number | null;
  last_check: string;
  last_error: string | null;
  action: string | null;
  extra: Record<string, unknown>;
};

type HealthStatusResponse = {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'loading' | 'unreachable' | string;
  services: Record<string, HealthServiceStatus>;
  uptime_seconds: number;
  timestamp: string | null;
};

type DoctorResponse = {
  status: string;
  error?: string;
  details?: Record<string, unknown>;
};

type OperationLogEntry = {
  [key: string]: unknown;
};

type RecentLogsResponse = {
  count: number;
  limit: number;
  logs: OperationLogEntry[];
};

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = normalizeUrl(endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...((options?.headers as Record<string, string>) || {}),
  };

  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiClientError(
      'Não foi possível conectar ao backend da Aura. Verifique se o backend está rodando em http://localhost:8000.',
      0,
      'backend_unreachable',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (response.status === 401) {
    const { isAuthenticated, logout } = useAuthStore.getState();
    if (isAuthenticated) {
      logout();
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(async () => ({
      error: { message: (await response.text().catch(() => 'Unknown error')).trim() || 'Unknown error' },
    }));
    throw new ApiClientError(
      payload.error?.message || `HTTP ${response.status}`,
      response.status,
      payload.error?.code || 'api_error',
      payload.error?.details,
    );
  }

  return response.json();
}

// Status
export async function fetchStatus(): Promise<ApiResponse<StatusPayload>> {
  return fetchApi('/api/v1/status');
}

// Projects
export async function fetchProjects(): Promise<ApiResponse<{ projects: Project[]; total: number }>> {
  return fetchApi('/api/v1/projects');
}

export async function openProject(name: string): Promise<ApiResponse<{ message: string; opened_in: string }>> {
  return fetchApi('/api/v1/projects/open', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function discoverProjects(): Promise<ApiResponse<{ projects: Project[] }>> {
  return fetchApi('/api/v1/projects/discover');
}

export async function getActiveProject(): Promise<ApiResponse<{ project: Project | null }>> {
  return fetchApi('/api/v1/projects/active');
}

export async function setActiveProject(projectName: string): Promise<ApiResponse<{ project: Project }>> {
  return fetchApi('/api/v1/projects/active', {
    method: 'POST',
    body: JSON.stringify({ project: projectName }),
  });
}

// Chat
export async function sendChat(
  message: string,
  history: { role: string; content: string }[] = [],
  sessionId = 'default-session',
  metadata?: {
    modeId?: string;
    modeLabel?: string;
    capability?: string;
    temperature?: number;
    think?: boolean;
    shouldReplyWithVoice?: boolean;
  }
): Promise<ApiResponse<ChatResponse>> {
  return fetchApi('/api/v1/chat', {
    method: 'POST',
    headers: {
      ...(metadata?.modeId ? { 'X-Aura-Mode': metadata.modeId } : {}),
      ...(metadata?.modeLabel ? { 'X-Aura-Model-Label': metadata.modeLabel } : {}),
      ...(metadata?.capability ? { 'X-Aura-Capability': metadata.capability } : {}),
      ...(metadata?.shouldReplyWithVoice ? { 'X-Aura-Voice-Reply': 'true' } : {}),
    },
    body: JSON.stringify({
      message,
      context: { history, session_id: sessionId },
      options: { stream: false, temperature: metadata?.temperature ?? 0.7, think: metadata?.think ?? false },
    }),
  });
}

// Streaming Chat (SSE)
export async function chatStream(
  message: string,
  context: { history: { role: string; content: string }[]; session_id: string },
  onToken: (token: string) => void,
  onIntent: (intent: string) => void,
  onToolCall: (toolCall: unknown) => void,
  onToolResult: (result: unknown) => void,
  onDone: (data: { full_response: string; elapsed_ms: number; provider: string }) => void,
  onError: (error: string) => void,
): Promise<void> {
  const url = normalizeUrl('/api/v1/chat/stream');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  const streamToken = useAuthStore.getState().token || clientEnv.auraToken;
  if (streamToken) headers['Authorization'] = `Bearer ${streamToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, context }),
  });

  if (!response.ok) {
    onError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) { onError('No reader available'); return; }

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (data.type) {
            case 'token': onToken(data.content); break;
            case 'intent': onIntent(data.content); break;
            case 'tool_call': onToolCall(data.content); break;
            case 'tool_result': onToolResult(data.content); break;
            case 'done': onDone(data.content); break;
            case 'error': onError(data.content.message); break;
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

export async function fetchVoiceStatus(): Promise<ApiResponse<VoiceStatusPayload>> {
  return fetchApi('/api/v1/os/voice/status');
}

export async function processVoice(transcriptHint: string, speakResponse = false): Promise<ApiResponse<VoiceProcessPayload>> {
  return fetchApi('/api/v1/os/voice/process', {
    method: 'POST',
    body: JSON.stringify({
      transcript_hint: transcriptHint,
      speak_response: speakResponse,
    }),
  });
}

export async function fetchCompanionOverview(): Promise<ApiResponse<CompanionOverview>> {
  return fetchApi('/api/v1/companion/overview');
}

export async function fetchCompanionMemory(): Promise<ApiResponse<CompanionMemorySnapshot>> {
  return fetchApi('/api/v1/companion/memory');
}

export async function fetchCompanionTrust(): Promise<ApiResponse<CompanionTrustSnapshot>> {
  return fetchApi('/api/v1/companion/trust');
}

// Commands
export async function executeCommand(
  command: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<CommandResult>> {
  return fetchApi('/api/v1/command', {
    method: 'POST',
    body: JSON.stringify({
      command,
      params: params || {},
      options: { confirm: false, async: false },
    }),
  });
}

// Agents (Swarm)
export async function createAgentJob(goal: string, title?: string, autoStart = false) {
  return fetchApi<{ job_id: string; plan_status: "planned" | "blocked"; started: boolean; notes: string[] }>('/api/v1/agent/jobs', {
    method: 'POST',
    body: JSON.stringify({ goal, title, auto_start: autoStart }),
  });
}

export async function fetchAgentJobs() {
  return fetchApi<{ jobs: AgentJobSummary[]; total: number }>('/api/v1/agent/jobs');
}

export async function fetchAgentJob(jobId: string) {
  return fetchApi<AgentJobDetail>(`/api/v1/agent/jobs/${jobId}`);
}

export async function startAgentJob(jobId: string) {
  return fetchApi<AgentJobDetail>(`/api/v1/agent/jobs/${jobId}/start`, { method: 'POST' });
}

export async function cancelAgentJob(jobId: string) {
  return fetchApi<AgentJobDetail>(`/api/v1/agent/jobs/${jobId}/cancel`, { method: 'POST' });
}

export async function fetchAgents(): Promise<ApiResponse<Agent[]>> {
  return fetchApi('/api/v1/agents');
}

export async function fetchAgentTasks(agentId?: string): Promise<ApiResponse<AgentTask[]>> {
  const query = agentId ? `?agent_id=${agentId}` : '';
  return fetchApi(`/api/v1/agents/tasks${query}`);
}

export async function startAgent(agentId: string): Promise<ApiResponse<Agent>> {
  return fetchApi(`/api/v1/agents/${agentId}/start`, { method: 'POST' });
}

export async function stopAgent(agentId: string): Promise<ApiResponse<Agent>> {
  return fetchApi(`/api/v1/agents/${agentId}/stop`, { method: 'POST' });
}

export async function createTask(
  agentId: string,
  task: { type: string; description: string; params?: Record<string, unknown> }
): Promise<ApiResponse<AgentTask>> {
  return fetchApi(`/api/v1/agents/${agentId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

// Providers
export async function fetchProviders(): Promise<ApiResponse<ProvidersPayload>> {
  return fetchApi('/api/v1/system/providers');
}

export async function setProviderOverride(provider: ProviderName): Promise<ApiResponse<ProviderOverrideResponse>> {
  return fetchApi('/api/v1/system/provider/override', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}

// System
export async function fetchSystemMetrics(): Promise<ApiResponse<SystemMetrics>> {
  return fetchApi('/api/v1/system/metrics');
}

export async function fetchProcesses(): Promise<ApiResponse<ProcessInfo[]>> {
  return fetchApi('/api/v1/system/processes');
}

// Activities
export async function fetchActivities(limit = 10): Promise<ApiResponse<Activity[]>> {
  return fetchApi(`/api/v1/activities?limit=${limit}`);
}

export async function fetchAuthStatus(): Promise<ApiResponse<AuthStatusPayload>> {
  return fetchApi('/api/v1/auth/status');
}

// Remote Control
export async function executeTerminalCommand(command: string): Promise<ApiResponse<{ output: string; exit_code: number }>> {
  return fetchApi('/api/v1/remote/terminal', {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

export async function listApplications(): Promise<ApiResponse<{ name: string; status: 'running' | 'stopped' }[]>> {
  return fetchApi('/api/v1/remote/apps');
}

export async function controlApplication(
  name: string,
  action: 'open' | 'close' | 'focus'
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return fetchApi('/api/v1/remote/apps/control', {
    method: 'POST',
    body: JSON.stringify({ name, action }),
  });
}

export async function listFiles(path?: string): Promise<ApiResponse<{ name: string; type: 'file' | 'directory'; size?: number }[]>> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return fetchApi(`/api/v1/remote/files${query}`);
}

// Routines
export async function fetchRoutines(status?: string, triggerType?: string): Promise<ApiResponse<RoutineListResponse>> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (triggerType) params.append('trigger_type', triggerType);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/api/v1/routines${query}`);
}

export async function fetchRoutine(routineId: string): Promise<ApiResponse<Routine>> {
  return fetchApi(`/api/v1/routines/${routineId}`);
}

export async function createRoutine(routine: RoutineCreateRequest): Promise<ApiResponse<Routine>> {
  return fetchApi('/api/v1/routines', {
    method: 'POST',
    body: JSON.stringify(routine),
  });
}

export async function updateRoutine(routineId: string, updates: RoutineUpdateRequest): Promise<ApiResponse<Routine>> {
  return fetchApi(`/api/v1/routines/${routineId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteRoutine(routineId: string): Promise<ApiResponse<{ deleted: boolean; routine_id: string }>> {
  return fetchApi(`/api/v1/routines/${routineId}`, {
    method: 'DELETE',
  });
}

export async function triggerRoutine(routineId: string): Promise<ApiResponse<{ success: boolean; execution_id: string; message: string; started_at: string }>> {
  return fetchApi(`/api/v1/routines/${routineId}/trigger`, {
    method: 'POST',
  });
}

export async function toggleRoutine(routineId: string): Promise<ApiResponse<{ success: boolean; routine_id: string; new_status: 'active' | 'paused'; message: string }>> {
  return fetchApi(`/api/v1/routines/${routineId}/toggle`, {
    method: 'POST',
  });
}

export async function fetchRoutineHistory(routineId: string, limit?: number): Promise<ApiResponse<RoutineExecutionListResponse>> {
  const query = limit ? `?limit=${limit}` : '';
  return fetchApi(`/api/v1/routines/${routineId}/history${query}`);
}

export async function fetchRecentExecutions(limit?: number): Promise<ApiResponse<RoutineExecutionListResponse>> {
  const query = limit ? `?limit=${limit}` : '';
  return fetchApi(`/api/v1/routines/executions/recent${query}`);
}

export async function triggerAppOpenRoutines(): Promise<ApiResponse<{ triggered_routines: string[]; executions: RoutineExecution[]; message: string }>> {
  return fetchApi('/api/v1/routines/triggers/app-open');
}

export async function fetchExecution(executionId: string): Promise<ApiResponse<RoutineExecution>> {
  return fetchApi(`/api/v1/executions/${executionId}`);
}

// Health
export async function fetchHealthStatus(): Promise<ApiResponse<HealthStatusResponse>> {
  return fetchApi('/api/v1/health');
}

export async function fetchDoctor(): Promise<ApiResponse<DoctorResponse>> {
  return fetchApi('/api/v1/health/doctor', { method: 'POST' });
}

export async function fetchRecentLogs(limit = 20): Promise<ApiResponse<RecentLogsResponse>> {
  return fetchApi(`/api/v1/logs/recent?limit=${limit}`);
}

// Engine (Ollama lifecycle)
export async function fetchEngineStatus(): Promise<ApiResponse<EngineStatusPayload>> {
  return fetchApi('/api/v1/system/engine/status');
}

export async function startEngine(): Promise<ApiResponse<EngineStatusPayload>> {
  return fetchApi('/api/v1/system/engine/start', { method: 'POST' });
}

export async function stopEngine(): Promise<ApiResponse<EngineStatusPayload>> {
  return fetchApi('/api/v1/system/engine/stop', { method: 'POST' });
}

// Memory (Sprint 3)
export async function fetchMemoryPreferences(category?: string): Promise<ApiResponse<MemoryPreference[]>> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return fetchApi(`/api/v1/memory/preferences${query}`);
}

export async function updateMemoryPreference(key: string, category: string, value: string): Promise<ApiResponse<MemoryPreference>> {
  return fetchApi(`/api/v1/memory/preferences/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ category, value }),
  });
}

export async function deleteMemoryPreference(key: string): Promise<ApiResponse<{ key: string; deleted: boolean }>> {
  return fetchApi(`/api/v1/memory/preferences/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

export async function fetchMemoryProjects(status?: string): Promise<ApiResponse<MemoryProject[]>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchApi(`/api/v1/memory/projects${query}`);
}

export async function fetchMemoryProject(slug: string): Promise<ApiResponse<MemoryProject>> {
  return fetchApi(`/api/v1/memory/projects/${encodeURIComponent(slug)}`);
}

export async function updateMemoryProject(slug: string, data: Partial<MemoryProject>): Promise<ApiResponse<MemoryProject>> {
  return fetchApi(`/api/v1/memory/projects/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchLongMemories(params?: { category?: string; project?: string; limit?: number }): Promise<ApiResponse<LongMemory[]>> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.append('category', params.category);
  if (params?.project) searchParams.append('project', params.project);
  if (params?.limit) searchParams.append('limit', String(params.limit));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchApi(`/api/v1/memory/long${query}`);
}

export async function addLongMemory(data: { category: string; content: string; project_slug?: string }): Promise<ApiResponse<LongMemory>> {
  return fetchApi('/api/v1/memory/long', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteLongMemory(id: number): Promise<ApiResponse<{ id: number; deleted: boolean }>> {
  return fetchApi(`/api/v1/memory/long/${id}`, { method: 'DELETE' });
}

export async function fetchMemoryContext(query: string, project?: string): Promise<ApiResponse<unknown[]>> {
  const searchParams = new URLSearchParams({ query });
  if (project) searchParams.append('project', project);
  return fetchApi(`/api/v1/memory/context?${searchParams.toString()}`);
}

// Claude Missions (Sprint 5)
export async function createMission(data: {
  objective: string;
  project_slug: string;
  working_dir?: string;
  context?: string;
  preferences?: Record<string, string>;
}): Promise<ApiResponse<ClaudeMission>> {
  return fetchApi('/api/v1/claude/mission', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function executeMission(missionId: string): Promise<ApiResponse<ClaudeMission>> {
  return fetchApi(`/api/v1/claude/mission/${missionId}/execute`, { method: 'POST' });
}

export async function fetchMission(missionId: string): Promise<ApiResponse<ClaudeMission>> {
  return fetchApi(`/api/v1/claude/mission/${missionId}`);
}

export async function fetchMissions(params?: {
  project_slug?: string;
  status?: string;
  limit?: number;
}): Promise<ApiResponse<ClaudeMission[]>> {
  const searchParams = new URLSearchParams();
  if (params?.project_slug) searchParams.append('project_slug', params.project_slug);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.limit) searchParams.append('limit', String(params.limit));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchApi(`/api/v1/claude/missions${query}`);
}

export async function cancelMission(missionId: string): Promise<ApiResponse<{ mission_id: string; cancelled: boolean }>> {
  return fetchApi(`/api/v1/claude/mission/${missionId}/cancel`, { method: 'POST' });
}

export async function retryMission(missionId: string, extraContext = ''): Promise<ApiResponse<ClaudeMission>> {
  return fetchApi(`/api/v1/claude/mission/${missionId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ extra_context: extraContext }),
  });
}

// Safety / Audit (Sprint 11)
export async function fetchAuditLog(limit = 50): Promise<ApiResponse<unknown[]>> {
  return fetchApi(`/api/v1/safety/audit?limit=${limit}`);
}

// Briefing (Sprint 14)
export async function fetchDailyBriefing(): Promise<ApiResponse<Record<string, unknown>>> {
  return fetchApi('/api/v1/briefing/daily');
}

export async function fetchBriefingPriorities(): Promise<ApiResponse<unknown[]>> {
  return fetchApi('/api/v1/briefing/priorities');
}

export async function fetchQuickBriefing(): Promise<ApiResponse<unknown[]>> {
  return fetchApi('/api/v1/briefing/quick');
}

// Workspace (Sprint 8)
export async function fetchWorkspaceDashboard(slug: string): Promise<ApiResponse<Record<string, unknown>>> {
  return fetchApi(`/api/v1/workspace/projects/${slug}/dashboard`);
}

export async function fetchWorkspaceActivity(slug: string): Promise<ApiResponse<unknown[]>> {
  return fetchApi(`/api/v1/workspace/projects/${slug}/activity`);
}

export async function fetchWorkspaceCommits(slug: string, limit = 10): Promise<ApiResponse<unknown[]>> {
  return fetchApi(`/api/v1/workspace/projects/${slug}/commits?limit=${limit}`);
}

// Calendar (Sprint 9)
export async function fetchCalendarToday(): Promise<ApiResponse<unknown[]>> {
  return fetchApi('/api/v1/calendar/today');
}

export async function fetchCalendarWeek(): Promise<ApiResponse<unknown[]>> {
  return fetchApi('/api/v1/calendar/week');
}

// Email (Sprint 9)
export async function fetchEmailUnread(limit = 10): Promise<ApiResponse<unknown[]>> {
  return fetchApi(`/api/v1/email/unread?limit=${limit}`);
}

// Voice Premium (Sprint 12)
export async function fetchVoicePremiumStatus(): Promise<ApiResponse<Record<string, unknown>>> {
  return fetchApi('/api/v1/voice/premium/status');
}

// Mission V2 (Sprint 15)
export async function fetchMissionBlockers(missionId: string): Promise<ApiResponse<unknown[]>> {
  return fetchApi(`/api/v1/missions/${missionId}/blockers`);
}

export async function fetchMissionEvaluation(missionId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return fetchApi(`/api/v1/missions/${missionId}/evaluation`);
}

export async function fetchMissionSummary(missionId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return fetchApi(`/api/v1/missions/${missionId}/summary`);
}

// Proactive Greeting
export async function fetchGreeting(): Promise<{ greeting: string | null }> {
  const resp = await fetchApi<{ greeting: string | null }>('/api/v1/proactive/greeting');
  return resp.data;
}

// Agent Service (Mega Prompt)
export type AgentToolCall = {
  tool: string;
  params: Record<string, unknown>;
  result: {
    success: boolean;
    output: unknown;
    error: string | null;
    execution_time_ms: number;
    tool_name: string;
    autonomy_level: number;
    needs_approval: boolean;
    timestamp: string;
  };
};

export type AgentChatResponse = {
  response: string;
  tool_calls: AgentToolCall[];
  mode: string;
  needs_approval: { approval_id: string; description: string; tool: string }[];
  execution_time_ms: number;
  iterations: number;
};

export type AgentToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  autonomy_level: number;
  category: string;
};

export async function agentChat(
  message: string,
  mode: string = 'auto',
  conversationHistory?: { role: string; content: string }[],
): Promise<AgentChatResponse> {
  const url = normalizeUrl('/api/v1/agent/chat');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      mode,
      conversation_history: conversationHistory,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new ApiClientError(
      payload.error?.message || `HTTP ${response.status}`,
      response.status,
      payload.error?.code || 'api_error',
    );
  }

  return response.json();
}

export async function getApprovals(): Promise<{ pending: { id: string; tool_name: string; description: string; requested_at: string }[] }> {
  const url = normalizeUrl('/api/v1/agent/approvals');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers, cache: 'no-store' });
  return response.json();
}

export async function handleApproval(approvalId: string, approved: boolean): Promise<{ status: string; result?: unknown }> {
  const url = normalizeUrl('/api/v1/agent/approvals');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ approval_id: approvalId, approved }),
    cache: 'no-store',
  });
  return response.json();
}

export async function getToolsList(): Promise<{ tools: AgentToolSchema[] }> {
  const url = normalizeUrl('/api/v1/agent/tools');
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };
  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers, cache: 'no-store' });
  return response.json();
}

// Upload API
export async function uploadFile(file: File): Promise<{ path: string; original_name: string; size_bytes: number; content_type: string }> {
  const url = normalizeUrl('/api/v1/upload/');
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };
  const authToken = useAuthStore.getState().token;
  const token = authToken || clientEnv.auraToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, { method: 'POST', headers, body: formData });
  if (!response.ok) throw new Error(`Upload falhou: ${response.status}`);
  return response.json();
}
