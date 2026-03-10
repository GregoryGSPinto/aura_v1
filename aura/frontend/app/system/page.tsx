'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchSystemMetrics, fetchStatus } from '@/lib/api';
import type { SystemMetrics, StatusPayload } from '@/lib/types';

// Mock data for charts
const cpuData = Array.from({ length: 20 }, (_, i) => ({
  time: i,
  value: 20 + Math.random() * 30,
}));

const memoryData = [
  { name: 'Usado', value: 6.4, color: '#D4AF37' },
  { name: 'Livre', value: 9.6, color: '#2D3139' },
];

const COLORS = ['#D4AF37', '#00D4FF', '#238636', '#DA3633'];

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cpuHistory, setCpuHistory] = useState(cpuData);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [metricsRes, statusRes] = await Promise.all([
          fetchSystemMetrics().catch(() => null),
          fetchStatus(),
        ]);
        if (metricsRes) setMetrics(metricsRes.data);
        setStatus(statusRes.data);
      } catch (error) {
        console.error('Failed to load system data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      setCpuHistory(prev => {
        const newData = [...prev.slice(1), {
          time: prev[prev.length - 1].time + 1,
          value: 20 + Math.random() * 40,
        }];
        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monitoramento do Sistema</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Métricas em tempo real do seu Mac
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Online</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card glow="gold">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">CPU Usage</p>
                <p className="text-3xl font-bold mt-1">{Math.round(cpuHistory[cpuHistory.length - 1].value)}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-[var(--gold)]" />
              </div>
            </div>
            <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--cyan)] transition-all duration-500"
                style={{ width: `${cpuHistory[cpuHistory.length - 1].value}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card glow="cyan">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Memória</p>
                <p className="text-3xl font-bold mt-1">6.4 GB</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--cyan)]/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-[var(--cyan)]" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4">de 16 GB total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Disco</p>
                <p className="text-3xl font-bold mt-1">342 GB</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4">de 1 TB total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Uptime</p>
                <p className="text-3xl font-bold mt-1">
                  {status ? formatUptime(status.uptime_seconds) : '--'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4">Desde o último boot</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-[400px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="w-5 h-5 text-[var(--gold)]" />
                Uso de CPU (Tempo Real)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cpuHistory}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#D4AF37" 
                    fillOpacity={1} 
                    fill="url(#cpuGradient)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Memory Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-[400px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="w-5 h-5 text-[var(--cyan)]" />
                Uso de Memória
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={memoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {memoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Services Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Status dos Serviços
            </CardTitle>
            <CardDescription>
              Estado atual dos serviços do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {status && Object.entries(status.services).map(([name, serviceStatus]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      serviceStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                    )}>
                      {serviceStatus === 'online' && (
                        <div className="w-full h-full rounded-full bg-green-500 animate-ping opacity-50" />
                      )}
                    </div>
                    <span className="font-medium capitalize">{name}</span>
                  </div>
                  <Badge variant={serviceStatus === 'online' ? 'green' : 'red'}>
                    {serviceStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
