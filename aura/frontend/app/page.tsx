'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Activity,
  Cpu,
  FolderOpen,
  Bot,
  Zap,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchStatus, fetchProjects, fetchActivities } from '@/lib/api';
import type { StatusPayload, Project, Activity as ActivityType } from '@/lib/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }
  },
};

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, projectsRes] = await Promise.all([
          fetchStatus(),
          fetchProjects(),
        ]);
        setStatus(statusRes.data);
        setProjects(projectsRes.data.projects.slice(0, 5));
        
        // Mock activities for now
        setActivities([
          { id: '1', type: 'agent', description: 'Agente Builder completou task #234', timestamp: new Date().toISOString(), status: 'success' },
          { id: '2', type: 'command', description: 'Projeto aura-v1 aberto no VS Code', timestamp: new Date(Date.now() - 300000).toISOString(), status: 'success' },
          { id: '3', type: 'chat', description: 'Consulta sobre status do sistema', timestamp: new Date(Date.now() - 600000).toISOString(), status: 'info' },
        ]);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: ActivityType['type']) => {
    switch (type) {
      case 'agent': return Bot;
      case 'command': return Terminal;
      case 'project': return FolderOpen;
      case 'chat': return Sparkles;
      default: return Activity;
    }
  };

  const getActivityColor = (status: ActivityType['status']) => {
    switch (status) {
      case 'success': return 'text-green-400 bg-green-500/10';
      case 'error': return 'text-red-400 bg-red-500/10';
      case 'info': return 'text-[var(--cyan)] bg-[var(--cyan)]/10';
      default: return 'text-[var(--text-muted)] bg-white/5';
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-gold mb-2">
            Bem-vindo de volta
          </h1>
          <p className="text-[var(--text-muted)]">
            Sistema operacional e agentes autônomos prontos para assistência.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="gold" className="px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            v1.0.0
          </Badge>
        </div>
      </motion.div>

      {/* Status Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Status */}
        <Card glow="gold">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--gold)]" />
              Status do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold capitalize">{status?.status || 'Online'}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {status ? `${Math.floor(status.uptime_seconds / 3600)}h online` : 'Carregando...'}
                </p>
              </div>
              <StatusBadge status="online" pulse />
            </div>
          </CardContent>
        </Card>

        {/* LLM Status */}
        <Card glow="cyan">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--cyan)]" />
              Modelo LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{status?.model?.split(':')[0] || 'Ollama'}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {status?.services.llm === 'online' ? 'Pronto para uso' : 'Conectando...'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[var(--cyan)]/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[var(--cyan)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Agents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              Agentes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  2 executando, 1 ocioso
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {projects.filter(p => p.status === 'active').length} ativos
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-[var(--gold)]" />
                    Projetos Recentes
                  </CardTitle>
                  <CardDescription>
                    Seus projetos mais acessados recentemente
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  Ver todos
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-[var(--gold)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{project.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">{project.description || project.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {project.git?.has_repo && (
                        <Badge variant="default" className="text-xs">
                          {project.git.branch}
                        </Badge>
                      )}
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight className="w-4 h-4 text-[var(--gold)]" />
                      </div>
                    </div>
                  </motion.div>
                ))}
                {projects.length === 0 && !loading && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    Nenhum projeto encontrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Feed */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[var(--cyan)]" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Últimas ações executadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-3"
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        getActivityColor(activity.status)
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {activity.description}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(activity.timestamp).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--gold)]" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>
              Comandos frequentes para acelerar seu workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="cyan">
                <Terminal className="w-4 h-4 mr-2" />
                Abrir Terminal
              </Button>
              <Button variant="outline">
                <Bot className="w-4 h-4 mr-2" />
                Novo Agente
              </Button>
              <Button variant="outline">
                <FolderOpen className="w-4 h-4 mr-2" />
                Criar Projeto
              </Button>
              <Button variant="ghost">
                <Cpu className="w-4 h-4 mr-2" />
                Reiniciar Serviços
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
