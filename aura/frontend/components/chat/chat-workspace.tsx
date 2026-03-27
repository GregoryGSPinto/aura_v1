'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { useVoiceTTS, useVoiceMode } from '@/hooks/use-voice';

import { ChatComposer } from '@/components/chat/composer';
import { ChatEmptyState } from '@/components/chat/chat-empty-state';
import { MessageList } from '@/components/chat/message-list';
import { VoiceTranscriptPanel } from '@/components/chat/voice-transcript-panel';
import { ApprovalBanner } from '@/components/chat/ApprovalBanner';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { useHealth } from '@/hooks/use-health';
import { useWebSocket } from '@/hooks/use-websocket';
import { ApiClientError, sendChat, agentChat, uploadFile } from '@/lib/api';
import { getAuraChatMode } from '@/lib/chat-modes';
import { clientEnv } from '@/lib/env';
import { useChatStore } from '@/lib/chat-store';
import type { AttachmentPreview, ConversationMessage } from '@/lib/chat-types';
import { notifyError, notifyInfo } from '@/lib/notifications';
import { cn } from '@/lib/utils';

type BrowserRecognitionAlternative = { transcript: string };
type BrowserRecognitionResult = ArrayLike<BrowserRecognitionAlternative> & { isFinal?: boolean };
type BrowserRecognitionEvent = Event & { results: ArrayLike<BrowserRecognitionResult> };
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


function createMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function summarizeAttachments(attachments: AttachmentPreview[]) {
  if (!attachments.length) return '';
  return attachments.map((a) => `${a.name} (${Math.ceil(a.size / 1024)} KB)`).join(', ');
}

function createUserMessage(content: string, attachments: AttachmentPreview[], source: 'text' | 'voice', modeLabel: string): ConversationMessage {
  return { id: createMessageId('message'), role: 'user', content, attachments, createdAt: new Date().toISOString(), status: 'complete', inputSource: source, modeLabel };
}

function createAssistantMessage(modeLabel: string): ConversationMessage {
  return { id: createMessageId('message'), role: 'assistant', content: '', createdAt: new Date().toISOString(), status: 'pending', modeLabel };
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window.SpeechRecognition || window.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
}

function classifyChatError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 'auth_error' || error.status === 401)
      return { assistantMessage: 'Autenticacao falhou. Confira NEXT_PUBLIC_AURA_TOKEN.', composerMessage: 'Token invalido.', notificationTitle: 'Falha de autenticacao' };
    if (error.code === 'backend_unreachable' || error.status === 0)
      return { assistantMessage: 'Backend inacessivel.', composerMessage: `Backend indisponivel (${clientEnv.apiUrl || 'URL nao configurada'}).`, notificationTitle: 'Backend offline' };
    if (error.code === 'ollama_unavailable')
      return { assistantMessage: 'Ollama nao esta acessivel em localhost:11434.', composerMessage: 'Ollama offline.', notificationTitle: 'Ollama indisponivel' };
    if (error.code === 'model_unavailable')
      return { assistantMessage: 'Modelo nao encontrado no Ollama.', composerMessage: 'Rode ollama pull qwen3.5:9b.', notificationTitle: 'Modelo indisponivel' };
  }
  return { assistantMessage: 'Erro ao processar resposta.', composerMessage: error instanceof Error ? error.message : 'Falha desconhecida.', notificationTitle: 'Erro' };
}

