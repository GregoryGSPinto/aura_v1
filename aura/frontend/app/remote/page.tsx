'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Terminal,
  AppWindow,
  FolderOpen,
  Play,
  Square,
  RefreshCw,
  Send,
  ChevronRight,
  FileText,
  Folder,
  Image as ImageIcon,
  Music,
  Video,
  Code,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Tab = 'terminal' | 'apps' | 'files';

const mockApps = [
  { name: 'Visual Studio Code', status: 'running' as const, icon: '💻' },
  { name: 'Chrome', status: 'running' as const, icon: '🌐' },
  { name: 'Spotify', status: 'stopped' as const, icon: '🎵' },
  { name: 'Docker Desktop', status: 'running' as const, icon: '🐳' },
  { name: 'Slack', status: 'stopped' as const, icon: '💬' },
  { name: 'Figma', status: 'running' as const, icon: '🎨' },
];

const mockFiles = [
  { name: 'projects', type: 'directory' as const, size: '-' },
  { name: 'documents', type: 'directory' as const, size: '-' },
  { name: 'downloads', type: 'directory' as const, size: '-' },
  { name: 'aura-v1', type: 'directory' as const, size: '2.4 MB' },
  { name: 'README.md', type: 'file' as const, size: '4.2 KB' },
  { name: 'package.json', type: 'file' as const, size: '1.8 KB' },
  { name: 'screenshot.png', type: 'file' as const, size: '2.1 MB' },
];

export default function RemotePage() {
  const [activeTab, setActiveTab] = useState<Tab>('terminal');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'Aura Remote Terminal v1.0.0',
    'Conectado a: MacBook Pro (localhost)',
    'Digite "help" para ver os comandos disponíveis.',
    '',
    'aura@macbook:~$ ',
  ]);

  const handleTerminalSubmit = () => {
    if (!terminalInput.trim()) return;
    
    const newOutput = [...terminalOutput, `aura@macbook:~$ ${terminalInput}`];
    
    // Simulate command response
    if (terminalInput === 'help') {
      newOutput.push(
        'Comandos disponíveis:',
        '  ls          - Lista arquivos',
        '  pwd         - Mostra diretório atual',
        '  clear       - Limpa terminal',
        '  status      - Status do sistema',
        ''
      );
    } else if (terminalInput === 'clear') {
      newOutput.length = 0;
      newOutput.push('aura@macbook:~$ ');
    } else if (terminalInput === 'ls') {
      newOutput.push('projects  documents  downloads  aura-v1');
      newOutput.push('');
    } else if (terminalInput === 'pwd') {
      newOutput.push('/Users/aura');
      newOutput.push('');
    } else if (terminalInput === 'status') {
      newOutput.push('Sistema: Online', 'CPU: 23%', 'Memória: 4.2GB / 16GB', '');
    } else {
      newOutput.push(`Comando não encontrado: ${terminalInput}`);
      newOutput.push('');
    }
    
    setTerminalOutput(newOutput);
    setTerminalInput('');
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'directory') return <Folder className="w-5 h-5 text-[var(--gold)]" />;
    if (name.endsWith('.md')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (name.endsWith('.json')) return <Code className="w-5 h-5 text-yellow-400" />;
    if (name.endsWith('.png') || name.endsWith('.jpg')) return <ImageIcon className="w-5 h-5 text-purple-400" />;
    return <FileText className="w-5 h-5 text-[var(--text-muted)]" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--cyan)] to-blue-500 flex items-center justify-center">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient-cyan">Controle Remoto</h1>
            <p className="text-sm text-[var(--text-muted)]">Gerencie seu Mac remotamente</p>
          </div>
        </div>
        <Badge variant="cyan">Conectado</Badge>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2"
      >
        {[
          { id: 'terminal' as Tab, label: 'Terminal', icon: Terminal },
          { id: 'apps' as Tab, label: 'Aplicações', icon: AppWindow },
          { id: 'files' as Tab, label: 'Arquivos', icon: FolderOpen },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
              activeTab === tab.id
                ? 'bg-[var(--cyan)]/10 text-[var(--cyan)] border border-[var(--cyan)]/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {activeTab === 'terminal' && (
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="w-5 h-5 text-green-400" />
                  Terminal Remoto
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setTerminalOutput(['aura@macbook:~$ '])}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 p-4 font-mono text-sm overflow-y-auto bg-black/50">
                {terminalOutput.map((line, index) => (
                  <div key={index} className={cn(
                    'py-0.5',
                    line.startsWith('aura@') && 'text-green-400',
                    line.startsWith('Comando não encontrado') && 'text-red-400'
                  )}>
                    {line}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-[var(--border-subtle)] flex gap-2">
                <span className="text-green-400 font-mono">aura@macbook:~$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTerminalSubmit()}
                  className="flex-1 bg-transparent outline-none font-mono text-sm"
                  placeholder="Digite um comando..."
                  autoFocus
                />
                <Button size="sm" onClick={handleTerminalSubmit}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'apps' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AppWindow className="w-5 h-5 text-[var(--gold)]" />
                Aplicações
              </CardTitle>
              <CardDescription>
                Controle as aplicações em execução no seu Mac
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockApps.map((app) => (
                  <div
                    key={app.name}
                    className="p-4 rounded-xl bg-white/[0.02] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{app.icon}</span>
                      <Badge 
                        variant={app.status === 'running' ? 'green' : 'default'}
                        className="text-xs"
                      >
                        {app.status === 'running' ? 'Executando' : 'Parado'}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm">{app.name}</p>
                    <div className="flex gap-2 mt-3">
                      {app.status === 'running' ? (
                        <Button variant="outline" size="sm" className="flex-1">
                          <Square className="w-3.5 h-3.5 mr-1.5" />
                          Parar
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1">
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'files' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[var(--gold)]" />
                Arquivos
              </CardTitle>
              <CardDescription>
                Navegue pelos arquivos do seu sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4 text-sm text-[var(--text-muted)]">
                <span>Home</span>
                <ChevronRight className="w-4 h-4" />
                <span>Users</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[var(--text-primary)]">aura</span>
              </div>
              <div className="space-y-1">
                {mockFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {getFileIcon(file.name, file.type)}
                    <span className="flex-1 text-sm">{file.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{file.size}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
