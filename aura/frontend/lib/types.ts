export interface StatusPayload {
  status: string;
  name: string;
  version: string;
  uptime_seconds: number;
  timestamp: string;
  services: {
    api: string;
    llm: string;
    filesystem: string;
    supabase: string;
  };
  model: string;
  persistence: {
    mode: string;
  };
  auth_mode: string;
  ollama?: {
    status: string;
    url: string;
    model: string;
    model_available: boolean;
    models: string[];
    error?: string;
  };
  feature_flags?: Record<string, boolean>;
  startup_warnings?: string[];
  jobs?: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

export interface Project {
  id: string;
  name: string;
  path: string;
  type?: string;
  framework?: string | null;
  status?: 'active' | 'archived';
  last_modified?: string;
  description?: string;
  git?: {
    has_repo: boolean;
    branch: string | null;
    uncommitted_changes: number;
  };
  language?: string;
  size_mb?: number;
  has_package_json?: boolean;
  has_requirements_txt?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
  timestamp?: string;
}

export interface ChatResponse {
  response: string;
  intent: string;
  action_taken?: {
    command: string;
    params: Record<string, unknown>;
    status: string;
    result: Record<string, unknown>;
  } | null;
  session_id: string;
  processing_time_ms: number;
  model?: string;
  provider?: string;
  persistence_mode?: string;
  suggested_action?: {
    command: string;
    reason: string;
  } | null;
  action_preview?: ActionPreview | null;
  context_summary?: string | null;
  memory_signals?: MemorySignal[];
  trust_signals?: TrustSignal[];
  behavioral_mode?: string | null;
  tokens_used?: number;
  route?: 'chat' | 'agent' | 'agent_fallback';
  actions_taken?: unknown[];
  plan?: Record<string, unknown>;
  brain_used?: 'local' | 'cloud' | null;
  complexity?: number | null;
  classification_reason?: string | null;
  tool_calls?: ToolCallResult[] | null;
}

export interface ToolCallResult {
  tool: string;
  params: Record<string, unknown>;
  result: {
    tool: string;
    status: string;
    duration_ms: number | null;
    output: unknown;
    error: string | null;
    risk_level: string;
  };
}

export interface VoiceStatusPayload {
  stt_ready: boolean;
  tts_ready: boolean;
  wake_word: string;
  pipeline_ready: boolean;
  notes: string[];
}

export interface VoiceProcessPayload {
  activated: boolean;
  transcript?: string;
  goal?: string;
  reason?: string;
  result?: {
    goal: string;
    intent: string;
    reasoning: string;
    plan_status: string;
    planned_steps: number;
    job_id?: string | null;
    started: boolean;
    route?: Record<string, unknown> | null;
    memory_snapshot: Record<string, unknown>;
    notes: string[];
  };
  tts?: {
    success?: boolean;
    message?: string;
  } | null;
}

export interface MemorySignal {
  id: string;
  kind: 'session' | 'recent' | 'project' | 'personal' | 'operational' | 'long_term';
  title: string;
  content: string;
  confidence: number;
  source: string;
  updated_at: string;
  sensitive?: boolean;
}

export interface TrustSignal {
  id: string;
  label: string;
  detail: string;
  level: 'good' | 'attention' | 'warning';
  source: string;
}

export interface ActionPreview {
  command: string;
  category: string;
  risk_level: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  risk_score: number;
  requires_confirmation: boolean;
  preview: string;
  side_effects: string[];
  allowed: boolean;
}

export interface PrioritySignal {
  id: string;
  label: string;
  description: string;
  level: 'urgent' | 'important' | 'active' | 'watch' | 'informational';
  source: string;
}

export interface QuickAction {
  label: string;
  prompt: string;
  category: string;
}

export interface CompanionOverview {
  greeting: string;
  focus_summary: string;
  founder_mode: boolean;
  behavior_mode: string;
  presence_state: string;
  voice_state: string;
  priorities: PrioritySignal[];
  recent_projects: Project[];
  memory_signals: MemorySignal[];
  trust_signals: TrustSignal[];
  pending_actions: ActionPreview[];
  quick_actions: QuickAction[];
  telemetry: Record<string, unknown>;
}

export interface CompanionMemorySnapshot {
  profile: Record<string, unknown>;
  preferences: MemorySignal[];
  project_memory: MemorySignal[];
  operational_memory: MemorySignal[];
  recent_context: MemorySignal[];
}

export interface CompanionTrustSnapshot {
  signals: TrustSignal[];
  recent_activity: Record<string, unknown>[];
  voice: Record<string, unknown>;
  policy_state: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  type: 'builder' | 'reviewer' | 'deployer' | 'gitops' | 'custom';
  status: 'idle' | 'running' | 'error' | 'completed';
  description: string;
  tasks_completed: number;
  tasks_failed: number;
  last_activity: string;
  config: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: string;
  description: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: unknown;
  error?: string;
}

export interface AgentJobStep {
  id?: string;
  title: string;
  description: string;
  command?: string | null;
  params: Record<string, unknown>;
  order: number;
  status: "pending" | "planned" | "running" | "completed" | "failed" | "blocked" | "cancelled";
  started_at?: string | null;
  completed_at?: string | null;
  output?: string | null;
  error?: string | null;
}

export interface AgentJobSummary {
  id: string;
  title: string;
  goal: string;
  description: string;
  status: "pending" | "planned" | "queued" | "running" | "completed" | "failed" | "blocked" | "cancelled";
  progress: number;
  current_step: number;
  created_at: string;
  updated_at: string;
  result_summary?: string | null;
  error_summary?: string | null;
}

export interface AgentJobDetail extends AgentJobSummary {
  started_at?: string | null;
  completed_at?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  logs: {
    job_id: string;
    step_index: number;
    timestamp: string;
    level: string;
    message: string;
    metadata: Record<string, unknown>;
  }[];
  steps: AgentJobStep[];
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    upload: number;
    download: number;
  };
  processes: ProcessInfo[];
  timestamp: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export interface CommandResult {
  command: string;
  status: 'success' | 'error' | 'pending';
  message?: string;
  stdout?: string | null;
  stderr?: string | null;
  metadata?: Record<string, unknown>;
  result?: Record<string, unknown>;
  execution_time_ms: number;
  log_id: string;
}

export interface AuthStatusPayload {
  auth_required: boolean;
  authenticated: boolean;
  auth_mode: string;
  provider: string;
  user_id?: string | null;
}

export interface Activity {
  id: string;
  type: 'chat' | 'command' | 'agent' | 'project';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'info';
}

// Routines and Automation Types
export type RoutineTriggerType = 'scheduled' | 'app_open' | 'manual' | 'event_based';
export type RoutineStatus = 'active' | 'paused';
export type ExecutionStatus = 'success' | 'failed' | 'running';

export interface RoutineAction {
  id: string;
  type: string;
  params: Record<string, unknown>;
  order: number;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  trigger_type: RoutineTriggerType;
  schedule: string | null;
  actions: RoutineAction[];
  status: RoutineStatus;
  is_builtin: boolean;
  builtin_type: string | null;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface RoutineExecution {
  id: string;
  routine_id: string;
  routine_name: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at: string | null;
  results: Record<string, unknown>[];
  error_message: string | null;
  triggered_by: string;
  execution_time_ms: number | null;
}

export interface RoutineListResponse {
  routines: Routine[];
  total: number;
  active_count: number;
  paused_count: number;
}

export interface RoutineExecutionListResponse {
  executions: RoutineExecution[];
  total: number;
}

export interface RoutineCreateRequest {
  name: string;
  description: string;
  trigger_type: RoutineTriggerType;
  schedule?: string | null;
  actions: RoutineAction[];
}

export type ProviderName = 'auto' | 'ollama' | 'anthropic' | 'openai';

export interface ProviderInfo {
  status: 'online' | 'offline' | 'error';
  model: string | null;
  configured: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export interface ProvidersPayload {
  providers: Record<string, ProviderInfo>;
  override: string | null;
  mode: 'auto' | 'manual';
  active_provider: string;
}

export interface ProviderOverrideResponse {
  success: boolean;
  active_provider: string;
  mode: 'auto' | 'manual';
}

export interface EngineStatusPayload {
  status: 'running' | 'starting' | 'stopped' | 'stopping' | 'error';
  model: string;
  url: string;
  memory: {
    rss_mb?: number;
    vms_mb?: number;
  };
  message?: string;
}

// Memory (Sprint 3)
export interface MemoryPreference {
  id: number;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryProject {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  stack: string[] | null;
  status: string;
  repo_url: string | null;
  deploy_url: string | null;
  directory: string | null;
  links: Record<string, string> | null;
  last_commands: string[] | null;
  next_steps: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LongMemory {
  id: number;
  category: string;
  content: string;
  relevance_score: number;
  project_slug: string | null;
  created_at: string;
  expires_at: string | null;
}

// Claude Missions (Sprint 5)
export interface ClaudeMission {
  id: string;
  objective: string;
  project_slug: string;
  working_dir: string;
  status: 'queued' | 'running' | 'blocked' | 'needs_approval' | 'done' | 'failed' | 'cancelled';
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  output_parsed: {
    summary: string;
    files_mentioned: string[];
    errors_found: string[];
    next_steps: string[];
    code_blocks: string[];
    success: boolean;
  } | null;
  files_changed: string[] | null;
  diff_summary: string | null;
  error: string | null;
  retry_count: number;
  duration_s: number | null;
}

export interface RoutineUpdateRequest {
  name?: string;
  description?: string;
  trigger_type?: RoutineTriggerType;
  schedule?: string | null;
  actions?: RoutineAction[];
  status?: RoutineStatus;
}
