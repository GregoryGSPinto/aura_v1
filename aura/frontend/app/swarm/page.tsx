'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Play,
  Square,
  Plus,
  Terminal,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  MoreVertical,
  RefreshCw,
  Zap,
  Cpu,
  GitBranch,
  Rocket,
  Code2,
  Trash2,
  Pause,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { Agent, AgentTask } from '@/lib/types';

// Mock data for agents
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Builder',
    type: 'builder',
    status: 'running',
    description: 'Compila e constrói projetos automaticamente',
    tasks_completed: 127,
    tasks_failed: 3,
    last_activity: new Date().toISOString(),
    config: {},
  },
  {
    id: 'agent-2',
    name: 'Code Reviewer',
    type: 'reviewer',
    status: 'idle',
    description: 'Analisa código e sugere melhorias',
    tasks_completed: 89,
    tasks_failed: 1,
    last_activity: new Date(Date.now() - 300000).toISOString(),
    config: {},
  },
  {
    id: 'agent-3',
    name: 'GitOps',
    type: 'gitops',
    status: 'running',
    description: 'Gerencia operações Git e releases',
    tasks_completed: 234,
    tasks_failed: 5,
    last_activity: new Date().toISOString(),
    config: {},
  },
  {
    id: 'agent-4',
    name: 'Deployer',
    type: 'deployer',
    status: 'error',
    description: 'Realiza deploys em staging e produção',
    tasks_completed: 56,
    tasks_failed: 12,
    last_activity: new Date(Date.now() - 600000).toISOString(),
    config: {},
  },
];

const mockTasks: AgentTask[] = [
  { id: 'task-1', agent_id: 'agent-1', status: 'running', type: 'build', description: 'Compilando projeto aura-v1', created_at: new Date().toISOString(), started_at: new Date().toISOString() },
  { id: 'task-2', agent_id: 'agent-3', status: 'completed', type: 'commit', description: 'Commit automático: update dependencies', created_at: new Date(Date.now() - 60000).toISOString(), started_at: new Date(Date.now() - 60000).toISOString(), completed_at: new Date().toISOString() },
  { id: 'task-3', agent_id: 'agent-2', status: 'pending', type: 'review', description: 'Review de PR #234', created_at: new Date().toISOString() },
  { id: 'task-4', agent_id: 'agent-1', status: 'completed', type: 'test', description: 'Testes unitários', created_at: new Date(Date.now() - 120000).toISOString(), started_at: new Date(Date.now() - 120000).toISOString(), completed_at: new Date(Date.now() - 60000).toISOString() },
  { id: 'task-5', agent_id: 'agent-4', status: 'failed', type: 'deploy', description: 'Deploy para produção', created_at: new Date(Date.now() - 300000).toISOString(), started_at: new Date(Date.now() - 300000).toISOString(), completed_at: new Date(Date.now() - 240000).toISOString(), error: 'Falha na conexão com servidor' },
];

const agentIcons: Record<Agent['type'], typeof Bot> = {
  builder: Code2,
  reviewer: CheckCircle2,
  deployer: Rocket,
  gitops: GitBranch,
  custom: Bot,
};

const agentColors: Record<Agent['type'], string> = {
  builder: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  reviewer: 'from-purple-500/20 to-pink-500/20 text-purple-400',
  deployer: 'from-orange-500/20 to-red-500/20 text-orange-400',
  gitops: 'from-green-500/20 to-emerald-500/20 text-green-400',
  custom: 'from-[var(--gold)]/20 to-[var(--cyan)]/20 text-[var(--gold)]',
};