export function ChatWorkspace() {
  const { refreshRuntime } = useAuraPreferences();
  const health = useHealth();
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const togglePinnedMessage = useChatStore((s) => s.togglePinnedMessage);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const voiceReplyEnabled = useChatStore((s) => s.voiceReplyEnabled);
  const setVoiceReplyEnabled = useChatStore((s) => s.setVoiceReplyEnabled);
  const selectedModeId = useChatStore((s) => s.selectedModeId);
  const composerCommand = useChatStore((s) => s.composerCommand);
  const clearComposerCommand = useChatStore((s) => s.clearComposerCommand);
  const setWsConnected = useChatStore((s) => s.setWsConnected);
  const setWsThinking = useChatStore((s) => s.setWsThinking);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const currentMode = getAuraChatMode(selectedModeId);
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim());

  // WebSocket real-time events
  const sessionId = activeConversation?.id ?? '';
  const { connected: wsConnected, on: wsOn } = useWebSocket(sessionId);

  useEffect(() => {
    setWsConnected(wsConnected);
  }, [wsConnected, setWsConnected]);

  useEffect(() => {
    if (!wsOn) return;
    const unsubs = [
      wsOn('chat.thinking', () => setWsThinking(true)),
      wsOn('chat.done', () => setWsThinking(false)),
      wsOn('health.changed', () => health.refetch()),
      wsOn('mission.progress', (data) => {
        window.dispatchEvent(new CustomEvent('aura:mission-progress', { detail: data }));
      }),
      wsOn('proactive.alert', (data) => {
        window.dispatchEvent(new CustomEvent('aura:proactive-alert', { detail: data }));
      }),
      wsOn('tool.needs_approval', (data) => {
        window.dispatchEvent(new CustomEvent('aura:tool-approval', { detail: data }));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [wsOn, setWsThinking, health]);

  const { isSpeaking, speak, stop: stopTTS } = useVoiceTTS();
  const voiceMode = useVoiceMode();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const voiceFinalRef = useRef('');
  const voicePartialRef = useRef('');
  // Ref to avoid circular deps between speakMessage ↔ toggleListening ↔ submitPrompt
  const toggleListeningRef = useRef<() => void>(() => {});

  const [draftText, setDraftText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [shouldReplyWithVoice, setShouldReplyWithVoice] = useState(false);
  const [activeSpeakingMessageId, setActiveSpeakingMessageId] = useState<string | null>(null);
  const [voiceTranscriptPartial, setVoiceTranscriptPartial] = useState('');
  const [voiceTranscriptFinal, setVoiceTranscriptFinal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Auto-select first conversation
  useEffect(() => {
    if (!activeConversationId && conversations[0]) setActiveConversation(conversations[0].id);
  }, [activeConversationId, conversations, setActiveConversation]);

  // URL prompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prompt = new URLSearchParams(window.location.search).get('prompt');
    if (!prompt || draftText || messages.length) return;
    setDraftText(prompt);
  }, [draftText, messages.length]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading, isProcessingVoice]);

  // Scroll detection for "new messages" button
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        if (!activeConversation) { resolve(); return; }
        let index = 0;
        const step = Math.max(4, Math.ceil(fullText.length / 56));
        streamTimerRef.current = window.setInterval(() => {
          index = Math.min(fullText.length, index + step);
          updateMessage(activeConversation.id, messageId, {
            content: fullText.slice(0, index),
            status: index >= fullText.length ? 'complete' : 'streaming',
            meta, model, modeLabel: currentMode.label,
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
    stopTTS();
    setActiveSpeakingMessageId(null);
    setShouldReplyWithVoice(false);
  }, [stopTTS]);

  const speakMessage = useCallback((message: ConversationMessage) => {
    if (!message.content.trim()) return;
    setActiveSpeakingMessageId(message.id);
    speak(message.content, () => {
      setActiveSpeakingMessageId(null);
      setShouldReplyWithVoice(false);
      // Voice mode loop: after Aura finishes speaking, auto-activate mic
      if (voiceMode.enabled) {
        voiceMode.onAuraDoneSpeaking(toggleListeningRef.current);
      }
    });
  }, [speak, voiceMode]);

  const handleAttachmentSelection = (files: FileList | null) => {
    if (!files?.length) return;
    const fileArray = Array.from(files);
    const next = fileArray.map<AttachmentPreview>((f) => ({
      id: createMessageId('attachment'), name: f.name, size: f.size, type: f.type,
      status: f.size > 25 * 1024 * 1024 ? 'error' : 'uploading',
      ...(f.size > 25 * 1024 * 1024 ? { error: 'Arquivo acima de 25 MB.' } : {}),
    }));
    setAttachments((c) => [...c, ...next]);

    // Upload real para o backend
    fileArray.forEach((file, idx) => {
      const preview = next[idx];
      if (preview.status === 'error') return;
      uploadFile(file)
        .then((result) => {
          setAttachments((c) => c.map((a) => a.id === preview.id ? { ...a, status: 'ready', serverPath: result.path } as AttachmentPreview : a));
        })
        .catch(() => {
          setAttachments((c) => c.map((a) => a.id === preview.id ? { ...a, status: 'error', error: 'Falha no upload' } : a));
        });
    });
  };

  const submitPrompt = useCallback(
    async (overridePrompt?: string, regenerateHistory?: ConversationMessage[], submitOptions?: { source: 'text' | 'voice'; autoVoiceReply: boolean }) => {
      const readyAttachments = submitOptions?.source === 'voice' ? [] : attachments.filter((a) => a.status === 'ready');
      const content = (overridePrompt ?? draftText).trim();
      if ((!content && !readyAttachments.length) || !activeConversation || isLoading) return;

      const replyWithVoice = submitOptions?.autoVoiceReply ?? voiceReplyEnabled;
      const source = submitOptions?.source ?? 'text';
      const assistantMsg = createAssistantMessage(currentMode.label);
      const historyBase = regenerateHistory ?? activeConversation.messages;
      const history = historyBase.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));

      setShouldReplyWithVoice(replyWithVoice);
      setIsLoading(true);
      setError(null);

      if (!regenerateHistory) appendMessage(activeConversation.id, createUserMessage(content || 'Analisar anexos enviados.', readyAttachments, source, currentMode.label));
      appendMessage(activeConversation.id, assistantMsg);

      const attachContext = readyAttachments.length ? `\n\nArquivos anexados: ${summarizeAttachments(readyAttachments)}.` : '';
      const prompt = `${content || 'Analise os anexos enviados.'}${attachContext}`.trim();
      setDraftText('');
      setAttachments([]);

      try {
        // Try agent endpoint first (supports tool calling), fall back to chat
        let responseText = '';
        let toolCalls: ConversationMessage['toolCalls'] = undefined;
        let meta = '';
        let model: string | undefined;
        let provider: string | undefined;
        let route: ConversationMessage['route'] = undefined;
        let brain: 'local' | 'cloud' | undefined;

        try {
          const agentResult = await agentChat(prompt, 'interactive', history);
          responseText = agentResult.response;
          meta = [currentMode.label, `${Math.round(agentResult.execution_time_ms)}ms`, agentResult.mode].filter(Boolean).join(' · ');
          if (agentResult.tool_calls?.length) {
            toolCalls = agentResult.tool_calls.map((tc) => ({
              tool: tc.tool,
              params: tc.params,
              result: {
                tool: tc.result.tool_name || tc.tool,
                status: tc.result.needs_approval ? 'needs_approval' : tc.result.success ? 'success' : 'failed',
                duration_ms: tc.result.execution_time_ms ? Math.round(tc.result.execution_time_ms) : null,
                output: tc.result.output,
                error: tc.result.error,
                risk_level: `L${tc.result.autonomy_level}`,
              },
            }));
          }
          route = 'agent';
          brain = 'cloud';
        } catch {
          // Fallback to regular chat endpoint
          const response = await sendChat(prompt, history, activeConversation.id, {
            modeId: currentMode.id, modeLabel: currentMode.label, capability: currentMode.capability,
            temperature: currentMode.request.temperature, think: currentMode.request.think, shouldReplyWithVoice: replyWithVoice,
          });
          const payload = response.data;
          responseText = payload.response;
          meta = [payload.intent, currentMode.label, payload.model, payload.context_summary].filter(Boolean).join(' · ');
          model = payload.model;
          provider = payload.provider;
          route = payload.route as ConversationMessage['route'];
          brain = payload.brain_used as 'local' | 'cloud' | undefined;
          if (payload.tool_calls?.length) toolCalls = payload.tool_calls;
        }

        await runStreaming(assistantMsg.id, responseText, meta, model);
        const messageUpdate: Partial<ConversationMessage> = {};
        if (provider || route) { messageUpdate.provider = provider; messageUpdate.route = route; }
        if (brain) messageUpdate.brain = brain;
        if (toolCalls?.length) messageUpdate.toolCalls = toolCalls;
        if (Object.keys(messageUpdate).length) updateMessage(activeConversation.id, assistantMsg.id, messageUpdate);
        await refreshRuntime();
        if (replyWithVoice) speakMessage({ ...assistantMsg, content: responseText, status: 'complete', modeLabel: currentMode.label });
        else setShouldReplyWithVoice(false);
      } catch (err) {
        const failure = classifyChatError(err);
        updateMessage(activeConversation.id, assistantMsg.id, { content: failure.assistantMessage, status: 'error', meta: 'Erro', modeLabel: currentMode.label });
        setError(failure.composerMessage);
        setShouldReplyWithVoice(false);
        notifyError(failure.notificationTitle, failure.composerMessage);
      } finally {
        setIsLoading(false);
        setIsProcessingVoice(false);
        clearVoiceCapture();
      }
    },
    [activeConversation, appendMessage, attachments, clearVoiceCapture, currentMode, draftText, isLoading, refreshRuntime, runStreaming, speakMessage, updateMessage, voiceReplyEnabled],
  );

  const submitVoiceTranscript = useCallback(() => {
    const transcript = [voiceFinalRef.current, voicePartialRef.current].filter(Boolean).join(' ').trim();
    if (!transcript || isLoading) { setIsListening(false); setIsProcessingVoice(false); return; }
    setVoiceTranscriptFinal(transcript);
    setVoiceTranscriptPartial('');
    setIsListening(false);
    setIsProcessingVoice(true);
    void submitPrompt(transcript, undefined, { source: 'voice', autoVoiceReply: true });
  }, [isLoading, submitPrompt]);

  const toggleListening = useCallback(() => {
    const Api = getRecognitionConstructor();
    if (!Api) { notifyInfo('Microfone indisponivel', 'Navegador nao suporta reconhecimento de fala.'); return; }
    if (isListening && speechRecognitionRef.current) { speechRecognitionRef.current.stop(); return; }
    stopSpeaking();
    clearVoiceCapture();
    setError(null);
    const recognition = new Api() as BrowserSpeechRecognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let f = '', p = '';
      Array.from(event.results).forEach((r) => {
        const t = r[0]?.transcript?.trim() ?? '';
        if (!t) return;
        if (r.isFinal) f = `${f} ${t}`.trim(); else p = `${p} ${t}`.trim();
      });
      voiceFinalRef.current = f; voicePartialRef.current = p;
      setVoiceTranscriptFinal(f); setVoiceTranscriptPartial(p);
    };
    recognition.onerror = () => { setIsListening(false); setIsProcessingVoice(false); notifyError('Microfone', 'Falha na captura de voz.'); };
    recognition.onend = () => {
      if (!voiceFinalRef.current.trim() && !voicePartialRef.current.trim()) { setIsListening(false); clearVoiceCapture(); return; }
      submitVoiceTranscript();
    };
    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [clearVoiceCapture, isListening, stopSpeaking, submitVoiceTranscript]);

  // Keep toggleListeningRef fresh so speakMessage can call it without circular dep
  useEffect(() => {
    toggleListeningRef.current = toggleListening;
  }, [toggleListening]);

  // VoiceButton transcript handler: auto-submit in voice mode, else fill composer
  const handleVoiceTranscript = useCallback((text: string) => {
    if (voiceMode.enabled || voiceReplyEnabled) {
      void submitPrompt(text, undefined, { source: 'voice', autoVoiceReply: true });
    } else {
      setDraftText((prev) => (prev ? `${prev} ${text}` : text));
    }
  }, [voiceMode.enabled, voiceReplyEnabled, submitPrompt]);

  // Voice mode toggle: sync both local voiceMode state and Zustand persistence
  const handleToggleVoiceMode = useCallback(() => {
    const next = !voiceReplyEnabled;
    setVoiceReplyEnabled(next);
    if (next) voiceMode.enable(); else voiceMode.disable();
  }, [voiceReplyEnabled, setVoiceReplyEnabled, voiceMode]);

  // External suggestion events (smart chips, share sheet)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setDraftText(detail);
    };
    window.addEventListener('aura:suggestion', handler);
    return () => window.removeEventListener('aura:suggestion', handler);
  }, []);

  // Composer commands from external triggers
  useEffect(() => {
    if (!composerCommand) return;
    if (composerCommand === 'attach') fileInputRef.current?.click();
    else if (composerCommand === 'microphone') toggleListening();
    else if (composerCommand === 'read-last' && lastAssistantMessage) speakMessage(lastAssistantMessage);
    else if (composerCommand === 'clear' && activeConversation) { clearConversation(activeConversation.id); setAttachments([]); setDraftText(''); clearVoiceCapture(); }
    clearComposerCommand();
  }, [activeConversation, clearComposerCommand, clearConversation, clearVoiceCapture, composerCommand, lastAssistantMessage, speakMessage, toggleListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    };
  }, [stopSpeaking]);

  const handleRegenerate = async (message: ConversationMessage, prevContent?: string) => {
    if (!activeConversation || !prevContent) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === message.id);
    const history = idx > -1 ? activeConversation.messages.slice(0, idx) : activeConversation.messages;
    await submitPrompt(prevContent, history, { source: 'text', autoVoiceReply: false });
  };

  const handleCopy = async (message: ConversationMessage) => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard');
      await navigator.clipboard.writeText(message.content);
      notifyInfo('Copiado', 'Mensagem copiada.');
    } catch { notifyError('Erro', 'Nao foi possivel copiar.'); }
  };

  const chatGridClass = 'grid h-full min-h-0 w-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,66rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,70rem)_minmax(0,1fr)]';
  const chatContentClass = 'flex h-full min-h-0 w-full flex-col xl:col-start-2';
  const chatMeasureClass = 'mx-auto flex h-full min-h-0 w-full max-w-[52rem] flex-col 2xl:max-w-[54rem]';

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => { handleAttachmentSelection(e.target.files); e.currentTarget.value = ''; }}
      />

      {/* Approval banner for L2 pending actions */}
      <ApprovalBanner />

      {/* Unhealthy banner */}
      {(health.overallStatus === 'unhealthy' || health.overallStatus === 'unreachable') && (
        <button
          type="button"
          onClick={health.refetch}
          className="flex shrink-0 items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/5 px-4 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Alguns servicos estao offline. Toque para atualizar.
        </button>
      )}

      {/* Chat messages area */}
      <div className="flex min-h-0 flex-1 flex-col px-4 md:px-8 xl:px-10">
        <div className={chatGridClass}>
          <div className={cn(chatContentClass, chatMeasureClass)}>
            {messages.length ? (
              <div
                ref={scrollAreaRef}
                className="min-h-0 flex-1 overflow-y-auto pb-6 pt-6"
                onScroll={handleScroll}
              >
                <div className="flex min-h-full flex-col justify-end">
                  <MessageList
                    messages={messages}
                    activeSpeakingMessageId={activeSpeakingMessageId}
                    onCopy={handleCopy}
                    onRead={speakMessage}
                    onRegenerate={handleRegenerate}
                    onTogglePin={(id) => activeConversation && togglePinnedMessage(activeConversation.id, id)}
                  />
                  <div ref={bottomRef} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center pb-6 pt-6">
                <ChatEmptyState onUsePrompt={(prompt) => setDraftText(prompt)} />
              </div>
            )}

            {/* Voice transcript */}
            <VoiceTranscriptPanel
              partialTranscript={voiceTranscriptPartial}
              finalTranscript={voiceTranscriptFinal}
              isListening={isListening}
              isProcessingVoice={isProcessingVoice}
              onClear={clearVoiceCapture}
            />

            {/* Composer */}
            <ChatComposer
              value={draftText}
              onChange={setDraftText}
              onSubmit={() => void submitPrompt(undefined, undefined, { source: 'text', autoVoiceReply: voiceReplyEnabled })}
              attachments={attachments}
              onAttach={() => fileInputRef.current?.click()}
              onRemoveAttachment={(id) => setAttachments((c) => c.filter((a) => a.id !== id))}
              isLoading={isLoading || isProcessingVoice}
              isListening={isListening}
              isSpeaking={isSpeaking}
              voiceReplyEnabled={voiceReplyEnabled || shouldReplyWithVoice}
              voiceModeWaiting={voiceMode.waitingForUser}
              onToggleListening={toggleListening}
              onStopSpeaking={stopSpeaking}
              onToggleVoiceReply={handleToggleVoiceMode}
              onVoiceTranscript={handleVoiceTranscript}
              error={error}
              selectedModeLabel={currentMode.label}
            />

            {/* Scroll to bottom */}
            {showScrollDown && (
              <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center px-4">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/95 px-3 py-1.5 text-xs text-zinc-400 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-zinc-800"
                >
                  <ArrowDown className="h-3 w-3" />
                  Novas mensagens
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
