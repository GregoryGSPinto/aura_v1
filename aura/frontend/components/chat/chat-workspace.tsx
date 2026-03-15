'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRightClose, SlidersHorizontal } from 'lucide-react';

import { ChatComposer } from '@/components/chat/composer';
import { ChatControlPanel } from '@/components/chat/chat-control-panel';
import { ChatEmptyState } from '@/components/chat/chat-empty-state';
import { MessageList } from '@/components/chat/message-list';
import { ChatModeSelector } from '@/components/chat/mode-selector';
import { ChatStatusBadges } from '@/components/chat/status-badges';
import { VoiceTranscriptPanel } from '@/components/chat/voice-transcript-panel';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { ApiClientError, sendChat } from '@/lib/api';
import { getAuraChatMode } from '@/lib/chat-modes';
import { useChatStore } from '@/lib/chat-store';
import type { AttachmentPreview, ConversationMessage } from '@/lib/chat-types';
import { getClientEnvWarnings } from '@/lib/env';
import { notifyError, notifyInfo } from '@/lib/notifications';

type BrowserRecognitionAlternative = {
  transcript: string;
};

type BrowserRecognitionResult = ArrayLike<BrowserRecognitionAlternative> & {
  isFinal?: boolean;
};

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

type SubmitOptions = {
  source: 'text' | 'voice';
  autoVoiceReply: boolean;
};

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

function createUserMessage(
  content: string,
  attachments: AttachmentPreview[],
  source: 'text' | 'voice',
  modeLabel: string,
): ConversationMessage {
  return {
    id: createMessageId('message'),
    role: 'user',
    content,
    attachments,
    createdAt: new Date().toISOString(),
    status: 'complete',
    inputSource: source,
    modeLabel,
  };
}

function createAssistantMessage(modeLabel: string): ConversationMessage {
  return {
    id: createMessageId('message'),
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'pending',
    modeLabel,
  };
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window.SpeechRecognition || window.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
}

function classifyChatError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 'auth_error' || error.status === 401) {
      return {
        assistantMessage: 'A autenticação local falhou. Confirme se `NEXT_PUBLIC_AURA_TOKEN` está alinhado com `AURA_AUTH_TOKEN`.',
        composerMessage: 'Token inválido. Alinhe `NEXT_PUBLIC_AURA_TOKEN` com `AURA_AUTH_TOKEN`.',
        notificationTitle: 'Falha de autenticação',
      };
    }

    if (error.code === 'backend_unreachable' || error.status === 0) {
      return {
        assistantMessage: 'O backend da Aura está offline ou inacessível. Inicie `scripts/run-backend` ou use `scripts/dev-up`.',
        composerMessage: 'Backend offline em http://localhost:8000.',
        notificationTitle: 'Backend offline',
      };
    }

    if (error.code === 'ollama_unavailable') {
      return {
        assistantMessage: 'O backend respondeu, mas o Ollama não está acessível. Inicie o Ollama local em http://localhost:11434.',
        composerMessage: 'Ollama offline ou sem resposta em http://localhost:11434.',
        notificationTitle: 'Ollama indisponível',
      };
    }

    if (error.code === 'model_unavailable') {
      return {
        assistantMessage: 'O modelo configurado não existe no Ollama local. Verifique se `qwen3.5:9b` foi baixado.',
        composerMessage: "Modelo local indisponível. Rode `ollama pull qwen3.5:9b`.",
        notificationTitle: 'Modelo indisponível',
      };
    }
  }

  return {
    assistantMessage: 'Nao consegui completar esta resposta agora. Verifique backend, token e Ollama local.',
    composerMessage: error instanceof Error ? error.message : 'Falha operacional desconhecida.',
    notificationTitle: 'Aura indisponivel',
  };
}

