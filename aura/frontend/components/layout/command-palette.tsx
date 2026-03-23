'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Terminal,
  Zap,
} from 'lucide-react';

import { executeCommand } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';
import { useWorkspaceStore, WORKSPACE_PRESETS } from '@/lib/workspace-store';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notifications';
import { getRelativeTime } from '@/lib/utils';

function fuzzyMatch(query: string, text: string): boolean {
  let qi = 0;
  const ql = query.toLowerCase();
  const tl = text.toLowerCase();
  for (let ti = 0; ti < tl.length && qi < ql.length; ti++) {
    if (tl[ti] === ql[qi]) qi++;
  }
  return qi === ql.length;
}

const navigationCommands = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'nav-projects', label: 'Projetos', icon: FolderKanban, href: '/projects' },
  { id: 'nav-remote', label: 'Ferramentas', icon: FolderOpen, href: '/remote' },
  { id: 'nav-workflows', label: 'Automacoes', icon: Zap, href: '/workflows' },
  { id: 'nav-memory', label: 'Memoria', icon: BrainCircuit, href: '/memory' },
  { id: 'nav-settings', label: 'Configuracoes', icon: Settings, href: '/settings' },
];

const quickActions = [
  { id: 'action-vscode', label: 'Abrir VS Code', command: 'open_vscode' },
  { id: 'action-git', label: 'Git Status', command: 'git_status' },
  { id: 'action-logs', label: 'Mostrar logs recentes', command: 'show_logs' },
];

export function CommandPalette() {
  const open = useWorkspaceStore((s) => s.commandPaletteOpen);
  const setOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const search = useWorkspaceStore(() => '');

  const router = useRouter();
  const conversations = useChatStore((s) => s.conversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const createConversation = useChatStore((s) => s.createConversation);

  // Sync Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const workspaceItems = useMemo(() => {
    const presetKeys = ['chat', 'code', 'monitor', 'review', 'focus'] as const;
    const shortcuts = ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5'];
    return presetKeys.map((key, i) => {
      const p = WORKSPACE_PRESETS[key];
      return { id: `ws-${key}`, label: `Modo ${p.name}`, icon: p.icon, shortcut: shortcuts[i], workspaceId: key };
    });
  }, []);

  const recentChats = useMemo(
    () =>
      conversations.slice(0, 6).map((c) => ({
        id: `chat-${c.id}`,
        label: c.title,
        description: getRelativeTime(c.updatedAt),
        conversationId: c.id,
      })),
    [conversations],
  );

  const close = () => setOpen(false);

  const handleNav = (href: string) => {
    close();
    router.push(href);
  };

  const handleWorkspace = (wsId: string) => {
    close();
    setWorkspace(wsId);
    router.push('/chat');
  };

  const handleChat = (conversationId: string) => {
    close();
    setActiveConversation(conversationId);
    router.push('/chat');
  };

  const handleNewChat = () => {
    close();
    const id = createConversation();
    setActiveConversation(id);
    router.push('/chat');
  };

  const handleQuickAction = async (command: string, label: string) => {
    close();
    try {
      const r = await executeCommand(command);
      if (command === 'git_status') {
        notifySuccess(label, r.data.stdout || r.data.message || 'OK');
      } else if (command === 'show_logs') {
        notifyInfo(label, r.data.stdout?.slice(0, 220) || r.data.message || 'Logs carregados.');
      } else {
        notifySuccess(label, r.data.message || 'OK');
      }
    } catch (err) {
      notifyError(label, err instanceof Error ? err.message : 'Falha.');
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
            className="command-palette-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="command-palette-modal fixed inset-x-0 top-[18vh] z-50 mx-auto w-full max-w-[600px] px-4"
          >
            <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-900 shadow-2xl">
              <Command
                filter={(value, search) => (fuzzyMatch(search, value) ? 1 : 0)}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-zinc-600"
              >
                <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <Command.Input
                    placeholder="Digite um comando..."
                    className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                    autoFocus
                  />
                  <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-600">
                    ESC
                  </kbd>
                </div>

                <Command.List className="max-h-[400px] overflow-y-auto py-1">
                  <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-600">
                    Nenhum resultado
                  </Command.Empty>

                  {/* Workspaces */}
                  <Command.Group heading="Workspaces" className="px-1">
                    {workspaceItems.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} workspace modo`}
                        onSelect={() => handleWorkspace(item.workspaceId)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                      >
                        <span className="text-base leading-none">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        <kbd className="text-[10px] text-zinc-700">{item.shortcut}</kbd>
                      </Command.Item>
                    ))}
                  </Command.Group>

                  {/* Actions */}
                  <Command.Group heading="Acoes" className="px-1">
                    <Command.Item
                      value="Novo chat conversa"
                      onSelect={handleNewChat}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                    >
                      <MessageSquare className="h-4 w-4 text-zinc-600" />
                      <span className="flex-1">Novo Chat</span>
                      <kbd className="text-[10px] text-zinc-700">Ctrl+N</kbd>
                    </Command.Item>
                    {quickActions.map((action) => (
                      <Command.Item
                        key={action.id}
                        value={`${action.label} acao`}
                        onSelect={() => void handleQuickAction(action.command, action.label)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                      >
                        {action.command === 'git_status' ? (
                          <GitBranch className="h-4 w-4 text-zinc-600" />
                        ) : action.command === 'open_vscode' ? (
                          <Terminal className="h-4 w-4 text-zinc-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-zinc-600" />
                        )}
                        <span className="flex-1">{action.label}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-700" />
                      </Command.Item>
                    ))}
                  </Command.Group>

                  {/* Navigation */}
                  <Command.Group heading="Navegacao" className="px-1">
                    {navigationCommands.map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        value={`${cmd.label} navegar pagina`}
                        onSelect={() => handleNav(cmd.href)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                      >
                        <cmd.icon className="h-4 w-4 text-zinc-600" />
                        <span className="flex-1">{cmd.label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>

                  {/* Recent chats */}
                  {recentChats.length > 0 && (
                    <Command.Group heading="Chats recentes" className="px-1">
                      {recentChats.map((chat) => (
                        <Command.Item
                          key={chat.id}
                          value={`${chat.label} chat conversa recente`}
                          onSelect={() => handleChat(chat.conversationId)}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 data-[selected=true]:bg-white/5 data-[selected=true]:text-zinc-200"
                        >
                          <MessageSquare className="h-4 w-4 text-zinc-600" />
                          <span className="flex-1 truncate">{chat.label}</span>
                          <span className="text-[10px] text-zinc-700">{chat.description}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </Command.List>
              </Command>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
