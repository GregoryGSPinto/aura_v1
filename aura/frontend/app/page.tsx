'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Bot,
  FolderOpen,
  GitBranch,
  MessageSquare,
  ScrollText,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { executeCommand, fetchProjects, fetchStatus, openProject } from '@/lib/api';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notifications';
import { formatDuration, getRelativeTime } from '@/lib/utils';
import type { CommandResult, Project, StatusPayload } from '@/lib/types';

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  status: 'success' | 'error' | 'info';
  timestamp: string;
};

const quickActions = [
  { id: 'projects', label: 'Listar projetos', icon: FolderOpen },
  { id: 'system', label: 'Saude do sistema', icon: Activity },
  { id: 'git', label: 'Git status', icon: GitBranch },
  { id: 'logs', label: 'Mostrar logs', icon: ScrollText },
  { id: 'chat', label: 'Abrir chat', icon: MessageSquare },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<CommandResult | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [statusRes, projectsRes] = await Promise.all([fetchStatus(), fetchProjects()]);
        if (!mounted) return;

        setStatus(statusRes.data);
        setProjects(projectsRes.data.projects.slice(0, 5));
        setActivities([
          {
            id: 'boot',
            title: 'Aura sincronizada',
            detail: `Modelo ${statusRes.data.model} · persistencia ${statusRes.data.persistence.mode}`,
            status: 'info',
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        if (!mounted) return;
        notifyError('Falha ao carregar dashboard', error instanceof Error ? error.message : 'Backend indisponivel.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();
    const interval = window.setInterval(() => void loadData(), 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const serviceHealth = useMemo(() => {
    if (!status) return 'offline';
    return status.services.llm === 'online' && status.services.api === 'online' ? 'online' : 'busy';
  }, [status]);

  const appendActivity = (title: string, detail: string, status: ActivityItem['status']) => {
    setActivities((current) => [
      {
        id: `${title}-${Date.now()}`,
        title,
        detail,
        status,
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 8));
  };

  const handleQuickAction = async (actionId: (typeof quickActions)[number]['id']) => {
    if (actionId === 'chat') {
      router.push('/chat');
      return;
    }

    setActiveAction(actionId);
    setActionResult(null);

    try {
      if (actionId === 'system') {
        const response = await fetchStatus();
        setStatus(response.data);
        notifyInfo('Saude do sistema', `API ${response.data.services.api} · LLM ${response.data.services.llm}`);
        appendActivity('Saude do sistema', `${response.data.status} · ${response.data.services.llm}`, 'info');
        return;
      }

      const commandName =
        actionId === 'projects'
          ? 'list_projects'
          : actionId === 'git'
            ? 'git_status'
            : 'show_logs';

      const response = await executeCommand(commandName);
      setActionResult(response.data);

      const summary = response.data.stdout || response.data.message || 'Acao executada com sucesso.';
      notifySuccess(quickActions.find((item) => item.id === actionId)?.label || 'Acao executada', summary.slice(0, 220));
      appendActivity(
        quickActions.find((item) => item.id === actionId)?.label || 'Acao executada',
        summary.slice(0, 140),
        'success'
      );
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Falha ao executar a acao.';
      notifyError('Acao rapida falhou', description);
      appendActivity('Falha operacional', description, 'error');
    } finally {
      setActiveAction(null);
    }
  };

  const handleOpenProject = async (projectName: string) => {
    try {
      const response = await openProject(projectName);
      notifySuccess('Projeto aberto', response.data.message);
      appendActivity('Projeto aberto', response.data.message, 'success');
    } catch (error) {
      notifyError('Falha ao abrir projeto', error instanceof Error ? error.message : 'Erro desconhecido.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold sm:text-3xl">Centro de comando</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            A Aura esta conectada ao backend operacional do seu Mac e pronta para executar acoes controladas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={serviceHealth} label={status?.status ?? (loading ? 'Sincronizando' : 'Sem dados')} />
          <Badge variant="gold">v1.0.0</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card glow="gold">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Activity className="h-4 w-4 text-[var(--gold)]" />
              Status da API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">{status?.status ?? 'carregando'}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {status ? `Auth ${status.auth_mode} · ${status.persistence.mode}` : 'Aguardando telemetria'}
            </p>
          </CardContent>
        </Card>

        <Card glow="cyan">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Sparkles className="h-4 w-4 text-[var(--cyan)]" />
              LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.model?.split(':')[0] ?? 'Ollama'}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Servico {status?.services.llm ?? 'desconhecido'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Bot className="h-4 w-4 text-purple-400" />
              Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.jobs?.running ?? 0}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {status?.jobs ? `${status.jobs.queued} na fila · ${status.jobs.failed} falharam` : 'Sem telemetria'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <FolderOpen className="h-4 w-4 text-blue-400" />
              Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{projects.length}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Projetos sincronizados com o backend</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[var(--gold)]" />
                  Acoes rapidas
                </CardTitle>
                <CardDescription>Fluxos reais conectados ao backend da Aura.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/remote')}>
                Abrir controle remoto
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.id === 'chat' ? 'gold' : 'outline'}
                    className="h-auto justify-between px-4 py-4"
                    loading={activeAction === action.id}
                    onClick={() => void handleQuickAction(action.id)}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Ultimo retorno operacional</p>
              {actionResult ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">{actionResult.message ?? actionResult.command}</p>
                  <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap break-words">
                    {(actionResult.stdout || actionResult.stderr || JSON.stringify(actionResult.metadata ?? {}, null, 2)).slice(0, 500)}
                  </p>
                  <p className="text-xs text-[var(--text-subtle)]">{formatDuration(actionResult.execution_time_ms)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-muted)]">Execute uma acao para ver retorno real do backend.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-[var(--cyan)]" />
              Atividade recente
            </CardTitle>
            <CardDescription>Feedback real das acoes que voce disparou pela interface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[var(--cyan)]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="mt-1 break-words text-sm text-[var(--text-muted)]">{activity.detail}</p>
                  <p className="mt-2 text-xs text-[var(--text-subtle)]">{getRelativeTime(activity.timestamp)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-[var(--gold)]" />
                Projetos recentes
              </CardTitle>
              <CardDescription>Abertura real via backend local da Aura.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
              Ver todos
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.map((project) => (
            <div
              key={`${project.name}-${project.path}`}
              className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{project.name}</p>
                <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{project.description || project.path}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void handleOpenProject(project.name)}>
                Abrir no Mac
              </Button>
            </div>
          ))}
          {projects.length === 0 && !loading && (
            <p className="text-sm text-[var(--text-muted)]">Nenhum projeto disponivel no backend.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
