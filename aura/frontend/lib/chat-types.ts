'use client';

export type AttachmentStatus = 'uploading' | 'ready' | 'error';

export interface AttachmentPreview {
  id: string;
  name: string;
  size: number;
  type: string;
  status: AttachmentStatus;
  error?: string;
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
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export type ComposerCommand = 'attach' | 'microphone' | 'read-last' | 'clear';
