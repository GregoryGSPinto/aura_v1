'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Cloud,
  FileCode,
  GitBranch,
  Mic,
  Rocket,
  Search,
  Shield,
  Sun,
  Terminal,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: typeof Cloud;
}

const COMMANDS: SlashCommand[] = [
  { command: '/deploy', label: 'Deploy', description: 'Deploy para Vercel/produção', icon: Cloud },
  { command: '/git', label: 'Git Status', description: 'Ver status do repositório', icon: GitBranch },
  { command: '/test', label: 'Testes', description: 'Rodar testes do projeto', icon: Terminal },
  { command: '/status', label: 'Status', description: 'Status geral do sistema', icon: Zap },
  { command: '/memory', label: 'Memória', description: 'Consultar memória persistente', icon: Search },
  { command: '/mission', label: 'Missão', description: 'Criar nova missão Claude', icon: Rocket },
  { command: '/briefing', label: 'Briefing', description: 'Resumo diário do operador', icon: Sun },
  { command: '/voice', label: 'Voz', description: 'Ativar modo de voz', icon: Mic },
  { command: '/safety', label: 'Segurança', description: 'Ver auditoria e aprovações', icon: Shield },
  { command: '/code', label: 'Código', description: 'Abrir arquivo no editor', icon: FileCode },
];

export function SlashCommandMenu({
  inputValue,
  onSelect,
  visible,
}: {
  inputValue: string;
  onSelect: (command: string) => void;
  visible: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!inputValue.startsWith('/')) return [];
    const query = inputValue.slice(1).toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.command.slice(1).startsWith(query) ||
        c.label.toLowerCase().includes(query),
    );
  }, [inputValue]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || !filtered.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(filtered[selectedIndex].command);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSelect('');
      }
    },
    [visible, filtered, selectedIndex, onSelect],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const show = visible && filtered.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.12 }}
          className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-lg backdrop-blur"
          ref={listRef}
        >
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.command}
                type="button"
                onClick={() => onSelect(cmd.command)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                  i === selectedIndex
                    ? 'bg-white/10 text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/5',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{cmd.command}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {cmd.description}
                  </p>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
