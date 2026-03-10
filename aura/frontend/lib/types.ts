export interface StatusPayload {
  status: string;
  version: string;
  uptime_seconds: number;
  timestamp: string;
  services: {
    api: string;
    llm: string;
    filesystem: string;
  };
  model: string;
  persistence: {
    mode: string;
  };
  auth_mode: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  framework: string | null;
  status: 'active' | 'archived';
  last_modified: string;
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
  tokens_used: number;
  processing_time_ms: number;
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
  result: Record<string, unknown>;
  execution_time_ms: number;
  log_id: string;
}

export interface Activity {
  id: string;
  type: 'chat' | 'command' | 'agent' | 'project';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'info';
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}
