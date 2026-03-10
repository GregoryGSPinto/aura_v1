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
  Command as CommandIcon,
  ArrowRight,
  Terminal,
  GitBranch,
  Cpu,
} from 'lucide-react';

const navigationCommands = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/', shortcut: '⌘1' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/chat', shortcut: '⌘2' },
  { id: 'swarm', label: 'Agent Swarm', icon: Bot, href: '/swarm', shortcut: '⌘3' },
  { id: 'remote', label: 'Controle Remoto', icon: Monitor, href: '/remote', shortcut: '⌘4' },
  { id: 'projects', label: 'Projetos', icon: FolderOpen, href: '/projects', shortcut: '⌘5' },
  { id: 'system', label: 'Sistema', icon: Activity, href: '/system', shortcut: '⌘6' },
  { id: 'settings', label: 'Configurações', icon: Settings, href: '/settings', shortcut: '⌘7' },
];

const quickActions = [
  { id: 'terminal', label: 'Abrir Terminal', icon: Terminal, action: () => console.log('Open terminal') },
  { id: 'git', label: 'Git Status', icon: GitBranch, action: () => console.log('Git status') },
  { id: 'restart', label: 'Reiniciar Serviços', icon: Cpu, action: () => console.log('Restart services') },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(href as any);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          
          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-[20vh] z-50 mx-auto w-full max-w-2xl px-4"
          >
            <div className="overflow-hidden rounded-2xl glass-strong border border-[var(--border-default)] shadow-2xl">
              <Command className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-muted)]">
                {/* Search Input */}
                <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-4">
                  <Search className="w-5 h-5 text-[var(--text-muted)]" />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Digite um comando ou busque..."
                    className="flex-1 bg-transparent outline-none text-lg placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                  />
                  <kbd className="px-2 py-1 text-xs rounded-lg bg-white/5 text-[var(--text-muted)] border border-white/10">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <Command.List className="max-h-[400px] overflow-y-auto py-2">
                  <Command.Empty className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
                      <Search className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                    <p className="text-[var(--text-muted)]">Nenhum comando encontrado</p>
                  </Command.Empty>
                  
                  {/* Navigation Section */}
                  <Command.Group heading="Navegação" className="px-2">
                    {navigationCommands.map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        onSelect={() => handleSelect(cmd.href)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 data-[selected=true]:bg-white/10 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[var(--gold)]/10 transition-colors">
                          <cmd.icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--gold)] transition-colors" />
                        </div>
                        <span className="flex-1 text-[var(--text-secondary)]">{cmd.label}</span>
                        <kbd className="px-2 py-1 text-xs rounded bg-white/5 text-[var(--text-muted)] border border-white/5">
                          {cmd.shortcut}
                        </kbd>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Command.Item>
                    ))}
                  </Command.Group>

                  {/* Quick Actions Section */}
                  <Command.Group heading="Ações Rápidas" className="px-2 mt-2">
                    {quickActions.map((action) => (
                      <Command.Item
                        key={action.id}
                        onSelect={() => {
                          action.action();
                          setOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 data-[selected=true]:bg-white/10 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[var(--cyan)]/10 transition-colors">
                          <action.icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--cyan)] transition-colors" />
                        </div>
                        <span className="flex-1 text-[var(--text-secondary)]">{action.label}</span>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                </Command.List>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">↑</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">↓</kbd>
                      <span className="ml-1">navegar</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">↵</kbd>
                      <span className="ml-1">selecionar</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <CommandIcon className="w-3 h-3" />
                    <span>+ K para abrir</span>
                  </span>
                </div>
              </Command>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
