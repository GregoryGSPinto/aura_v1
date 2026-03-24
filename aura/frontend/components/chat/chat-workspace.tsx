'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { ChatComposer } from '@/components/chat/composer';
import { ChatEmptyState } from '@/components/chat/chat-empty-state';
import { MessageList } from '@/components/chat/message-list';
import { VoiceTranscriptPanel } from '@/components/chat/voice-transcript-panel';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { ApiClientError, sendChat } from '@/lib/api';
import { getAuraChatMode } from '@/lib/chat-modes';
import { clientEnv } from '@/lib/env';
import { useChatStore } from '@/lib/chat-store';
import type { AttachmentPreview, ConversationMessage } from '@/lib/chat-types';
import { notifyError, notifyInfo } from '@/lib/notifications';

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

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const currentMode = getAuraChatMode(selectedModeId);
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
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
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setActiveSpeakingMessageId(null);
    setShouldReplyWithVoice(false);
  }, []);

  const speakMessage = useCallback((message: ConversationMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !message.content.trim()) {
      notifyInfo('Audio indisponivel', 'Speech synthesis nao suportado.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.onstart = () => { setIsSpeaking(true); setActiveSpeakingMessageId(message.id); };
    utterance.onend = () => { setIsSpeaking(false); setActiveSpeakingMessageId(null); setShouldReplyWithVoice(false); };
    utterance.onerror = () => { setIsSpeaking(false); setActiveSpeakingMessageId(null); setShouldReplyWithVoice(false); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleAttachmentSelection = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files).map<AttachmentPreview>((f) => ({
      id: createMessageId('attachment'), name: f.name, size: f.size, type: f.type,
      status: f.size > 25 * 1024 * 1024 ? 'error' : 'uploading',
      ...(f.size > 25 * 1024 * 1024 ? { error: 'Arquivo acima de 25 MB.' } : {}),
    }));
    setAttachments((c) => [...c, ...next]);
    window.setTimeout(() => {
      setAttachments((c) => c.map((a) => next.some((n) => n.id === a.id) && a.status === 'uploading' ? { ...a, status: 'ready' } : a));
    }, 450);
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
        const response = await sendChat(prompt, history, activeConversation.id, {
          modeId: currentMode.id, modeLabel: currentMode.label, capability: currentMode.capability,
          temperature: currentMode.request.temperature, think: currentMode.request.think, shouldReplyWithVoice: replyWithVoice,
        });
        const payload = response.data;
        const meta = [payload.intent, currentMode.label, payload.model, payload.context_summary].filter(Boolean).join(' · ');
        await runStreaming(assistantMsg.id, payload.response, meta, payload.model);
        if (payload.provider || payload.route) updateMessage(activeConversation.id, assistantMsg.id, { provider: payload.provider, route: payload.route });
        await refreshRuntime();
        if (replyWithVoice) speakMessage({ ...assistantMsg, content: payload.response, status: 'complete', modeLabel: currentMode.label });
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

  const columnClass = 'mx-auto flex h-full min-h-0 w-full max-w-[52rem] flex-col';

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => { handleAttachmentSelection(e.target.files); e.currentTarget.value = ''; }}
      />

      {/* Chat messages area */}
      <div className="flex min-h-0 flex-1 flex-col px-4 md:px-6 lg:px-8">
        <div className={columnClass}>
          {messages.length ? (
            <div
              ref={scrollAreaRef}
              className="min-h-0 flex-1 overflow-y-auto pb-6 pt-5"
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
            <div className="flex min-h-0 flex-1 items-center justify-center pb-6 pt-5">
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
            onToggleListening={toggleListening}
            onStopSpeaking={stopSpeaking}
            onToggleVoiceReply={() => setVoiceReplyEnabled(!voiceReplyEnabled)}
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
    </section>
  );
}
