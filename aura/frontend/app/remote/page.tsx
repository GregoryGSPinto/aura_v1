'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AppWindow,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Monitor,
  Play,
  RefreshCw,
  Send,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { executeCommand, fetchProjects, fetchStatus } from '@/lib/api';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notifications';
import type { Project, StatusPayload } from '@/lib/types';

type Tab = 'terminal' | 'actions' | 'files';

type RemoteAction = {
  id: string;
  label: string;
  command: 'open_vscode' | 'list_projects' | 'show_logs' | 'git_status' | 'run_project_dev' | 'open_project';
  projectRequired?: boolean;
  description: string;
};

const tabs = [
  { id: 'terminal' as Tab, label: 'Terminal controlado', icon: Terminal },
  { id: 'actions' as Tab, label: 'Acoes seguras', icon: AppWindow },
  { id: 'files' as Tab, label: 'Workspaces', icon: FolderOpen },
];

const actions: RemoteAction[] = [
  { id: 'vscode', label: 'Abrir VS Code', command: 'open_vscode', description: 'Abre o editor no seu Mac.' },
  { id: 'projects', label: 'Listar projetos', command: 'list_projects', description: 'Busca a lista real do backend.' },
  { id: 'git', label: 'Git status', command: 'git_status', description: 'Executa git status com whitelist.' },
  { id: 'logs', label: 'Mostrar logs', command: 'show_logs', description: 'Carrega os logs recentes da Aura.' },
  { id: 'open-project', label: 'Abrir projeto', command: 'open_project', description: 'Abre o projeto selecionado no Mac.', projectRequired: true },
  { id: 'run-dev', label: 'Rodar dev', command: 'run_project_dev', description: 'Executa o comando dev cadastrado.', projectRequired: true },
];

function formatTerminalOutput(response: { message?: string; stdout?: string | null; stderr?: string | null }) {
  return [response.message, response.stdout, response.stderr].filter(Boolean).join('\n');
}

