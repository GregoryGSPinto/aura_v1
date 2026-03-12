'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Database,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  Save,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { clientEnv } from '@/lib/env';
import { fetchAuthStatus, fetchStatus } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import type { AuthStatusPayload, StatusPayload } from '@/lib/types';

type Tab = 'general' | 'appearance' | 'notifications' | 'shortcuts' | 'integrations';

const tabs = [
  { id: 'general' as Tab, label: 'Geral', icon: User },
  { id: 'appearance' as Tab, label: 'Aparencia', icon: Palette },
  { id: 'notifications' as Tab, label: 'Notificacoes', icon: Bell },
  { id: 'shortcuts' as Tab, label: 'Atalhos', icon: Keyboard },
  { id: 'integrations' as Tab, label: 'Integracoes', icon: Database },
];

const shortcuts = [
  { action: 'Abrir command palette', shortcut: '⌘K', description: 'Busca rapida global' },
  { action: 'Ir para dashboard', shortcut: '⌘1', description: 'Navegacao imediata' },
  { action: 'Ir para chat', shortcut: '⌘2', description: 'Conversar com a Aura' },
  { action: 'Ir para swarm', shortcut: '⌘3', description: 'Jobs e agentes' },
  { action: 'Ir para remote', shortcut: '⌘4', description: 'Controle remoto seguro' },
  { action: 'Ir para settings', shortcut: '⌘7', description: 'Preferencias e integracoes' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const { themeMode, resolvedTheme, setThemeMode, notifications, setNotifications, visuals, setVisuals } = useAuraPreferences();

  useEffect(() => {
    Promise.all([fetchStatus(), fetchAuthStatus()])
      .then(([statusRes, authRes]) => {
        setStatus(statusRes.data);
        setAuthStatus(authRes.data);
      })
      .catch((error: Error) => notifyError('Settings', error.message));
  }, []);

  const saveFeedback = () => {
    notifySuccess('Preferencias salvas', 'As configuracoes foram persistidas localmente no navegador.');
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="aura-orb-sm">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Configuracoes</h1>
            <p className="text-sm text-[var(--text-muted)]">Preferencias pessoais, apresentacao visual e ambiente operacional.</p>
          </div>
        </div>
        <Button className="self-start sm:self-auto" onClick={saveFeedback}>
          <Save className="mr-2 h-4 w-4" />
          Salvar preferencias
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24 aura-panel px-2 py-2">
            <CardContent className="p-2">
              <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors lg:w-full',
                      activeTab === tab.id
                        ? 'bg-[var(--gold)]/10 text-[var(--gold)]'
                        : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                    )}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Estado local</CardTitle>
                  <CardDescription>Informacoes reais da sessao e do backend configurado.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoTile label="Tema resolvido" value={resolvedTheme} />
                  <InfoTile label="API" value={clientEnv.apiUrl || 'Nao configurada'} />
                  <InfoTile label="Modelo LLM" value={status?.model ?? 'Aguardando backend'} />
                  <InfoTile label="Auth" value={authStatus?.provider ? `${authStatus.provider} · ${authStatus.auth_mode}` : status?.auth_mode ?? 'Desconhecido'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fluxo operacional</CardTitle>
                  <CardDescription>Indicadores uteis para o uso diario da Aura.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <InfoTile label="Persistencia" value={status?.persistence.mode ?? '--'} />
                  <InfoTile label="Jobs em execucao" value={String(status?.jobs?.running ?? 0)} />
                  <InfoTile label="Supabase" value={status?.services.supabase ?? 'desconhecido'} />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Aparencia</CardTitle>
                  <CardDescription>Modo claro, escuro ou automatico aplicado em toda a interface.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Escuro', icon: Moon },
                      { id: 'system', label: 'Automatico', icon: Monitor },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setThemeMode(option.id as 'light' | 'dark' | 'system')}
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-colors',
                          themeMode === option.id
                            ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        )}
                      >
                        <option.icon className="h-6 w-6" />
                        <p className="mt-3 font-medium">{option.label}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {option.id === 'system' ? `Segue o sistema, hoje em ${resolvedTheme}.` : `Forca o tema ${option.label.toLowerCase()}.`}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <ToggleRow
                      label="Particulas de fundo"
                      description="Mantem a Aura com energia visual e movimento controlado."
                      enabled={visuals.particles}
                      onToggle={() => setVisuals({ ...visuals, particles: !visuals.particles })}
                    />
                    <ToggleRow
                      label="Animacoes e parallax"
                      description="Ativa micro movimento e profundidade no fundo da interface."
                      enabled={visuals.animations}
                      onToggle={() => setVisuals({ ...visuals, animations: !visuals.animations })}
                    />
                    <ToggleRow
                      label="Transparencias"
                      description="Mantem glassmorphism e overlays translucidos."
                      enabled={visuals.transparency}
                      onToggle={() => setVisuals({ ...visuals, transparency: !visuals.transparency })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notificacoes</CardTitle>
                <CardDescription>Conectadas aos fluxos reais de chat, remote, dashboard e system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleRow
                  label="Notificacoes push"
                  description="Feedback visual imediato via toast na interface."
                  enabled={notifications.push}
                  onToggle={() => setNotifications({ ...notifications, push: !notifications.push })}
                />
                <ToggleRow
                  label="Resumos por email"
                  description="Mantido como preferencia persistida para integracao futura."
                  enabled={notifications.email}
                  onToggle={() => setNotifications({ ...notifications, email: !notifications.email })}
                />
                <ToggleRow
                  label="Atualizacoes de agentes"
                  description="Usado para jobs e swarm."
                  enabled={notifications.agentUpdates}
                  onToggle={() => setNotifications({ ...notifications, agentUpdates: !notifications.agentUpdates })}
                />
                <ToggleRow
                  label="Alertas do sistema"
                  description="Avisos oportunos quando LLM, auth ou cloud ficarem degradados."
                  enabled={notifications.systemAlerts}
                  onToggle={() => setNotifications({ ...notifications, systemAlerts: !notifications.systemAlerts })}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === 'shortcuts' && (
            <Card>
              <CardHeader>
                <CardTitle>Atalhos ativos</CardTitle>
                <CardDescription>Disponiveis globalmente pelo frontend atual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {shortcuts.map((item) => (
                  <div key={item.shortcut} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
                    <div>
                      <p className="font-medium">{item.action}</p>
                      <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
                    </div>
                    <kbd className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-mono">
                      {item.shortcut}
                    </kbd>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card>
              <CardHeader>
                <CardTitle>Integracoes</CardTitle>
                <CardDescription>Reflexo real do estado da stack e do ambiente atual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <IntegrationRow name="Backend Aura" description="API principal usada pelo frontend" status={status?.services.api === 'online' ? 'Conectado' : 'Desconectado'} tone={status?.services.api === 'online' ? 'green' : 'red'} />
                <IntegrationRow name="Ollama / Qwen" description="Motor local de linguagem" status={status?.services.llm === 'online' ? 'Conectado' : 'Degradado'} tone={status?.services.llm === 'online' ? 'cyan' : 'red'} />
                <IntegrationRow name="Supabase" description="Persistencia cloud e auth futura" status={clientEnv.supabaseUrl ? status?.services.supabase === 'online' ? 'Conectado' : 'Pendente' : 'Nao configurado'} tone={clientEnv.supabaseUrl ? (status?.services.supabase === 'online' ? 'green' : 'yellow') : 'default'} />
                <IntegrationRow name="Vercel / cloud" description="Frontend publicado e envs publicas" status={clientEnv.auraEnv === 'local' ? 'Local-first' : 'Cloud'} tone={clientEnv.auraEnv === 'local' ? 'default' : 'cyan'} />
                <IntegrationRow name="Auth" description="Modo de autenticacao ativo" status={authStatus?.auth_mode ?? status?.auth_mode ?? 'Desconhecido'} tone={authStatus?.authenticated ? 'green' : 'yellow'} />
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-xl bg-white/5 p-4 text-left transition-colors hover:bg-white/[0.07]"
    >
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <div className={cn('relative h-6 w-12 rounded-full transition-colors', enabled ? 'bg-[var(--gold)]' : 'bg-white/20')}>
        <div className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-transform', enabled ? 'left-7' : 'left-1')} />
      </div>
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words font-medium">{value}</p>
    </div>
  );
}

function IntegrationRow({
  name,
  description,
  status,
  tone,
}: {
  name: string;
  description: string;
  status: string;
  tone: 'green' | 'red' | 'yellow' | 'cyan' | 'default';
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <Badge variant={tone}>{status}</Badge>
    </div>
  );
}
