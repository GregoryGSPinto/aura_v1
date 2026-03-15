'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_AURA_CHAT_MODE_ID, type AuraChatModeId } from '@/lib/chat-modes';
import type { ChatConversation, ComposerCommand, ConversationMessage } from '@/lib/chat-types';

type ChatStoreState = {
  conversations: ChatConversation[];
  activeConversationId: string;
  sidebarCollapsed: boolean;
  chatInfoCollapsed: boolean;
  chatInspectorCollapsed: boolean;
  voiceReplyEnabled: boolean;
  selectedModeId: AuraChatModeId;
  composerCommand: ComposerCommand | null;
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  appendMessage: (conversationId: string, message: ConversationMessage) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updater: Partial<ConversationMessage> | ((message: ConversationMessage) => ConversationMessage),
  ) => void;
  clearConversation: (conversationId: string) => void;
  togglePinnedMessage: (conversationId: string, messageId: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatInfoCollapsed: (collapsed: boolean) => void;
  setChatInspectorCollapsed: (collapsed: boolean) => void;
  setVoiceReplyEnabled: (enabled: boolean) => void;
  setSelectedMode: (modeId: AuraChatModeId) => void;
  requestComposerCommand: (command: ComposerCommand) => void;
  clearComposerCommand: () => void;
};

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: createId('conversation'),
    title: 'Novo chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function deriveTitle(messages: ConversationMessage[], fallback: string) {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return fallback;
  return firstUserMessage.content.trim().slice(0, 52) || fallback;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set) => {
      const initialConversation = createConversation();
      return {
        conversations: [initialConversation],
        activeConversationId: initialConversation.id,
        sidebarCollapsed: false,
        chatInfoCollapsed: false,
        chatInspectorCollapsed: false,
        voiceReplyEnabled: false,
        selectedModeId: DEFAULT_AURA_CHAT_MODE_ID,
        composerCommand: null,
        createConversation: () => {
          const conversation = createConversation();
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id,
          }));
          return conversation.id;
        },
        setActiveConversation: (id) => set({ activeConversationId: id }),
        appendMessage: (conversationId, message) =>
          set((state) => ({
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              const messages = [...conversation.messages, message];
              return {
                ...conversation,
                messages,
                title: deriveTitle(messages, conversation.title),
                updatedAt: message.createdAt,
              };
            }),
          })),
        updateMessage: (conversationId, messageId, updater) =>
          set((state) => ({
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              const messages = conversation.messages.map((message) => {
                if (message.id !== messageId) return message;
                return typeof updater === 'function' ? updater(message) : { ...message, ...updater };
              });
              return {
                ...conversation,
                messages,
                updatedAt: new Date().toISOString(),
              };
            }),
          })),
        clearConversation: (conversationId) =>
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    title: 'Novo chat',
                    messages: [],
                    updatedAt: new Date().toISOString(),
                  }
                : conversation,
            ),
          })),
        togglePinnedMessage: (conversationId, messageId) =>
          set((state) => ({
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;
              return {
                ...conversation,
                messages: conversation.messages.map((message) =>
                  message.id === messageId ? { ...message, pinned: !message.pinned } : message,
                ),
              };
            }),
          })),
        setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
        setChatInfoCollapsed: (collapsed) => set({ chatInfoCollapsed: collapsed }),
        setChatInspectorCollapsed: (collapsed) => set({ chatInspectorCollapsed: collapsed }),
        setVoiceReplyEnabled: (enabled) => set({ voiceReplyEnabled: enabled }),
        setSelectedMode: (selectedModeId) => set({ selectedModeId }),
        requestComposerCommand: (command) => set({ composerCommand: command }),
        clearComposerCommand: () => set({ composerCommand: null }),
      };
    },
    {
      name: 'aura-chat-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId || state.conversations[0]?.id || '',
        sidebarCollapsed: state.sidebarCollapsed,
        chatInfoCollapsed: state.chatInfoCollapsed,
        chatInspectorCollapsed: state.chatInspectorCollapsed,
        voiceReplyEnabled: state.voiceReplyEnabled,
        selectedModeId: state.selectedModeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.conversations.length) {
          const fallbackConversation = createConversation();
          state.conversations = [fallbackConversation];
          state.activeConversationId = fallbackConversation.id;
          return;
        }
        if (!state.activeConversationId) {
          state.activeConversationId = state.conversations[0].id;
        }
      },
    },
  ),
);