export default function RemotePage() {
  const [activeTab, setActiveTab] = useState<Tab>('terminal');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'Aura Remote v1.0.0',
    'Canal seguro conectado ao backend real da Aura.',
    'Digite "help" para ver os comandos permitidos.',
    '',
  ]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statusRes, projectRes] = await Promise.all([fetchStatus(), fetchProjects()]);
        setStatus(statusRes.data);
        setProjects(projectRes.data.projects);
        setSelectedProject((current) => current || projectRes.data.projects[0]?.name || '');
      } catch (error) {
        notifyError('Remote indisponivel', error instanceof Error ? error.message : 'Nao foi possivel sincronizar.');
      }
    };

    void load();
  }, []);

  const selectedProjectLabel = useMemo(
    () => projects.find((project) => project.name === selectedProject)?.name || selectedProject,
    [projects, selectedProject]
  );

  const runBackendCommand = async (command: RemoteAction['command'], projectName?: string) => {
    const params = projectName ? { name: projectName } : undefined;
    const response = await executeCommand(command, params);
    return response.data;
  };

  const handlePresetAction = async (action: RemoteAction) => {
    setBusyAction(action.id);
    try {
      const response = await runBackendCommand(action.command, action.projectRequired ? selectedProjectLabel : undefined);
      const output = formatTerminalOutput(response);
      setTerminalOutput((current) => [
        ...current,
        `> ${action.label}`,
        output || 'Sem retorno textual do backend.',
        '',
      ]);
      notifySuccess(action.label, response.message || 'Acao executada.');
    } catch (error) {
      notifyError(action.label, error instanceof Error ? error.message : 'Falha ao executar a acao.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTerminalSubmit = async () => {
    const value = terminalInput.trim();
    if (!value) return;

    const nextOutput = [...terminalOutput, `aura@macbook:~$ ${value}`];
    setTerminalInput('');

    if (value === 'clear') {
      setTerminalOutput(['Aura Remote v1.0.0', 'Terminal limpo.', '']);
      return;
    }

    if (value === 'help') {
      setTerminalOutput([
        ...nextOutput,
        'Comandos permitidos:',
        '  projects          lista os projetos cadastrados',
        '  status            mostra o estado atual da Aura',
        '  git [projeto]     executa git status via backend',
        '  logs              mostra logs recentes',
        '  open <projeto>    abre o projeto no Mac',
        '  dev <projeto>     roda o comando dev do projeto',
        '  vscode            abre o VS Code',
        '',
      ]);
      return;
    }

    try {
      let output = '';

      if (value === 'projects') {
        const response = await runBackendCommand('list_projects');
        output = response.metadata?.projects
          ? JSON.stringify(response.metadata.projects, null, 2)
          : response.stdout || response.message || 'Sem projetos.';
      } else if (value === 'status') {
        const response = await fetchStatus();
        setStatus(response.data);
        output = JSON.stringify(response.data, null, 2);
      } else if (value === 'logs') {
        const response = await runBackendCommand('show_logs');
        output = response.stdout || response.message || 'Sem logs.';
      } else if (value === 'vscode') {
        const response = await runBackendCommand('open_vscode');
        output = response.message || 'VS Code solicitado.';
      } else if (value.startsWith('git')) {
        const projectName = value.replace(/^git/, '').trim() || selectedProjectLabel;
        const response = await runBackendCommand('git_status', projectName);
        output = response.stdout || response.message || 'Sem saida do git.';
      } else if (value.startsWith('open ')) {
        const projectName = value.replace(/^open\s+/, '').trim();
        const response = await runBackendCommand('open_project', projectName);
        output = response.message || 'Projeto aberto.';
      } else if (value.startsWith('dev ')) {
        const projectName = value.replace(/^dev\s+/, '').trim();
        const response = await runBackendCommand('run_project_dev', projectName);
        output = response.stdout || response.message || 'Comando dev executado.';
      } else {
        output = 'Comando nao permitido. Digite "help" para ver a whitelist disponivel.';
      }

      setTerminalOutput([...nextOutput, output, '']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao consultar o backend.';
      setTerminalOutput([...nextOutput, `Erro: ${message}`, '']);
      notifyError('Terminal controlado', message);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--cyan)] to-blue-500 sm:h-12 sm:w-12">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Controle remoto</h1>
            <p className="text-sm text-[var(--text-muted)]">Somente acoes seguras da whitelist da Aura.</p>
          </div>
        </div>
        <Badge variant={status?.services.api === 'online' ? 'cyan' : 'red'} className="self-start sm:self-auto">
          {status?.services.api === 'online' ? 'Conectado' : 'Offline'}
        </Badge>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-all ${
              activeTab === tab.id
                ? 'border border-[var(--cyan)]/20 bg-[var(--cyan)]/10 text-[var(--cyan)]'
                : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'terminal' && (
        <Card className="flex h-[68vh] min-h-[500px] flex-col sm:h-[600px]">
          <CardHeader className="border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-5 w-5 text-green-400" />
                  Terminal controlado
                </CardTitle>
                <CardDescription>Tradutor de comandos permitidos para a API da Aura.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTerminalOutput(['Aura Remote v1.0.0', 'Terminal limpo.', ''])}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 overflow-y-auto bg-black/50 p-3 font-mono text-xs sm:p-4 sm:text-sm">
              {terminalOutput.map((line, index) => (
                <div key={`${line}-${index}`} className={`py-0.5 ${line.startsWith('Erro:') ? 'text-red-400' : line.startsWith('aura@') ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                  {line}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] p-3 sm:flex-row sm:items-center">
              <span className="font-mono text-xs text-green-400 sm:text-sm">aura@macbook:~$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(event) => setTerminalInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void handleTerminalSubmit()}
                className="flex-1 bg-transparent font-mono text-sm outline-none"
                placeholder='Digite "help" para ver os comandos seguros'
              />
              <Button size="sm" onClick={() => void handleTerminalSubmit()} className="self-end sm:self-auto">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'actions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AppWindow className="h-5 w-5 text-[var(--gold)]" />
              Acoes operacionais
            </CardTitle>
            <CardDescription>Executadas via `/command`, sempre dentro da whitelist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map((action) => (
                <div key={action.id} className="rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] p-4">
                  <p className="font-medium">{action.label}</p>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{action.description}</p>
                  {action.projectRequired && (
                    <select
                      value={selectedProject}
                      onChange={(event) => setSelectedProject(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    >
                      {projects.map((project) => (
                        <option key={project.name} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant={action.command === 'open_vscode' ? 'gold' : 'outline'}
                    className="mt-4 w-full"
                    loading={busyAction === action.id}
                    onClick={() => void handlePresetAction(action)}
                    disabled={action.projectRequired && !selectedProjectLabel}
                  >
                    {action.command === 'run_project_dev' ? <Play className="h-4 w-4" /> : null}
                    Executar
                  </Button>
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
              <FolderOpen className="h-5 w-5 text-[var(--gold)]" />
              Workspaces conectados
            </CardTitle>
            <CardDescription>Os projetos abaixo sao os workspaces reais cadastrados no backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span>Mac</span>
              <ChevronRight className="h-4 w-4" />
              <span>Workspace</span>
              <ChevronRight className="h-4 w-4" />
              <span className="text-[var(--text-primary)]">{selectedProjectLabel || 'Aura'}</span>
            </div>
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={`${project.name}-${project.path}`}
                  type="button"
                  onClick={() => {
                    setSelectedProject(project.name);
                    notifyInfo('Projeto selecionado', project.name);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                    selectedProject === project.name ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <Folder className="h-5 w-5 text-[var(--gold)]" />
                  <span className="min-w-0 flex-1 truncate text-sm">{project.name}</span>
                  <span className="truncate text-xs text-[var(--text-muted)]">{project.path}</span>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="flex items-center gap-3 rounded-lg p-3 text-sm text-[var(--text-muted)]">
                  <FileText className="h-5 w-5" />
                  Nenhum workspace disponivel no backend.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
