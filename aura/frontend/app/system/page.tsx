'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Lock,
  Server,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clientEnv } from '@/lib/env';
import { fetchAuthStatus, fetchStatus, fetchSystemMetrics } from '@/lib/api';
import { notifyError } from '@/lib/notifications';
import { getRelativeTime } from '@/lib/utils';
import type { AuthStatusPayload, StatusPayload, SystemMetrics } from '@/lib/types';

type HistoryPoint = {
  timestamp: string;
  readiness: number;
  queuedJobs: number;
};

function getReadinessScore(status: StatusPayload | null) {
  if (!status) return 0;

  const onlineServices = Object.values(status.services).filter((value) => value === 'online').length;
  const totalServices = Object.values(status.services).length || 1;
  return Math.round((onlineServices / totalServices) * 100);
}

export default function SystemPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [statusRes, authRes, metricsRes] = await Promise.all([fetchStatus(), fetchAuthStatus(), fetchSystemMetrics()]);
        if (!mounted) return;

        setStatus(statusRes.data);
        setAuthStatus(authRes.data);
        setMetrics(metricsRes.data);
        setLastUpdated(new Date().toISOString());
        setHistory((current) => [
          ...current.slice(-11),
          {
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            readiness: getReadinessScore(statusRes.data),
            queuedJobs: statusRes.data.jobs?.queued ?? 0,
          },
        ]);
      } catch (error) {
        if (mounted) {
          notifyError('Falha ao carregar telemetria', error instanceof Error ? error.message : 'Backend indisponivel.');
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 12000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const alerts = useMemo(() => {
    if (!status) return [];

    const items: { title: string; description: string; severity: 'warning' | 'critical' | 'info' }[] = [];

    if (status.services.llm !== 'online') {
      items.push({
        title: 'LLM indisponivel',
        description: 'O Ollama local nao respondeu. O chat e os agentes ficam degradados.',
        severity: 'critical',
      });
    }

    if (status.services.supabase !== 'online') {
      items.push({
        title: 'Supabase nao esta pronto',
        description: 'A Aura continuara em fallback local-first ate a cloud responder.',
        severity: 'warning',
      });
    }

    if ((status.jobs?.failed ?? 0) > 0) {
      items.push({
        title: 'Ha jobs com falha',
        description: `${status.jobs?.failed ?? 0} job(s) falharam e exigem revisao.`,
        severity: 'warning',
      });
    }

    if ((metrics?.cpu ?? 0) > 85) {
      items.push({
        title: 'CPU elevada',
        description: `Uso atual em ${Math.round(metrics?.cpu ?? 0)}%.`,
        severity: 'warning',
      });
    }

    if ((metrics?.memory ?? 0) > 85) {
      items.push({
        title: 'Memoria elevada',
        description: `Uso atual em ${Math.round(metrics?.memory ?? 0)}%.`,
        severity: 'warning',
      });
    }

    if ((metrics?.disk ?? 0) > 90) {
      items.push({
        title: 'Disco quase cheio',
        description: `Uso de disco em ${Math.round(metrics?.disk ?? 0)}%.`,
        severity: 'critical',
      });
    }

    if (!items.length) {
      items.push({
        title: 'Tudo operacional',
        description: 'API, auth e runtime local estao respondendo corretamente.',
        severity: 'info',
      });
    }

    return items;
  }, [metrics, status]);

  const servicesData = useMemo(() => {
    if (!status) return [];
    return Object.entries(status.services).map(([name, value]) => ({
      name,
      value: value === 'online' ? 1 : 0,
      color: value === 'online' ? '#00D4FF' : '#DA3633',
    }));
  }, [status]);

  return (
    <div className="space-y-4 overflow-x-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 sm:h-12 sm:w-12">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">System realtime</h1>
            <p className="text-sm text-[var(--text-muted)]">Estado real da Aura, do backend e do runtime local.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status?.services.api === 'online' ? 'green' : 'red'}>
            API {status?.services.api ?? 'desconhecida'}
          </Badge>
          <Badge variant={status?.services.llm === 'online' ? 'cyan' : 'red'}>
            LLM {status?.services.llm ?? 'desconhecido'}
          </Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Readiness"
          value={`${getReadinessScore(status)}%`}
          subtitle={lastUpdated ? `Atualizado ${getRelativeTime(lastUpdated)}` : 'Aguardando'}
          icon={Sparkles}
          glow="gold"
        />
        <MetricCard
          title="CPU"
          value={`${Math.round(metrics?.cpu ?? 0)}%`}
          subtitle={(metrics?.cpu ?? 0) > 85 ? 'Acima do limiar de alerta' : 'Dentro do esperado'}
          icon={Activity}
          glow="cyan"
        />
        <MetricCard
          title="Memoria"
          value={`${Math.round(metrics?.memory ?? 0)}%`}
          subtitle={(metrics?.memory ?? 0) > 85 ? 'Memoria sob pressao' : 'Disponibilidade normal'}
          icon={Server}
        />
        <MetricCard
          title="Disco"
          value={`${Math.round(metrics?.disk ?? 0)}%`}
          subtitle={`Auth ${authStatus?.auth_mode ?? status?.auth_mode ?? '--'}`}
          icon={HardDrive}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-5 w-5 text-[var(--gold)]" />
              Readiness ao longo do tempo
            </CardTitle>
            <CardDescription>Serie temporal real derivada dos status polls da Aura.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="readinessGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                  }}
                />
                <Area type="monotone" dataKey="readiness" stroke="#00D4FF" fill="url(#readinessGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-5 w-5 text-[var(--cyan)]" />
              Servicos em linha
            </CardTitle>
            <CardDescription>Status real de API, LLM, filesystem e Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={servicesData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={5}>
                  {servicesData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--gold)]" />
              Alertas oportunos
            </CardTitle>
            <CardDescription>Avisos derivados do estado real da stack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className={`rounded-xl border p-4 ${
                  alert.severity === 'critical'
                    ? 'border-red-500/25 bg-red-500/10'
                    : alert.severity === 'warning'
                      ? 'border-yellow-500/20 bg-yellow-500/10'
                      : 'border-blue-400/20 bg-blue-400/10'
                }`}
              >
                <p className="font-medium">{alert.title}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{alert.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Estado operacional
            </CardTitle>
            <CardDescription>O que esta realmente ativo agora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StateRow label="API backend" value={status?.services.api ?? '--'} />
            <StateRow label="Ollama / Qwen" value={status?.services.llm ?? '--'} />
            <StateRow label="Filesystem" value={status?.services.filesystem ?? '--'} />
            <StateRow label="Supabase" value={status?.services.supabase ?? '--'} />
            <StateRow label="Modo auth" value={authStatus?.provider ? `${authStatus.provider} · ${authStatus.auth_mode}` : status?.auth_mode ?? '--'} />
            <StateRow label="Cloud readiness" value={clientEnv.supabaseUrl ? 'Configurado' : 'Local-first'} />
            <StateRow label="Uptime" value={status ? `${Math.floor(status.uptime_seconds / 3600)}h` : '--'} icon={Clock} />
            <StateRow label="Jobs ativos" value={String(status?.jobs?.running ?? 0)} icon={Workflow} />
            <StateRow label="Persistencia" value={status?.persistence.mode ?? '--'} icon={Database} />
            <StateRow label="Usuario auth" value={authStatus?.user_id ?? 'anon'} icon={Lock} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  glow = 'none',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Activity;
  glow?: 'gold' | 'cyan' | 'none';
}) {
  return (
    <Card glow={glow}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Icon className="h-4 w-4 text-[var(--gold)]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold capitalize">{value}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function StateRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? <Icon className="h-4 w-4 text-[var(--cyan)]" /> : null}
        <span className="text-sm text-[var(--text-muted)]">{label}</span>
      </div>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}