export function ChatWorkspace() {
  const { refreshRuntime, runtimeStatus } = useAuraPreferences();
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const clearConversation = useChatStore((state) => state.clearConversation);
  const togglePinnedMessage = useChatStore((state) => state.togglePinnedMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const voiceReplyEnabled = useChatStore((state) => state.voiceReplyEnabled);
  const setVoiceReplyEnabled = useChatStore((state) => state.setVoiceReplyEnabled);
  const selectedModeId = useChatStore((state) => state.selectedModeId);
  const setSelectedMode = useChatStore((state) => state.setSelectedMode);
  const composerCommand = useChatStore((state) => state.composerCommand);
  const clearComposerCommand = useChatStore((state) => state.clearComposerCommand);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const currentMode = getAuraChatMode(selectedModeId);
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());
  const envWarnings = getClientEnvWarnings();
  const statusBanner =
    envWarnings[0] ||
    (runtimeStatus?.status === 'offline'
      ? 'Backend offline. Use scripts/dev-up ou scripts/run-backend.'
      : runtimeStatus?.ollama?.model_available === false
        ? `Modelo local ausente no Ollama: ${runtimeStatus?.ollama?.model}.`
        : null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const voiceFinalRef = useRef('');
  const voicePartialRef = useRef('');

  const [draftText, setDraftText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [shouldReplyWithVoice, setShouldReplyWithVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingMessageId, setActiveSpeakingMessageId] = useState<string | null>(null);
  const [voiceTranscriptPartial, setVoiceTranscriptPartial] = useState('');
  const [voiceTranscriptFinal, setVoiceTranscriptFinal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    if (!activeConversationId && conversations[0]) {
      setActiveConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, setActiveConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prompt = new URLSearchParams(window.location.search).get('prompt');
    if (!prompt || draftText || messages.length) return;
    setDraftText(prompt);
  }, [draftText, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading, isProcessingVoice]);

  const clearVoiceCapture = useCallback(() => {
    voiceFinalRef.current = '';
    voicePartialRef.current = '';
    setVoiceTranscriptFinal('');
    setVoiceTranscriptPartial('');
    setIsProcessingVoice(false);
  }, []);

  const runStreaming = useCallback(
    (messageId: string, fullText: string, meta: string, model?: string) =>
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
            modeLabel: currentMode.label,
          });

          if (index >= fullText.length) {
            if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
            resolve();
          }
        }, 18);
      }),
    [activeConversation, currentMode.label, updateMessage],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSpeakingMessageId(null);
    setShouldReplyWithVoice(false);
  }, []);

  const speakMessage = useCallback(
    (message: ConversationMessage) => {
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
        setActiveSpeakingMessageId(message.id);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setActiveSpeakingMessageId(null);
        setShouldReplyWithVoice(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setActiveSpeakingMessageId(null);
        setShouldReplyWithVoice(false);
        notifyError('Falha no audio', 'Nao foi possivel reproduzir a resposta em audio.');
      };
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

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

  const submitPrompt = useCallback(
    async (overridePrompt?: string, regenerateHistory?: ConversationMessage[], submitOptions?: SubmitOptions) => {
      const readyAttachments = submitOptions?.source === 'voice' ? [] : attachments.filter((attachment) => attachment.status === 'ready');
      const content = (overridePrompt ?? draftText).trim();

      if ((!content && !readyAttachments.length) || !activeConversation || isLoading) return;

      const replyWithVoice = submitOptions?.autoVoiceReply ?? voiceReplyEnabled;
      const source = submitOptions?.source ?? 'text';
      const assistantMessage = createAssistantMessage(currentMode.label);
      const historyBase = regenerateHistory ?? activeConversation.messages;
      const history = historyBase
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({ role: message.role, content: message.content }));

      setShouldReplyWithVoice(replyWithVoice);
      setIsLoading(true);
      setError(null);

      if (!regenerateHistory) {
        appendMessage(activeConversation.id, createUserMessage(content || 'Analisar anexos enviados.', readyAttachments, source, currentMode.label));
      }
      appendMessage(activeConversation.id, assistantMessage);

      const attachmentContext = readyAttachments.length ? `\n\nArquivos anexados: ${summarizeAttachments(readyAttachments)}.` : '';
      const prompt = `${content || 'Analise os anexos enviados e responda em portugues.'}${attachmentContext}`.trim();

      setDraftText('');
      setAttachments([]);

      try {
        const response = await sendChat(prompt, history, activeConversation.id, {
          modeId: currentMode.id,
          modeLabel: currentMode.label,
          capability: currentMode.capability,
          temperature: currentMode.request.temperature,
          think: currentMode.request.think,
          shouldReplyWithVoice: replyWithVoice,
        });
        const payload = response.data;
        const meta = [payload.intent, currentMode.label, payload.model, payload.context_summary].filter(Boolean).join(' · ');
        await runStreaming(assistantMessage.id, payload.response, meta, payload.model);
        await refreshRuntime();

        if (replyWithVoice) {
          speakMessage({
            ...assistantMessage,
            content: payload.response,
            status: 'complete',
            modeLabel: currentMode.label,
          });
        } else {
          setShouldReplyWithVoice(false);
        }
      } catch (requestError) {
        const failure = classifyChatError(requestError);
        updateMessage(activeConversation.id, assistantMessage.id, {
          content: failure.assistantMessage,
          status: 'error',
          meta: 'Falha operacional',
          modeLabel: currentMode.label,
        });
        setError(failure.composerMessage);
        setShouldReplyWithVoice(false);
        notifyError(failure.notificationTitle, failure.composerMessage);
      } finally {
        setIsLoading(false);
        setIsProcessingVoice(false);
        clearVoiceCapture();
      }
    },
    [
      activeConversation,
      appendMessage,
      attachments,
      clearVoiceCapture,
      currentMode.capability,
      currentMode.id,
      currentMode.label,
      currentMode.request.temperature,
      currentMode.request.think,
      draftText,
      isLoading,
      refreshRuntime,
      runStreaming,
      speakMessage,
      updateMessage,
      voiceReplyEnabled,
    ],
  );

  const submitVoiceTranscript = useCallback(() => {
    const transcript = [voiceFinalRef.current, voicePartialRef.current].filter(Boolean).join(' ').trim();
    if (!transcript || isLoading) {
      setIsListening(false);
      setIsProcessingVoice(false);
      return;
    }

    setVoiceTranscriptFinal(transcript);
    setVoiceTranscriptPartial('');
    setIsListening(false);
    setIsProcessingVoice(true);
    void submitPrompt(transcript, undefined, { source: 'voice', autoVoiceReply: true });
  }, [isLoading, submitPrompt]);

  const toggleListening = useCallback(() => {
    const SpeechRecognitionApi = getRecognitionConstructor();
    if (!SpeechRecognitionApi) {
      notifyInfo('Microfone indisponivel', 'O navegador atual nao suporta reconhecimento de fala nativo.');
      return;
    }

    if (isListening && speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }

    stopSpeaking();
    clearVoiceCapture();
    setError(null);

    const recognition = new SpeechRecognitionApi() as BrowserSpeechRecognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let nextFinal = '';
      let nextPartial = '';

      Array.from(event.results).forEach((result) => {
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (!transcript) return;
        if (result.isFinal) {
          nextFinal = `${nextFinal} ${transcript}`.trim();
        } else {
          nextPartial = `${nextPartial} ${transcript}`.trim();
        }
      });

      voiceFinalRef.current = nextFinal;
      voicePartialRef.current = nextPartial;
      setVoiceTranscriptFinal(nextFinal);
      setVoiceTranscriptPartial(nextPartial);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setIsProcessingVoice(false);
      notifyError('Microfone indisponivel', 'Nao foi possivel converter sua fala em texto.');
    };
    recognition.onend = () => {
      if (!voiceFinalRef.current.trim() && !voicePartialRef.current.trim()) {
        setIsListening(false);
        clearVoiceCapture();
        return;
      }
      submitVoiceTranscript();
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [clearVoiceCapture, isListening, stopSpeaking, submitVoiceTranscript]);

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
      setDraftText('');
      clearVoiceCapture();
    }

    clearComposerCommand();
  }, [
    activeConversation,
    clearComposerCommand,
    clearConversation,
    clearVoiceCapture,
    composerCommand,
    lastAssistantMessage,
    speakMessage,
    toggleListening,
  ]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    };
  }, [stopSpeaking]);

  const handleRegenerate = async (message: ConversationMessage, previousUserContent?: string) => {
    if (!activeConversation || !previousUserContent) return;
    const assistantIndex = activeConversation.messages.findIndex((item) => item.id === message.id);
    const history = assistantIndex > -1 ? activeConversation.messages.slice(0, assistantIndex) : activeConversation.messages;
    await submitPrompt(previousUserContent, history, { source: 'text', autoVoiceReply: false });
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

  const openNewChat = () => {
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
    }
    stopSpeaking();
    const nextId = createConversation();
    setActiveConversation(nextId);
    setAttachments([]);
    setDraftText('');
    clearVoiceCapture();
    setMobilePanelOpen(false);
  };

  const clearCurrentConversation = () => {
    if (!activeConversation) return;
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
    }
    stopSpeaking();
    clearConversation(activeConversation.id);
    setAttachments([]);
    setDraftText('');
    clearVoiceCapture();
    setMobilePanelOpen(false);
  };

  const testVoice = () => {
    if (lastAssistantMessage) {
      speakMessage(lastAssistantMessage);
      return;
    }

    speakMessage({
      id: createMessageId('sample'),
      role: 'assistant',
      content: 'Aura pronta para responder em voz sempre que a conversa começar pelo microfone.',
      createdAt: new Date().toISOString(),
      status: 'complete',
      modeLabel: currentMode.label,
    });
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

      <div className="mx-auto flex w-full max-w-[1540px] flex-1 gap-6 xl:gap-8">
        <div className="min-w-0 flex-1">
          <div className="mx-auto flex h-full max-w-[60rem] flex-col">
            <div className="shell-panel mb-4 rounded-[2rem] px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--fg-subtle)]">Conversation Runtime</p>
                    <h2 className="pt-1 text-[1.9rem] font-semibold tracking-[-0.06em] text-[var(--fg-primary)]">
                      Conversa com foco, contexto e acabamento premium.
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--fg-muted)]">
                      A Aura centraliza leitura, estados operacionais e composer em uma superficie calma, clara e pronta para uso diario.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <ChatStatusBadges />
                  <div className="hidden xl:block">
                    <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={setSelectedMode} compact />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 xl:hidden">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Aura</p>
                <p className="truncate pt-1 text-sm text-[var(--fg-muted)]">{currentMode.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-4 text-sm text-[var(--fg-primary)]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Painel
              </button>
            </div>

            <div className="mb-4 xl:hidden">
              <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={setSelectedMode} compact />
            </div>

            <div className="mb-4 flex-1">
              {statusBanner ? (
                <div className="surface-alert mb-4 rounded-[1.35rem] px-4 py-3 text-sm">
                  {statusBanner}
                </div>
              ) : null}
              {messages.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-auto w-full space-y-5 pb-8 pt-2"
                >
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
                <ChatEmptyState onUsePrompt={(prompt) => setDraftText(prompt)} />
              )}
            </div>

            <div className="space-y-3">
              <VoiceTranscriptPanel
                partialTranscript={voiceTranscriptPartial}
                finalTranscript={voiceTranscriptFinal}
                isListening={isListening}
                isProcessingVoice={isProcessingVoice}
                onClear={clearVoiceCapture}
              />

              <ChatComposer
                value={draftText}
                onChange={setDraftText}
                onSubmit={() => void submitPrompt(undefined, undefined, { source: 'text', autoVoiceReply: voiceReplyEnabled })}
                attachments={attachments}
                onAttach={() => fileInputRef.current?.click()}
                onRemoveAttachment={(attachmentId) =>
                  setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
                }
                isLoading={isLoading || isProcessingVoice}
                isListening={isListening}
                isSpeaking={isSpeaking}
                voiceReplyEnabled={voiceReplyEnabled || shouldReplyWithVoice}
                onToggleListening={toggleListening}
                onStopSpeaking={stopSpeaking}
                onToggleVoiceReply={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
                error={error}
                selectedModeLabel={currentMode.label}
              />
            </div>
          </div>
        </div>

        <aside className="hidden w-[336px] shrink-0 xl:block">
          <div className="sticky top-24">
            <ChatControlPanel
              selectedModeId={selectedModeId}
              onSelectMode={setSelectedMode}
              onNewChat={openNewChat}
              onClearChat={clearCurrentConversation}
              onRefresh={() => void refreshRuntime()}
              onToggleVoiceReply={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
              onTestVoice={testVoice}
              voiceReplyEnabled={voiceReplyEnabled || shouldReplyWithVoice}
              isListening={isListening}
              isSpeaking={isSpeaking}
            />
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {mobilePanelOpen ? (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(4,8,14,0.76)] backdrop-blur-sm xl:hidden"
              onClick={() => setMobilePanelOpen(false)}
              aria-label="Fechar painel da Aura"
            />
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-3 bottom-3 top-[6.5rem] z-50 overflow-y-auto xl:hidden"
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(false)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-[rgba(8,13,22,0.92)] px-4 text-sm text-[var(--text-primary)]"
                >
                  <PanelRightClose className="h-4 w-4" />
                  Fechar painel
                </button>
              </div>
              <ChatControlPanel
                selectedModeId={selectedModeId}
                onSelectMode={setSelectedMode}
                onNewChat={openNewChat}
                onClearChat={clearCurrentConversation}
                onRefresh={() => void refreshRuntime()}
                onToggleVoiceReply={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
                onTestVoice={testVoice}
                voiceReplyEnabled={voiceReplyEnabled || shouldReplyWithVoice}
                isListening={isListening}
                isSpeaking={isSpeaking}
              />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
