'use client';

export type AttachmentStatus = 'uploading' | 'ready' | 'error';

export interface AttachmentPreview {
  id: string;
  name: string;
  size: number;
  type: string;
  status: AttachmentStatus;
  error?: string;
  /** Server-side file path after upload */
  serverPath?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  meta?: string;
  attachments?: AttachmentPreview[];
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  pinned?: boolean;
  model?: string;
  provider?: string;
  inputSource?: 'text' | 'voice';
  modeLabel?: string;
  route?: 'chat' | 'agent' | 'agent_fallback';
  brain?: 'local' | 'cloud';
  reactions?: string[];
  toolCalls?: {
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
  }[];
  /** URL de áudio sintetizado (edge-tts) para reprodução inline */
  audioUrl?: string;
  /** Sprint 5: Inline mission reference */
  mission?: {
    id: string;
    objective: string;
    status: string;
  };
  /** Self-modification plan (auto-mod protocol) */
  selfModPlan?: {
    id: string;
    request: string;
    risk_level: string;
    requires_restart: boolean;
    requires_rebuild: boolean;
    files_affected: string[];
    steps: string[];
  };
  /** Approvals needed (used with selfModPlan) */
  needs_approval?: {
    approval_id: string;
    description: string;
    tool: string;
    risk_level: string;
    files_affected: string[];
  }[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export type ComposerCommand = 'attach' | 'microphone' | 'read-last' | 'clear';
