export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  timestamp: string;
};

export type StatusPayload = {
  status: string;
  name: string;
  version: string;
  model: string;
  auth_mode: string;
  persistence: {
    mode: "local" | "supabase" | "fallback-local";
    supabase_enabled: boolean;
    supabase_configured: boolean;
    auth_mode: string;
    warnings: string[];
  };
  uptime_seconds: number;
  timestamp: string;
  services: {
    api: string;
    llm: string;
    filesystem: string;
    supabase: string;
  };
};

export type Project = {
  name: string;
  path: string;
  description?: string | null;
  commands: Record<string, string>;
};

export type ProjectsPayload = {
  projects: Project[];
  total: number;
};

export type ChatPayload = {
  response: string;
  intent: "conversa" | "consulta" | "acao";
  session_id: string;
  processing_time_ms: number;
  model: string;
  persistence_mode?: string | null;
  action_taken?: unknown;
  suggested_action?: {
    command: string;
    reason: string;
  } | null;
};
