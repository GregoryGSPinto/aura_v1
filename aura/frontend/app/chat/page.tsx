'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bot, Paperclip, Send, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
        'Sou a Aura. Esta conversa usa o backend real configurado para o seu computador. Posso responder, consultar estado operacional e sugerir acoes controladas.',
      meta: 'Sessao pronta',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('aura-session');

  useEffect(() => {
    sessionIdRef.current = createSessionId();
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
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4 lg:min-h-[calc(100vh-8rem)] lg:gap-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] sm:h-12 sm:w-12">
            <Sparkles className="h-6 w-6 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gradient-gold sm:text-2xl">Chat com a Aura</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Conexao direta com {clientEnv.apiUrl || 'o backend da Aura'}.
            </p>
          </div>
        </div>

        {(lastError || !clientEnv.apiUrl) && (
          <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-yellow-200">Atencao operacional</p>
              <p className="mt-1 break-words text-yellow-100/90">
                {lastError || 'NEXT_PUBLIC_API_URL nao esta configurada. O chat depende do backend real da Aura.'}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}-${message.timestamp ?? index}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
                  message.role === 'assistant'
                    ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)]'
                    : 'bg-white/10'
                }`}
              >
                {message.role === 'assistant' ? (
                  <Bot className="h-5 w-5 text-black" />
                ) : (
                  <User className="h-5 w-5 text-[var(--text-muted)]" />
                )}
              </div>

              <div className={`max-w-[88%] flex-1 sm:max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block rounded-2xl p-4 text-left ${
                    message.role === 'assistant'
                      ? 'border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]'
                      : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-black'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                </div>
                {message.meta && <p className="mt-2 text-xs text-[var(--text-muted)]">{message.meta}</p>}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)]">
                <Bot className="h-5 w-5 text-black" />
              </div>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--gold)]" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--gold)]" style={{ animationDelay: '120ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--gold)]" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-[var(--border-subtle)] px-4 py-3 sm:px-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => void handleSubmit(action.prompt)}
              className="whitespace-nowrap rounded-full bg-white/5 px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="border-t border-[var(--border-subtle)] p-3 sm:p-4">
          <div className="flex items-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => notifyInfo('Anexos ainda nao estao ativos', 'O fluxo de anexos sera integrado quando o backend suportar upload.')}
              className="rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <Paperclip className="h-5 w-5 text-[var(--text-muted)]" />
            </button>
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva a meta ou operacao que a Aura deve resolver..."
                rows={1}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)]"
                style={{ minHeight: '52px', maxHeight: '140px' }}
              />
            </div>
            <Button onClick={() => void handleSubmit()} disabled={isLoading || !input.trim()} className="shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
