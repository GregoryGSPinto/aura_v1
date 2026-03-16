'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Monitor,
  FolderOpen,
  Activity,
  Settings,
  Search,
  ArrowRight,
  Terminal,
  GitBranch,
  FileText,
} from 'lucide-react';
import { executeCommand, fetchStatus } from '@/lib/api';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notifications';

const navigationCommands = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/', shortcut: '⌘1' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/chat', shortcut: '⌘2' },
  { id: 'swarm', label: 'Rotinas', icon: Bot, href: '/swarm', shortcut: '⌘3' },
  { id: 'remote', label: 'Ferramentas', icon: Monitor, href: '/remote', shortcut: '⌘4' },
  { id: 'projects', label: 'Projetos', icon: FolderOpen, href: '/projects', shortcut: '⌘5' },
  { id: 'system', label: 'Sistema', icon: Activity, href: '/system', shortcut: '⌘6' },
  { id: 'settings', label: 'Configuracoes', icon: Settings, href: '/settings', shortcut: '⌘7' },
];

const quickActions = [
  { id: 'vscode', label: 'Abrir VS Code', icon: Terminal, command: 'open_vscode' },
  { id: 'git', label: 'Git Status', icon: GitBranch, command: 'git_status' },
  { id: 'logs', label: 'Mostrar logs recentes', icon: FileText, command: 'show_logs' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isTyping) return;
      if ((e.metaKey || e.ctrlKey) && /^[1-7]$/.test(e.key)) {
        e.preventDefault();
        const match = navigationCommands.find((c) => c.shortcut === `⌘${e.key}`);
        if (match) router.push(match.href);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [router]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(href as any);
  };

  const handleQuickAction = async (command: string, label: string) => {
    setOpen(false);
    setSearch('');
    try {
      if (command === 'show_logs') {
        const r = await executeCommand(command);
        notifyInfo(label, r.data.stdout?.slice(0, 220) || r.data.message || 'Logs carregados.');
        return;
      }
      if (command === 'git_status') {
        const r = await executeCommand(command);
        notifySuccess(label, r.data.stdout || r.data.message || 'Status carregado.');
        return;
      }
      if (command === 'open_vscode') {
        await executeCommand(command);
        notifySuccess(label, 'VS Code solicitado.');
        return;
      }
      const status = await fetchStatus();
      notifyInfo(label, `Aura ${status.data.status} · ${status.data.model}`);
    } catch (err) {
      notifyError(label, err instanceof Error ? err.message : 'Falha ao executar.');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-[20vh] z-50 mx-auto w-full max-w-lg px-4"
          >
            <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-900 shadow-2xl">
              <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-600">
                <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Buscar comando..."
                    className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                  />
                  <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-600">ESC</kbd>
                </div>

                <Command.List className="max-h-80 overflow-y-auto py-1">
                  <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-600">
                    Nenhum resultado
                  </Command.Empty>

                  <Command.Group heading="Navegacao" className="px-1">
                    {navigationCommands.map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        onSelect={() => handleSelect(cmd.href)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                      >
                        <cmd.icon className="h-4 w-4 text-zinc-600" />
                        <span className="flex-1">{cmd.label}</span>
                        <kbd className="text-[10px] text-zinc-700">{cmd.shortcut}</kbd>
                      </Command.Item>
                    ))}
                  </Command.Group>

                  <Command.Group heading="Acoes" className="px-1">
                    {quickActions.map((action) => (
                      <Command.Item
                        key={action.id}
                        onSelect={() => void handleQuickAction(action.command, action.label)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                      >
                        <action.icon className="h-4 w-4 text-zinc-600" />
                        <span className="flex-1">{action.label}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-700" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                </Command.List>
              </Command>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
