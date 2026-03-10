'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Bell,
  Shield,
  Database,
  Keyboard,
  Palette,
  Save,
  Moon,
  Sun,
  Monitor,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Tab = 'general' | 'appearance' | 'notifications' | 'shortcuts' | 'integrations';

const tabs = [
  { id: 'general' as Tab, label: 'Geral', icon: User },
  { id: 'appearance' as Tab, label: 'Aparência', icon: Palette },
  { id: 'notifications' as Tab, label: 'Notificações', icon: Bell },
  { id: 'shortcuts' as Tab, label: 'Atalhos', icon: Keyboard },
  { id: 'integrations' as Tab, label: 'Integrações', icon: Database },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [notifications, setNotifications] = useState({
    push: true,
    email: false,
    agentUpdates: true,
    systemAlerts: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Personalize sua experiência com a Aura
            </p>
          </div>
        </div>
        <Button>
          <Save className="w-4 h-4 mr-2" />
          Salvar Alterações
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <Card className="sticky top-4">
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors',
                      activeTab === tab.id
                        ? 'bg-[var(--gold)]/10 text-[var(--gold)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                    )}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3"
        >
          {activeTab === 'general' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Gerais</CardTitle>
                  <CardDescription>
                    Configure as informações básicas do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                        Nome do Dispositivo
                      </label>
                      <input
                        type="text"
                        defaultValue="MacBook Pro"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[var(--cyan)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                        Modelo LLM Padrão
                      </label>
                      <select className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[var(--cyan)]">
                        <option>qwen3.5:9b</option>
                        <option>llama3.1:8b</option>
                        <option>codellama:7b</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                      Workspace Path
                    </label>
                    <input
                      type="text"
                      defaultValue="/Users/aura/projects"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[var(--cyan)]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>LLM Configuration</CardTitle>
                  <CardDescription>
                    Ajuste os parâmetros do modelo de linguagem
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[var(--text-muted)]">
                        Temperatura
                      </label>
                      <span className="text-sm text-[var(--gold)]">0.7</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      defaultValue="0.7"
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-subtle)] mt-1">
                      <span>Mais preciso</span>
                      <span>Mais criativo</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                        Timeout (segundos)
                      </label>
                      <input
                        type="number"
                        defaultValue="30"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        defaultValue="2048"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
                <CardDescription>
                  Personalize a aparência da interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-4">
                    Tema
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Escuro', icon: Moon },
                      { id: 'system', label: 'Sistema', icon: Monitor },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as typeof theme)}
                        className={cn(
                          'flex flex-col items-center gap-3 p-4 rounded-xl border transition-colors',
                          theme === t.id
                            ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                            : 'border-white/10 hover:border-white/20'
                        )}
                      >
                        <t.icon className="w-6 h-6" />
                        <span className="text-sm">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-4">
                    Efeitos Visuais
                  </label>
                  <div className="space-y-3">
                    {[
                      { id: 'particles', label: 'Partículas no fundo', default: true },
                      { id: 'animations', label: 'Animações', default: true },
                      { id: 'transparency', label: 'Efeitos de transparência', default: true },
                    ].map((effect) => (
                      <label
                        key={effect.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-pointer"
                      >
                        <span className="text-sm">{effect.label}</span>
                        <input
                          type="checkbox"
                          defaultChecked={effect.default}
                          className="w-5 h-5 rounded border-white/20 bg-transparent checked:bg-[var(--gold)]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>
                  Configure como você recebe notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'push', label: 'Notificações push', description: 'Receba notificações no navegador' },
                  { id: 'email', label: 'Notificações por email', description: 'Receba resumos por email' },
                  { id: 'agentUpdates', label: 'Atualizações de agentes', description: 'Notificações sobre atividades dos agentes' },
                  { id: 'systemAlerts', label: 'Alertas do sistema', description: 'Alertas importantes do sistema' },
                ].map((notification) => (
                  <label
                    key={notification.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors"
                  >
                    <div>
                      <p className="font-medium">{notification.label}</p>
                      <p className="text-sm text-[var(--text-muted)]">{notification.description}</p>
                    </div>
                    <div className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      notifications[notification.id as keyof typeof notifications] ? 'bg-[var(--gold)]' : 'bg-white/20'
                    )}>
                      <div className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        notifications[notification.id as keyof typeof notifications] ? 'left-7' : 'left-1'
                      )} />
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'shortcuts' && (
            <Card>
              <CardHeader>
                <CardTitle>Atalhos de Teclado</CardTitle>
                <CardDescription>
                  Personalize os atalhos de teclado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { action: 'Abrir Command Palette', shortcut: '⌘K' },
                  { action: 'Nova conversa', shortcut: '⌘N' },
                  { action: 'Abrir Terminal', shortcut: '⌘T' },
                  { action: 'Navegar para Dashboard', shortcut: '⌘1' },
                  { action: 'Navegar para Chat', shortcut: '⌘2' },
                  { action: 'Navegar para Swarm', shortcut: '⌘3' },
                ].map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5"
                  >
                    <span className="text-sm">{shortcut.action}</span>
                    <kbd className="px-3 py-1.5 rounded-lg bg-white/10 text-sm font-mono">
                      {shortcut.shortcut}
                    </kbd>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integrações</CardTitle>
                  <CardDescription>
                    Conecte a Aura com outros serviços
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: 'Supabase', description: 'Banco de dados e autenticação', connected: true },
                    { name: 'GitHub', description: 'Integração com repositórios', connected: false },
                    { name: 'Vercel', description: 'Deploy automático', connected: true },
                    { name: 'Slack', description: 'Notificações no Slack', connected: false },
                  ].map((integration) => (
                    <div
                      key={integration.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5"
                    >
                      <div>
                        <p className="font-medium">{integration.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">{integration.description}</p>
                      </div>
                      <Badge variant={integration.connected ? 'green' : 'default'}>
                        {integration.connected ? 'Conectado' : 'Desconectado'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-400">
                    <Shield className="w-5 h-5" />
                    Zona de Perigo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <div>
                      <p className="font-medium text-red-400">Limpar todos os dados</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        Isso apagará todos os projetos e configurações
                      </p>
                    </div>
                    <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                      Limpar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
