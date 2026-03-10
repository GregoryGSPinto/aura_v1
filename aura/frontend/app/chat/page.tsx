'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Paperclip,
  Code2,
  MoreHorizontal,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { sendChat } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';

const quickActions = [
  { label: 'Listar projetos', prompt: 'Quais projetos estão disponíveis?' },
  { label: 'Status do sistema', prompt: 'Me dê um resumo do status operacional.' },
  { label: 'Git status', prompt: 'Qual o status do git do projeto atual?' },
  { label: 'Criar agente', prompt: 'Quero criar um novo agente para automação.' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou a Aura, sua assistente operacional pessoal. Posso ajudar você a gerenciar projetos, executar comandos, controlar agentes autônomos e muito mais. Como posso ajudar hoje?',
      meta: 'Pronta para assistência',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (prompt?: string) => {
    const content = (prompt ?? input).trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(({ role, content: c }) => ({ role, content: c }));
      const response = await sendChat(content, history);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response,
        meta: `${response.data.intent} · ${response.data.processing_time_ms}ms`,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, não consegui processar sua solicitação agora. Verifique se o backend está rodando.',
          meta: 'Erro de conexão',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Chat com a Aura</h1>
          <p className="text-sm text-[var(--text-muted)]">Assistente operacional inteligente</p>
        </div>
      </motion.div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  'flex gap-4',
                  message.role === 'user' && 'flex-row-reverse'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  message.role === 'assistant' 
                    ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)]' 
                    : 'bg-white/10'
                )}>
                  {message.role === 'assistant' ? (
                    <Bot className="w-5 h-5 text-black" />
                  ) : (
                    <User className="w-5 h-5 text-[var(--text-muted)]" />
                  )}
                </div>

                {/* Message Content */}
                <div className={cn(
                  'flex-1 max-w-[80%]',
                  message.role === 'user' && 'text-right'
                )}>
                  <div className={cn(
                    'inline-block p-4 rounded-2xl text-left',
                    message.role === 'assistant'
                      ? 'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]'
                      : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-black'
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                  {message.meta && (
                    <p className="text-xs text-[var(--text-muted)] mt-2">{message.meta}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] flex gap-2 overflow-x-auto">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSubmit(action.prompt)}
              className="px-3 py-1.5 text-xs rounded-full bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border-subtle)]">
          <div className="flex gap-3">
            <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <Paperclip className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-[var(--cyan)] transition-colors"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <Button onClick={() => handleSubmit()} disabled={isLoading || !input.trim()}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
