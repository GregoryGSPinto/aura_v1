'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  Clock,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cancelAgentJob, createAgentJob, fetchAgentJob, fetchAgentJobs, startAgentJob } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notifications';
import { cn, getRelativeTime } from '@/lib/utils';
import type { AgentJobDetail, AgentJobSummary } from '@/lib/types';

const orbitPositions = [
  { top: '16%', left: '50%' },
  { top: '34%', left: '82%' },
  { top: '72%', left: '72%' },
  { top: '78%', left: '28%' },
  { top: '36%', left: '18%' },
];

export default function SwarmPage() {
  const [jobs, setJobs] = useState<AgentJobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<AgentJobDetail | null>(null);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadJobs = async (selectedJobId?: string) => {
    const response = await fetchAgentJobs();
    setJobs(response.data.jobs);

    const activeSelection = selectedJobId ?? response.data.jobs[0]?.id;
    if (activeSelection) {
      const detail = await fetchAgentJob(activeSelection);
      setSelectedJob(detail.data);
    } else {
      setSelectedJob(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialLoad = async () => {
      try {
        await loadJobs();
      } catch (error) {
        if (mounted) {
          notifyError('Swarm indisponivel', error instanceof Error ? error.message : 'Nao foi possivel carregar os jobs.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initialLoad();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void loadJobs(selectedJob?.id).catch(() => undefined), 4000);
    return () => {
      window.clearInterval(interval);
    };
  }, [selectedJob?.id]);

  const stats = useMemo(() => ({
    total: jobs.length,
    running: jobs.filter((job) => job.status === 'running').length,
    queued: jobs.filter((job) => job.status === 'planned' || job.status === 'queued' || job.status === 'pending').length,
    failed: jobs.filter((job) => job.status === 'failed' || job.status === 'blocked').length,
  }), [jobs]);

  const handleCreateJob = async () => {
    const nextGoal = goal.trim();
    if (!nextGoal) return;

    setBusyId('create');
    try {
      const response = await createAgentJob(nextGoal, undefined, false);
      notifySuccess('Job criado', `${response.data.plan_status} · ${response.data.notes.join(' · ')}`);
      setGoal('');
      await loadJobs();
    } catch (error) {
      notifyError('Falha ao criar job', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartJob = async (jobId: string) => {
    setBusyId(jobId);
    try {
      const response = await startAgentJob(jobId);
      setSelectedJob(response.data);
      notifySuccess('Job iniciado', response.data.title);
      await loadJobs(jobId);
    } catch (error) {
      notifyError('Falha ao iniciar job', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setBusyId(jobId);
    try {
      const response = await cancelAgentJob(jobId);
      setSelectedJob(response.data);
      notifySuccess('Job cancelado', response.data.title);
      await loadJobs(jobId);
    } catch (error) {
      notifyError('Falha ao cancelar job', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)]">
              <Bot className="h-5 w-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Swarm operacional</h1>
          </div>
          <p className="text-[var(--text-muted)]">
            Visualizacao estavel dos jobs reais do Agent Mode, executando no backend local da Aura.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => void loadJobs(selectedJob?.id)} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sincronizar
          </Button>
          <Button size="sm" onClick={handleCreateJob} loading={busyId === 'create'}>
            <Plus className="mr-2 h-4 w-4" />
            Criar job
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-[var(--gold)]" />
            Nova meta autonoma
          </CardTitle>
          <CardDescription>Planejamento heuristico seguro usando apenas a whitelist do backend.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="min-h-[96px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--cyan)]"
            placeholder='Ex.: "Abra o projeto aura_v1 e verifique o git status"'
          />
          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--text-muted)] sm:w-[260px]">
            <p className="font-medium text-[var(--text-primary)]">Limites atuais</p>
            <p className="mt-2">O planner cria jobs apenas com comandos permitidos: listar projetos, abrir projeto, git status, show logs, dev e VS Code.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Jobs totais" value={stats.total} />
        <StatCard title="Executando" value={stats.running} highlight="cyan" />
        <StatCard title="Na fila" value={stats.queued} highlight="gold" />
        <StatCard title="Falharam" value={stats.failed} highlight="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--cyan)]" />
              Campo de jobs
            </CardTitle>
            <CardDescription>Refeito para evitar o bug de deslocamento e overflow da tela antiga.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_65%)]" />
              <div className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] shadow-[0_0_60px_rgba(0,212,255,0.2)]">
                <Bot className="h-9 w-9 text-black" />
              </div>

              {jobs.slice(0, 5).map((job, index) => {
                const position = orbitPositions[index] ?? orbitPositions[0];
                const isSelected = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={async () => {
                      const detail = await fetchAgentJob(job.id);
                      setSelectedJob(detail.data);
                    }}
                    className={cn(
                      'absolute z-20 w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-3 text-left backdrop-blur-xl transition-all',
                      isSelected
                        ? 'border-[var(--gold)]/30 bg-white/12 shadow-[0_0_30px_rgba(212,175,55,0.18)]'
                        : 'border-white/10 bg-white/6 hover:border-[var(--cyan)]/30 hover:bg-white/10'
                    )}
                    style={position}
                  >
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)] capitalize">{job.status}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--cyan)]" style={{ width: `${Math.max(job.progress, 6)}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={async () => {
                    const detail = await fetchAgentJob(job.id);
                    setSelectedJob(detail.data);
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{job.goal}</p>
                  </div>
                  <Badge variant={getBadgeVariant(job.status)}>{job.status}</Badge>
                </button>
              ))}
              {!jobs.length && !loading && <p className="text-sm text-[var(--text-muted)]">Nenhum job criado ainda.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4 text-[var(--gold)]" />
                Detalhe do job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedJob ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{selectedJob.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{selectedJob.goal}</p>
                    </div>
                    <Badge variant={getBadgeVariant(selectedJob.status)}>{selectedJob.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MiniMetric label="Progresso" value={`${selectedJob.progress}%`} />
                    <MiniMetric label="Etapa atual" value={`${selectedJob.current_step + 1}/${Math.max(selectedJob.steps.length, 1)}`} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={busyId === selectedJob.id}
                      onClick={() => void handleStartJob(selectedJob.id)}
                      disabled={selectedJob.status === 'running' || selectedJob.status === 'completed'}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Iniciar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      loading={busyId === selectedJob.id}
                      onClick={() => void handleCancelJob(selectedJob.id)}
                      disabled={selectedJob.status === 'completed' || selectedJob.status === 'cancelled'}
                    >
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Resultado</p>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                      {selectedJob.result_summary || selectedJob.error_summary || 'Ainda sem resumo final.'}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Selecione um job para inspecionar o plano e a execucao.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[var(--cyan)]" />
                Steps e logs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedJob?.steps.map((step) => (
                <div key={`${selectedJob.id}-${step.order}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{step.description}</p>
                    </div>
                    <Badge variant={getBadgeVariant(step.status)}>{step.status}</Badge>
                  </div>
                  {(step.output || step.error) && (
                    <p className="mt-3 break-words text-xs text-[var(--text-secondary)]">{step.output || step.error}</p>
                  )}
                </div>
              ))}

              {!!selectedJob?.logs.length && (
                <div className="max-h-[220px] overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-xs">
                  {selectedJob.logs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="py-1 text-[var(--text-muted)]">
                      <span className="text-[var(--gold)]">{getRelativeTime(log.timestamp)}</span>
                      <span className="ml-2">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight = 'default',
}: {
  title: string;
  value: number;
  highlight?: 'default' | 'cyan' | 'gold' | 'red';
}) {
  const tone =
    highlight === 'cyan'
      ? 'text-[var(--cyan)]'
      : highlight === 'gold'
        ? 'text-[var(--gold)]'
        : highlight === 'red'
          ? 'text-red-400'
          : 'text-[var(--text-primary)]';

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-[var(--text-muted)]">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function getBadgeVariant(status: string): 'green' | 'red' | 'yellow' | 'cyan' | 'default' {
  if (status === 'completed') return 'green';
  if (status === 'running') return 'cyan';
  if (status === 'failed' || status === 'blocked' || status === 'cancelled') return 'red';
  if (status === 'planned' || status === 'queued' || status === 'pending') return 'yellow';
  return 'default';
}

