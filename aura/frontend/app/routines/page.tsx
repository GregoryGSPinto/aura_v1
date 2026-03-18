'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
  History,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCw,
  Sparkles,
  Terminal,
  Bell,
  Cpu,
  GitBranch,
  FolderOpen,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchRoutines,
  createRoutine,
  deleteRoutine,
  triggerRoutine,
  toggleRoutine,
  fetchRoutineHistory,
  triggerAppOpenRoutines,
} from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notifications';
import { cn, getRelativeTime } from '@/lib/utils';
import type { Routine, RoutineExecution, RoutineAction, RoutineCreateRequest } from '@/lib/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const triggerTypeLabels: Record<string, string> = {
  scheduled: 'Agendado',
  app_open: 'Abertura do App',
  manual: 'Manual',
  event_based: 'Baseado em Evento',
};

const triggerTypeIcons: Record<string, React.ReactNode> = {
  scheduled: <Clock className="h-4 w-4" />,
  app_open: <Zap className="h-4 w-4" />,
  manual: <Play className="h-4 w-4" />,
  event_based: <Activity className="h-4 w-4" />,
};

const actionTypeIcons: Record<string, React.ReactNode> = {
  notify: <Bell className="h-4 w-4" />,
  command: <Terminal className="h-4 w-4" />,
  open_project: <FolderOpen className="h-4 w-4" />,
  git_status: <GitBranch className="h-4 w-4" />,
  show_logs: <Activity className="h-4 w-4" />,
  system_info: <Cpu className="h-4 w-4" />,
  daily_summary: <Calendar className="h-4 w-4" />,
  pending_review: <AlertCircle className="h-4 w-4" />,
};

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [executions, setExecutions] = useState<RoutineExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'builtin'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());

  const loadRoutines = useCallback(async () => {
    try {
      const response = await fetchRoutines();
      setRoutines(response.data.routines);
      if (selectedRoutine) {
        const updated = response.data.routines.find((r) => r.id === selectedRoutine.id);
        if (updated) setSelectedRoutine(updated);
      }
    } catch (error) {
      notifyError('Erro ao carregar rotinas', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }, [selectedRoutine]);

  const loadExecutions = useCallback(async (routineId?: string) => {
    try {
      if (routineId) {
        const response = await fetchRoutineHistory(routineId, 20);
        setExecutions(response.data.executions);
      } else {
        const response = await fetchRoutines();
        const allExecutions: RoutineExecution[] = [];
        for (const routine of response.data.routines.slice(0, 5)) {
          try {
            const history = await fetchRoutineHistory(routine.id, 5);
            allExecutions.push(...history.data.executions);
          } catch {
            // Ignore errors for individual routines
          }
        }
        setExecutions(allExecutions.sort((a, b) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        ).slice(0, 20));
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialLoad = async () => {
      try {
        await loadRoutines();
        await loadExecutions();
      } catch (error) {
        if (mounted) {
          notifyError('Erro ao carregar', error instanceof Error ? error.message : 'Erro desconhecido');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initialLoad();
    return () => { mounted = false; };
  }, [loadExecutions, loadRoutines]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadRoutines();
      if (selectedRoutine) {
        void loadExecutions(selectedRoutine.id);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadExecutions, loadRoutines, selectedRoutine]);

  const stats = useMemo(() => ({
    total: routines.length,
    active: routines.filter((r) => r.status === 'active').length,
    paused: routines.filter((r) => r.status === 'paused').length,
    builtin: routines.filter((r) => r.is_builtin).length,
  }), [routines]);

  const filteredRoutines = useMemo(() => {
    if (filter === 'all') return routines;
    if (filter === 'builtin') return routines.filter((r) => r.is_builtin);
    return routines.filter((r) => r.status === filter);
  }, [routines, filter]);

  const handleToggle = async (routineId: string) => {
    setBusyId(routineId);
    try {
      const response = await toggleRoutine(routineId);
      notifySuccess('Status alterado', response.data.message);
      await loadRoutines();
    } catch (error) {
      notifyError('Erro ao alterar status', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setBusyId(null);
    }
  };

  const handleTrigger = async (routineId: string) => {
    setBusyId(`trigger-${routineId}`);
    try {
      const response = await triggerRoutine(routineId);
      notifySuccess('Rotina executada', response.data.message);
      await loadRoutines();
      if (selectedRoutine?.id === routineId) {
        await loadExecutions(routineId);
      }
    } catch (error) {
      notifyError('Erro ao executar', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (routineId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta rotina?')) return;
    
    setBusyId(`delete-${routineId}`);
    try {
      await deleteRoutine(routineId);
      notifySuccess('Rotina excluída', 'A rotina foi removida com sucesso');
      if (selectedRoutine?.id === routineId) {
        setSelectedRoutine(null);
      }
      await loadRoutines();
    } catch (error) {
      notifyError('Erro ao excluir', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setBusyId(null);
    }
  };

  const handleTriggerAppOpen = async () => {
    setBusyId('app-open');
    try {
      const response = await triggerAppOpenRoutines();
      notifySuccess('Rotinas de abertura', response.data.message);
      await loadRoutines();
      await loadExecutions();
    } catch (error) {
      notifyError('Erro', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setBusyId(null);
    }
  };

  const toggleExecutionExpand = (executionId: string) => {
    const newExpanded = new Set(expandedExecutions);
    if (newExpanded.has(executionId)) {
      newExpanded.delete(executionId);
    } else {
      newExpanded.add(executionId);
    }
    setExpandedExecutions(newExpanded);
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--purple)] to-[var(--cyan)]">
              <RotateCw className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Rotinas e Automacao</h1>
          </div>
          <p className="text-[var(--text-muted)]">
            Gerencie automações recorrentes, rotinas programadas e ações executadas na abertura do app.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => void loadRoutines()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleTriggerAppOpen} loading={busyId === 'app-open'}>
            <Zap className="mr-2 h-4 w-4" />
            Simular Abertura
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Rotina
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="Ativas" value={stats.active} highlight="green" />
        <StatCard title="Pausadas" value={stats.paused} highlight="yellow" />
        <StatCard title="Built-in" value={stats.builtin} highlight="purple" />
      </div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {(['all', 'active', 'paused', 'builtin'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              filter === f
                ? 'bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-transparent'
            )}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : f === 'paused' ? 'Pausadas' : 'Built-in'}
          </button>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.6fr]">
        {/* Routines List */}
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {filteredRoutines.map((routine) => (
            <motion.div key={routine.id} variants={item}>
              <Card 
                className={cn(
                  'cursor-pointer transition-all',
                  selectedRoutine?.id === routine.id 
                    ? 'border-[var(--purple)]/50 bg-[var(--purple)]/5' 
                    : 'hover:bg-white/[0.02]'
                )}
                onClick={() => {
                  setSelectedRoutine(routine);
                  void loadExecutions(routine.id);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{routine.name}</h3>
                        {routine.is_builtin && (
                          <Badge variant="purple" className="text-xs">Built-in</Badge>
                        )}
                        <Badge variant={routine.status === 'active' ? 'green' : 'default'} className="text-xs">
                          {routine.status === 'active' ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-1">
                        {routine.description || 'Sem descrição'}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-muted)] flex-wrap">
                        <span className="flex items-center gap-1">
                          {triggerTypeIcons[routine.trigger_type]}
                          {triggerTypeLabels[routine.trigger_type]}
                        </span>
                        {routine.schedule && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {routine.schedule}
                          </span>
                        )}
                        {routine.last_run && (
                          <span className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            Última: {getRelativeTime(routine.last_run)}
                          </span>
                        )}
                        {routine.run_count > 0 && (
                          <span>{routine.run_count} execuções</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        loading={busyId === `trigger-${routine.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleTrigger(routine.id);
                        }}
                        disabled={routine.status !== 'active'}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        loading={busyId === routine.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggle(routine.id);
                        }}
                      >
                        {routine.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      {!routine.is_builtin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          loading={busyId === `delete-${routine.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(routine.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filteredRoutines.length === 0 && !loading && (
            <div className="text-center py-12">
              <RotateCw className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
              <p className="text-lg font-medium text-[var(--text-muted)]">
                Nenhuma rotina encontrada
              </p>
            </div>
          )}
        </motion.div>

        {/* Details Panel */}
        <div className="space-y-4">
          {selectedRoutine ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="h-4 w-4 text-[var(--purple)]" />
                    Detalhes da Rotina
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Nome</p>
                    <p className="font-medium">{selectedRoutine.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Descrição</p>
                    <p className="text-sm text-[var(--text-secondary)]">{selectedRoutine.description || 'Sem descrição'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Tipo</p>
                      <p className="text-sm flex items-center gap-1">
                        {triggerTypeIcons[selectedRoutine.trigger_type]}
                        {triggerTypeLabels[selectedRoutine.trigger_type]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Status</p>
                      <Badge variant={selectedRoutine.status === 'active' ? 'green' : 'default'} className="text-xs mt-1">
                        {selectedRoutine.status === 'active' ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </div>
                  </div>
                  {selectedRoutine.schedule && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Agendamento (Cron)</p>
                      <code className="text-sm bg-white/5 px-2 py-1 rounded">{selectedRoutine.schedule}</code>
                    </div>
                  )}
                  {selectedRoutine.next_run && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Próxima execução</p>
                      <p className="text-sm">{new Date(selectedRoutine.next_run).toLocaleString('pt-BR')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Ações</p>
                    <div className="space-y-2">
                      {selectedRoutine.actions.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">Nenhuma ação configurada</p>
                      ) : (
                        selectedRoutine.actions
                          .sort((a, b) => a.order - b.order)
                          .map((action, idx) => (
                            <ActionItem key={action.id} action={action} index={idx} />
                          ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-[var(--gold)]" />
                    Histórico de Execuções
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                  {executions.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma execução registrada</p>
                  ) : (
                    executions.map((execution) => (
                      <ExecutionItem 
                        key={execution.id} 
                        execution={execution}
                        expanded={expandedExecutions.has(execution.id)}
                        onToggle={() => toggleExecutionExpand(execution.id)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <p className="text-[var(--text-muted)]">Selecione uma rotina para ver os detalhes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateRoutineModal 
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              void loadRoutines();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, highlight = 'default' }: { 
  title: string; 
  value: number; 
  highlight?: 'default' | 'green' | 'yellow' | 'purple';
}) {
  const tone =
    highlight === 'green'
      ? 'text-green-400'
      : highlight === 'yellow'
      ? 'text-yellow-400'
      : highlight === 'purple'
      ? 'text-purple-400'
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

function ActionItem({ action, index }: { action: RoutineAction; index: number }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-medium">
        {index + 1}
      </span>
      <span className="text-[var(--purple)]">
        {actionTypeIcons[action.type] || <Terminal className="h-4 w-4" />}
      </span>
      <span className="text-sm capitalize flex-1">{action.type.replace(/_/g, ' ')}</span>
      {Object.keys(action.params).length > 0 && (
        <code className="text-xs text-[var(--text-muted)] bg-black/30 px-2 py-0.5 rounded">
          {JSON.stringify(action.params)}
        </code>
      )}
    </div>
  );
}

function ExecutionItem({ 
  execution, 
  expanded, 
  onToggle 
}: { 
  execution: RoutineExecution; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon =
    execution.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-400" /> :
    execution.status === 'failed' ? <XCircle className="h-4 w-4 text-red-400" /> :
    <RotateCw className="h-4 w-4 text-[var(--cyan)] animate-spin" />;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <button 
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium">
            {new Date(execution.started_at).toLocaleTimeString('pt-BR')}
          </span>
          <Badge variant={execution.triggered_by === 'scheduler' ? 'purple' : 'default'} className="text-xs">
            {execution.triggered_by === 'scheduler' ? 'Agendador' : 
             execution.triggered_by === 'app_open' ? 'Abertura' : 'Manual'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {execution.execution_time_ms && (
            <span className="text-xs text-[var(--text-muted)]">
              {execution.execution_time_ms}ms
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      
      {expanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto'}}
          className="mt-3 pt-3 border-t border-white/5"
        >
          {execution.error_message ? (
            <p className="text-sm text-red-400">{execution.error_message}</p>
          ) : (
            <div className="space-y-1">
              {execution.results.map((result, idx) => (
                <div key={idx} className="text-xs text-[var(--text-muted)]">
                  <span className="text-[var(--cyan)]">{String(result.action || result.type || `Ação ${idx + 1}`)}:</span>
                  {' '}{String(result.message || result.success ? 'Sucesso' : 'Falha')}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function CreateRoutineModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<RoutineCreateRequest['trigger_type']>('manual');
  const [schedule, setSchedule] = useState('');
  const [actions, setActions] = useState<RoutineAction[]>([]);
  const [loading, setLoading] = useState(false);

  const addAction = (type: string) => {
    setActions([...actions, {
      id: `action_${Date.now()}`,
      type,
      params: {},
      order: actions.length,
    }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      notifyError('Erro', 'O nome da rotina é obrigatório');
      return;
    }

    setLoading(true);
    try {
      await createRoutine({
        name: name.trim(),
        description: description.trim(),
        trigger_type: triggerType,
        schedule: schedule.trim() || null,
        actions,
      });
      notifySuccess('Sucesso', 'Rotina criada com sucesso');
      onCreated();
    } catch (error) {
      notifyError('Erro ao criar rotina', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-primary)] border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--gold)]" />
            Nova Rotina
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-muted)]">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--cyan)] outline-none"
              placeholder="Ex: Verificação Diária"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-muted)]">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--cyan)] outline-none"
              rows={2}
              placeholder="Descreva o propósito desta rotina"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-muted)]">Tipo de Gatilho</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['manual', 'scheduled', 'app_open', 'event_based'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTriggerType(type)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-colors',
                    triggerType === type
                      ? 'border-[var(--purple)] bg-[var(--purple)]/10'
                      : 'border-white/10 hover:bg-white/5'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {triggerTypeIcons[type]}
                    <span className="text-sm font-medium">{triggerTypeLabels[type]}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'scheduled' && (
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)]">Agendamento (Cron)</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--cyan)] outline-none font-mono text-sm"
                placeholder="0 9 * * *"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Ex: 0 9 * * * (todos os dias às 9h), 0 */6 * * * (a cada 6 horas)
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[var(--text-muted)]">Ações</label>
            <div className="mt-2 space-y-2">
              {actions.map((action, idx) => (
                <div key={action.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <span className="text-[var(--purple)]">{actionTypeIcons[action.type] || <Terminal className="h-4 w-4" />}</span>
                  <span className="text-sm capitalize flex-1">{action.type.replace(/_/g, ' ')}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeAction(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.keys(actionTypeIcons).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addAction(type)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {type.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={loading}>
              Criar Rotina
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