export default function SwarmPage() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [tasks, setTasks] = useState<AgentTask[]>(mockTasks);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Simulate incoming logs
  useEffect(() => {
    const logMessages = [
      '[09:23:45] Agente Builder iniciado',
      '[09:23:46] Carregando configuração...',
      '[09:23:47] Conectado ao workspace',
      '[09:24:12] Iniciando build do projeto aura-v1',
      '[09:24:15] Instalando dependências...',
      '[09:24:45] Build em progresso (45%)',
      '[09:25:12] Build em progresso (78%)',
      '[09:25:30] Build completado com sucesso',
      '[09:25:31] Aguardando novas tarefas...',
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < logMessages.length) {
        setLogs(prev => [...prev, logMessages[index]]);
        index++;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return 'bg-[var(--cyan)]';
      case 'idle': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'running': return <RefreshCw className="w-4 h-4 animate-spin text-[var(--cyan)]" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-[var(--text-muted)]" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const runningAgents = agents.filter(a => a.status === 'running').length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-3xl font-bold text-gradient-aura">Agent Swarm</h1>
          </div>
          <p className="text-[var(--text-muted)]">
            Orquestre agentes autônomos para automação inteligente
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sincronizar
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Agente
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Agentes Ativos</p>
                <p className="text-3xl font-bold mt-1">{agents.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-[var(--gold)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Executando</p>
                <p className="text-3xl font-bold mt-1 text-[var(--cyan)]">{runningAgents}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--cyan)]/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[var(--cyan)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Tasks Totais</p>
                <p className="text-3xl font-bold mt-1">{totalTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Completadas</p>
                <p className="text-3xl font-bold mt-1 text-green-400">{completedTasks}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Network Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="h-full min-h-[500px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--cyan)]" />
                Network de Agentes
              </CardTitle>
              <CardDescription>
                Visualização em tempo real da comunicação entre agentes
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {/* Network Visualization */}
              <div className="relative h-[400px] rounded-xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                {/* Central Hub */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center animate-pulse">
                      <Bot className="w-8 h-8 text-black" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] blur-xl opacity-50 animate-pulse" />
                  </div>
                </div>

                {/* Agent Nodes */}
                {agents.map((agent, index) => {
                  const angle = (index * 2 * Math.PI) / agents.length - Math.PI / 2;
                  const radius = 140;
                  const x = 50 + (radius / 400) * 100 * Math.cos(angle);
                  const y = 50 + (radius / 400) * 100 * Math.sin(angle);
                  const Icon = agentIcons[agent.type];
                  const isRunning = agent.status === 'running';

                  return (
                    <motion.div
                      key={agent.id}
                      className="absolute cursor-pointer group"
                      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => setSelectedAgent(agent)}
                    >
                      {/* Connection Line */}
                      <svg
                        className="absolute w-full h-full pointer-events-none"
                        style={{ 
                          width: '400px', 
                          height: '400px',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <line
                          x1="200"
                          y1="200"
                          x2={200 + radius * Math.cos(angle)}
                          y2={200 + radius * Math.sin(angle)}
                          stroke={isRunning ? 'var(--cyan)' : 'var(--border-default)'}
                          strokeWidth="1"
                          strokeDasharray={isRunning ? "0" : "5,5"}
                          opacity={isRunning ? 0.6 : 0.2}
                        />
                      </svg>

                      {/* Node */}
                      <div className={cn(
                        'relative w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all duration-300',
                        agentColors[agent.type],
                        isRunning && 'shadow-[0_0_30px_rgba(0,212,255,0.3)]'
                      )}>
                        <Icon className="w-7 h-7" />
                        
                        {/* Status Indicator */}
                        <div className={cn(
                          'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-secondary)]',
                          getStatusColor(agent.status)
                        )}>
                          {isRunning && (
                            <div className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: 'inherit' }} />
                          )}
                        </div>
                      </div>

                      {/* Label */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-center">
                        <p className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">{agent.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] capitalize">{agent.status}</p>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Data Flow Animation */}
                {agents.filter(a => a.status === 'running').map((agent, index) => {
                  const angle = (agents.indexOf(agent) * 2 * Math.PI) / agents.length - Math.PI / 2;
                  return (
                    <motion.div
                      key={`flow-${agent.id}`}
                      className="absolute w-2 h-2 rounded-full bg-[var(--cyan)]"
                      style={{ left: '50%', top: '50%' }}
                      animate={{
                        x: [0, 140 * Math.cos(angle)],
                        y: [0, 140 * Math.sin(angle)],
                        opacity: [1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.5,
                        ease: 'linear',
                      }}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent Details & Tasks */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          {/* Selected Agent Info */}
          <AnimatePresence mode="wait">
            {selectedAgent ? (
              <motion.div
                key={selectedAgent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card glow="cyan">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
                          agentColors[selectedAgent.type]
                        )}>
                          {(() => {
                            const Icon = agentIcons[selectedAgent.type];
                            return <Icon className="w-6 h-6" />;
                          })()}
                        </div>
                        <div>
                          <CardTitle>{selectedAgent.name}</CardTitle>
                          <CardDescription className="capitalize">{selectedAgent.type}</CardDescription>
                        </div>
                      </div>
                      <Badge 
                        variant={selectedAgent.status === 'running' ? 'cyan' : selectedAgent.status === 'error' ? 'red' : 'default'}
                      >
                        {selectedAgent.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">{selectedAgent.description}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-[var(--text-muted)]">Tasks OK</p>
                        <p className="text-xl font-bold text-green-400">{selectedAgent.tasks_completed}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-[var(--text-muted)]">Falhas</p>
                        <p className="text-xl font-bold text-red-400">{selectedAgent.tasks_failed}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {selectedAgent.status === 'running' ? (
                        <Button variant="outline" size="sm" className="flex-1">
                          <Pause className="w-4 h-4 mr-2" />
                          Pausar
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1">
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="h-[200px] flex items-center justify-center">
                  <div className="text-center text-[var(--text-muted)]">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um agente para ver detalhes</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task Queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4 text-[var(--gold)]" />
                  Fila de Tasks
                </CardTitle>
                <Badge variant="default">{tasks.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors"
                  >
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.description}</p>
                      <p className="text-xs text-[var(--text-muted)] capitalize">{task.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="w-4 h-4 text-green-400" />
                Logs em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] overflow-y-auto font-mono text-xs space-y-1 p-3 rounded-lg bg-black/30">
                {logs.map((log, index) => (
                  <div key={index} className="text-[var(--text-muted)]">
                    <span className="text-[var(--gold)]">{log.split(']')[0]}]</span>
                    <span className="ml-2">{log.split(']')[1]}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
