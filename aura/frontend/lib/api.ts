import { clientEnv } from './env';
import type { 
  StatusPayload, 
  Project, 
  ChatResponse, 
  CommandResult,
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
  VoiceStatusPayload
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
  error: { code: string; message: string } | null;
  timestamp: string;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = normalizeUrl(endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (clientEnv.auraToken) {
    headers['Authorization'] = `Bearer ${clientEnv.auraToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: 'Unknown error' },
    }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
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

// Chat
export async function sendChat(
  message: string,
  history: { role: string; content: string }[] = [],
  sessionId = 'default-session'
): Promise<ApiResponse<ChatResponse>> {
  return fetchApi('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      context: { history, session_id: sessionId },
      options: { stream: false, temperature: 0.7 },
    }),
  });
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
