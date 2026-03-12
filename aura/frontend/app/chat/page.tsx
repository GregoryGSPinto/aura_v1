'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AudioLines, Bot, Paperclip, Plus, SendHorizontal, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clientEnv } from '@/lib/env';
import { sendChat } from '@/lib/api';
import { notifyError, notifyInfo } from '@/lib/notifications';
import type { ChatMessage } from '@/lib/types';

const quickActions = [
  { label: 'Listar projetos', prompt: 'Quais projetos estao disponiveis agora?' },
  { label: 'Saude do sistema', prompt: 'Me de um resumo real do status operacional da Aura.' },
  { label: 'Git status', prompt: 'Qual e o status do git do projeto principal?' },
  { label: 'Logs recentes', prompt: 'Mostre os logs mais recentes da Aura.' },
];

function createSessionId() {
  if (typeof window === 'undefined') return 'aura-session';
  const stored = window.localStorage.getItem('aura-chat-session-id');
  if (stored) return stored;
  const next = `aura-${crypto.randomUUID()}`;
  window.localStorage.setItem('aura-chat-session-id', next);
  return next;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Sou a Aura. Estou pronta para conversar, estruturar contexto e acionar operacoes permitidas com seguranca.',
      meta: 'Sessao operacional pronta',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [behaviorMode, setBehaviorMode] = useState<string | null>(null);
  const [memorySignals, setMemorySignals] = useState<{ id: string; title: string; content: string; kind: string }[]>([]);
  const [trustSignals, setTrustSignals] = useState<{ id: string; label: string; detail: string; level: string }[]>([]);
  const [actionPreview, setActionPreview] = useState<{
    command: string;
    preview: string;
    risk_level: string;
    requires_confirmation: boolean;
    side_effects: string[];
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('aura-session');

  useEffect(() => {
    sessionIdRef.current = createSessionId();
  }, []);

  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get('prompt');
    if (!prompt) return;
    void handleSubmit(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (prompt?: string) => {
    const content = (prompt ?? input).trim();
    if (!content || isLoading) return;

    setLastError(null);
    const history = messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((prev) => [
      ...prev,
      { role: 'user', content, timestamp: new Date().toISOString() },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChat(content, history, sessionIdRef.current);
      const payload = response.data;
      setContextSummary(payload.context_summary ?? null);
      setBehaviorMode(payload.behavioral_mode ?? null);
      setMemorySignals(payload.memory_signals ?? []);
      setTrustSignals(payload.trust_signals ?? []);
      setActionPreview(payload.action_preview ?? null);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: payload.response,
          meta: [
            payload.intent,
            payload.model,
            payload.suggested_action ? `Sugestao: ${payload.suggested_action.command}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : `Falha ao falar com ${clientEnv.apiUrl || 'o backend configurado'}.`;

      setLastError(description);
      notifyError('Chat indisponivel', description);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Nao consegui completar esta resposta agora. Verifique se a API da Aura e o Ollama local estao acessiveis.',
          meta: 'Falha operacional',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-4">
      <motion.section initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="aura-panel aura-panel-strong px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="cyan">Conversation Runtime</Badge>
              <Badge variant="default">{clientEnv.apiUrl ? 'Backend conectado' : 'Ambiente incompleto'}</Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Converse com uma presenca operacional, nao com um chat genérico.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              A Aura usa o backend real configurado para o seu computador e pode responder, lembrar contexto e sugerir acoes controladas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => void handleSubmit(action.prompt)} className="aura-chip">
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {(lastError || !clientEnv.apiUrl) && (
          <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-yellow-200">Atencao operacional</p>
              <p className="mt-1 break-words text-yellow-100/90">
                {lastError || 'NEXT_PUBLIC_API_URL nao esta configurada. O chat depende do backend real da Aura.'}
              </p>
            </div>
          </div>
        )}
      </motion.section>

      {(contextSummary || actionPreview || memorySignals.length > 0) && (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="aura-panel px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Context engine</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Contexto ativo</h3>
              </div>
              <Badge variant="default">{behaviorMode ?? 'operacional'}</Badge>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{contextSummary ?? 'A Aura vai consolidar o contexto relevante desta sessao aqui.'}</p>
            <div className="mt-4 grid gap-3">
              {memorySignals.map((item) => (
                <div key={item.id} className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-subtle)]">{item.kind}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="aura-panel px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Action governance</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Previa e confianca</h3>
              </div>
              <Badge variant="cyan">{actionPreview?.risk_level ?? 'low'}</Badge>
            </div>
            {actionPreview ? (
              <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{actionPreview.command}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{actionPreview.preview}</p>
                {actionPreview.requires_confirmation && (
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--accent-cyan)]">Exige confirmacao explicita</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Quando houver uma acao governada, a Aura mostrara a previa e o nivel de risco aqui.</p>
            )}
            <div className="mt-4 space-y-3">
              {trustSignals.map((signal) => (
                <div key={signal.id} className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{signal.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="aura-panel flex flex-1 flex-col overflow-hidden px-0 py-0">
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}-${message.timestamp ?? index}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              <div className={`flex ${message.role === 'user' ? 'max-w-[78%] justify-end' : 'max-w-[86%]'} gap-3`}>
                {message.role === 'assistant' && (
                  <div className="aura-orb-sm mt-1">
                    <Sparkles className="h-4 w-4 text-[var(--accent-cyan)]" />
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-[16px] border border-white/8 bg-white/[0.05]">
                    <User className="h-4 w-4 text-[var(--text-secondary)]" />
                  </div>
                )}

                <div
                  className={`message-shell ${message.role === 'assistant' ? 'message-assistant' : 'message-user'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">
                      {message.role === 'assistant' ? 'Aura' : 'Voce'}
                    </p>
                    {message.meta && <span className="text-[11px] text-[var(--text-subtle)]">{message.meta}</span>}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-8 text-[var(--text-primary)]">
                    {message.content}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="aura-orb-sm mt-1">
                <Bot className="h-4 w-4 text-[var(--accent-cyan)]" />
              </div>
              <div className="message-shell message-assistant flex items-center gap-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-cyan)]" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-cyan)]" style={{ animationDelay: '120ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-cyan)]" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-white/8 px-4 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => void handleSubmit(action.prompt)}
                className="aura-chip"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="composer-shell">
            <button
              type="button"
              onClick={() => notifyInfo('Anexos ainda nao estao ativos', 'O fluxo de anexos sera integrado quando o backend suportar upload.')}
              className="composer-icon"
              aria-label="Anexar"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="composer-icon"
              aria-label="Acoes"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva a meta, contexto ou operacao que a Aura deve resolver..."
                rows={1}
                className="composer-input"
                style={{ minHeight: '58px', maxHeight: '160px' }}
              />
            </div>
            <button type="button" className="composer-icon composer-voice" aria-label="Voz">
              <AudioLines className="h-4 w-4" />
            </button>
            <Button onClick={() => void handleSubmit()} disabled={isLoading || !input.trim()} className="shrink-0 rounded-[18px] px-5">
              <SendHorizontal className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
