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
