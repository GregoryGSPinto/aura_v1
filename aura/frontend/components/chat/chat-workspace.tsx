'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { ChatComposer } from '@/components/chat/composer';
import { ChatEmptyState } from '@/components/chat/chat-empty-state';
import { MessageList } from '@/components/chat/message-list';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { sendChat } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';
import type { AttachmentPreview, ConversationMessage } from '@/lib/chat-types';
import { notifyError, notifyInfo } from '@/lib/notifications';

type BrowserRecognitionResult = ArrayLike<{
  transcript: string;
}>;

type BrowserRecognitionEvent = Event & {
  results: ArrayLike<BrowserRecognitionResult>;
};

type BrowserSpeechRecognition = {
  start: () => void;
  stop: () => void;
  interimResults: boolean;
  lang: string;
  continuous: boolean;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function createMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function summarizeAttachments(attachments: AttachmentPreview[]) {
  if (!attachments.length) return '';
  return attachments.map((attachment) => `${attachment.name} (${Math.ceil(attachment.size / 1024)} KB)`).join(', ');
}

function createUserMessage(content: string, attachments: AttachmentPreview[]): ConversationMessage {
  return {
    id: createMessageId('message'),
    role: 'user',
    content,
    attachments,
    createdAt: new Date().toISOString(),
    status: 'complete',
  };
}

function createAssistantMessage(): ConversationMessage {
  return {
    id: createMessageId('message'),
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window.SpeechRecognition || window.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
}

export function ChatWorkspace() {
  const { refreshRuntime } = useAuraPreferences();
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const clearConversation = useChatStore((state) => state.clearConversation);
  const togglePinnedMessage = useChatStore((state) => state.togglePinnedMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const voiceReplyEnabled = useChatStore((state) => state.voiceReplyEnabled);
  const setVoiceReplyEnabled = useChatStore((state) => state.setVoiceReplyEnabled);
  const composerCommand = useChatStore((state) => state.composerCommand);
  const clearComposerCommand = useChatStore((state) => state.clearComposerCommand);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamTimerRef = useRef<number | null>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingMessageId, setActiveSpeakingMessageId] = useState<string | null>(null);
  const [composerState, setComposerState] = useState<'idle' | 'recording' | 'processing' | 'sending' | 'error' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);

  const messages = activeConversation?.messages ?? [];
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());

  useEffect(() => {
    if (!activeConversationId && conversations[0]) {
      setActiveConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, setActiveConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prompt = new URLSearchParams(window.location.search).get('prompt');
    if (!prompt || input || messages.length) return;
    setInput(prompt);
  }, [input, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const statusLabel = useMemo(() => {
    switch (composerState) {
      case 'recording':
        return 'Gravando com reconhecimento de fala no navegador.';
      case 'processing':
        return 'Processando contexto e anexos.';
      case 'sending':
        return 'Enviando para a Aura.';
      case 'speaking':
        return 'Respondendo em audio.';
      case 'error':
        return 'Falha operacional. Revise o backend ou tente novamente.';
      default:
        return attachments.length ? 'Anexos prontos para envio.' : 'Enter envia. Shift + Enter quebra linha.';
    }
  }, [attachments.length, composerState]);

  const runStreaming = (messageId: string, fullText: string, meta: string, model?: string) =>
    new Promise<void>((resolve) => {
      if (!activeConversation) {
        resolve();
        return;
      }

      let index = 0;
      const step = Math.max(4, Math.ceil(fullText.length / 56));

      streamTimerRef.current = window.setInterval(() => {
        index = Math.min(fullText.length, index + step);
        updateMessage(activeConversation.id, messageId, {
          content: fullText.slice(0, index),
          status: index >= fullText.length ? 'complete' : 'streaming',
          meta,
          model,
        });

        if (index >= fullText.length) {
          if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
          resolve();
        }
      }, 18);
    });

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSpeakingMessageId(null);
    setComposerState((current) => (current === 'speaking' ? 'idle' : current));
  }, []);

  const speakMessage = useCallback((message: ConversationMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !message.content.trim()) {
      notifyInfo('Audio indisponivel', 'A leitura em voz depende do speech synthesis do navegador.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setComposerState('speaking');
      setActiveSpeakingMessageId(message.id);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setComposerState('idle');
      setActiveSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setComposerState('error');
      setActiveSpeakingMessageId(null);
      notifyError('Falha no audio', 'Nao foi possivel reproduzir a resposta em audio.');
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleListening = useCallback(() => {
    const SpeechRecognitionApi = getRecognitionConstructor();
    if (!SpeechRecognitionApi) {
      notifyInfo('Microfone indisponivel', 'O navegador atual nao suporta reconhecimento de fala nativo.');
      return;
    }

    if (isListening && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
      setComposerState('idle');
      return;
    }

    const recognition = new SpeechRecognitionApi() as BrowserSpeechRecognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setInput((current) => (current ? `${current.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setIsListening(false);
      setComposerState('error');
      notifyError('Microfone indisponivel', 'Nao foi possivel converter sua fala em texto.');
    };
    recognition.onend = () => {
      setIsListening(false);
      setComposerState('idle');
    };
    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setComposerState('recording');
  }, [isListening]);

  useEffect(() => {
    if (!composerCommand) return;

    if (composerCommand === 'attach') {
      fileInputRef.current?.click();
    } else if (composerCommand === 'microphone') {
      toggleListening();
    } else if (composerCommand === 'read-last' && lastAssistantMessage) {
      speakMessage(lastAssistantMessage);
    } else if (composerCommand === 'clear' && activeConversation) {
      clearConversation(activeConversation.id);
      setAttachments([]);
      setInput('');
    }

    clearComposerCommand();
  }, [
    activeConversation,
    clearComposerCommand,
    clearConversation,
    composerCommand,
    lastAssistantMessage,
    speakMessage,
    toggleListening,
  ]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    };
  }, [stopSpeaking]);

  const handleAttachmentSelection = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;

    const nextAttachments = Array.from(selectedFiles).map<AttachmentPreview>((file) => {
      if (file.size > 25 * 1024 * 1024) {
        return {
          id: createMessageId('attachment'),
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: 'Arquivo acima de 25 MB.',
        };
      }

      return {
        id: createMessageId('attachment'),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
      };
    });

    setAttachments((current) => [...current, ...nextAttachments]);
    window.setTimeout(() => {
      setAttachments((current) =>
        current.map((attachment) =>
          nextAttachments.some((item) => item.id === attachment.id) && attachment.status === 'uploading'
            ? { ...attachment, status: 'ready' }
            : attachment,
        ),
      );
    }, 450);
  };

  const submitPrompt = async (overridePrompt?: string, regenerateHistory?: ConversationMessage[]) => {
    const readyAttachments = attachments.filter((attachment) => attachment.status === 'ready');
    const content = (overridePrompt ?? input).trim();
    if ((!content && !readyAttachments.length) || !activeConversation || isLoading) return;

    setComposerState('sending');
    setIsLoading(true);
    setError(null);

    const assistantMessage = createAssistantMessage();
    const historyBase = regenerateHistory ?? activeConversation.messages;
    const history = historyBase
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: message.content }));

    if (!overridePrompt) {
      appendMessage(activeConversation.id, createUserMessage(content || 'Analisar anexos enviados.', readyAttachments));
    }
    appendMessage(activeConversation.id, assistantMessage);

    const attachmentContext = readyAttachments.length ? `\n\nArquivos anexados: ${summarizeAttachments(readyAttachments)}.` : '';
    const prompt = `${content || 'Analise os anexos enviados e responda em portugues.'}${attachmentContext}`.trim();

    setInput('');
    setAttachments([]);

    try {
      const response = await sendChat(prompt, history, activeConversation.id);
      const payload = response.data;
      const meta = [payload.intent, payload.model, payload.context_summary].filter(Boolean).join(' · ');
      await runStreaming(assistantMessage.id, payload.response, meta, payload.model);
      await refreshRuntime();
      setComposerState(voiceReplyEnabled ? 'speaking' : 'idle');

      if (voiceReplyEnabled) {
        speakMessage({
          ...assistantMessage,
          content: payload.response,
          status: 'complete',
        });
      }
    } catch (requestError) {
      const description =
        requestError instanceof Error ? requestError.message : 'Nao foi possivel completar a resposta.';
      updateMessage(activeConversation.id, assistantMessage.id, {
        content: 'Nao consegui completar esta resposta agora. Verifique se a API da Aura e o modelo local estao acessiveis.',
        status: 'error',
        meta: 'Falha operacional',
      });
      setComposerState('error');
      setError(description);
      notifyError('Aura indisponivel', description);
    } finally {
      setIsLoading(false);
      if (!voiceReplyEnabled) {
        setComposerState('idle');
      }
    }
  };

  const handleRegenerate = async (message: ConversationMessage, previousUserContent?: string) => {
    if (!activeConversation || !previousUserContent) return;
    const assistantIndex = activeConversation.messages.findIndex((item) => item.id === message.id);
    const history = assistantIndex > -1 ? activeConversation.messages.slice(0, assistantIndex) : activeConversation.messages;
    await submitPrompt(previousUserContent, history);
  };

  const handleCopy = async (message: ConversationMessage) => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(message.content);
      notifyInfo('Copiado', 'Mensagem copiada para a area de transferencia.');
    } catch {
      notifyError('Falha ao copiar', 'O navegador nao permitiu copiar esta mensagem.');
    }
  };

  return (
    <section className="flex min-h-[calc(100vh-9rem)] flex-col">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          handleAttachmentSelection(event.target.files);
          event.currentTarget.value = '';
        }}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <div className="mb-4 flex-1">
          {messages.length ? (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-4xl space-y-4 pb-8 pt-2">
              <MessageList
                messages={messages}
                activeSpeakingMessageId={activeSpeakingMessageId}
                onCopy={handleCopy}
                onRead={speakMessage}
                onRegenerate={handleRegenerate}
                onTogglePin={(messageId) => activeConversation && togglePinnedMessage(activeConversation.id, messageId)}
              />
              <div ref={bottomRef} />
            </motion.div>
          ) : (
            <ChatEmptyState
              onUsePrompt={(prompt) => {
                setInput(prompt);
              }}
            />
          )}
        </div>

        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void submitPrompt()}
          attachments={attachments}
          onAttach={() => fileInputRef.current?.click()}
          onRemoveAttachment={(attachmentId) =>
            setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
          }
          isLoading={isLoading}
          isListening={isListening}
          isSpeaking={isSpeaking}
          voiceReplyEnabled={voiceReplyEnabled}
          onToggleListening={toggleListening}
          onStopSpeaking={stopSpeaking}
          onToggleVoiceReply={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
          statusLabel={statusLabel}
          error={error}
        />
      </div>
    </section>
  );
}
