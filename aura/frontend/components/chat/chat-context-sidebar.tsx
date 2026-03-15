'use client';

import { AlertTriangle, Bot, ChevronLeft, ChevronRight, Cloud, Gauge, Radio, Sparkles } from 'lucide-react';

import { ChatModeSelector } from '@/components/chat/mode-selector';
import { ChatStatusBadges } from '@/components/chat/status-badges';
import { useAuraPreferences } from '@/components/providers/app-provider';
import { getAuraChatMode, type AuraChatModeId } from '@/lib/chat-modes';
import { clientEnv } from '@/lib/env';
import { cn } from '@/lib/utils';

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">{label}</span>
      <span className="truncate text-right text-sm text-[var(--fg-primary)]">{value}</span>
    </div>
  );
}

export function ChatContextSidebar({
  collapsed,
  onToggleCollapse,
  selectedModeId,
  onSelectMode,
  warning,
  mobile = false,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedModeId: AuraChatModeId;
  onSelectMode: (modeId: AuraChatModeId) => void;
  warning: string | null;
  mobile?: boolean;
}) {
  const { runtimeStatus } = useAuraPreferences();
  const selectedMode = getAuraChatMode(selectedModeId);
  const backendOnline = runtimeStatus?.services.api === 'online' && runtimeStatus?.status !== 'offline';
  const sessionLabel = backendOnline ? 'Sincronizada' : 'Local';
  const modelLabel = runtimeStatus?.ollama?.model ?? runtimeStatus?.model ?? 'qwen3.5:9b';
  const versionLabel = runtimeStatus?.version ?? '5.x';

  return (
    <aside className={cn(mobile ? 'block w-full' : 'hidden xl:block', !mobile && (collapsed ? 'w-[88px]' : 'w-[292px]'))}>
      <div className="sticky top-24">
        <div className="shell-panel rounded-[2rem] p-3.5">
          <div className="shell-card flex items-center justify-between gap-3 rounded-[1.6rem] px-3.5 py-3.5">
            <div className={cn('flex min-w-0 items-center gap-3', collapsed && 'justify-center')}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border border-[var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_26%,transparent),color-mix(in_srgb,var(--accent-secondary)_16%,transparent))]">
                <Sparkles className="h-5 w-5 text-[var(--fg-primary)]" />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fg-subtle)]">Aura</p>
                  <p className="truncate text-sm font-medium text-[var(--fg-primary)]">Assistente operacional</p>
                  <p className="pt-1 text-xs text-[var(--fg-muted)]">Runtime discreto, estado claro e foco em conversa.</p>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] text-[var(--fg-muted)] transition hover:border-[var(--border-default)] hover:text-[var(--fg-primary)]"
              aria-label={collapsed ? 'Expandir barra lateral de contexto' : 'Recolher barra lateral de contexto'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!collapsed ? (
            <>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Status e sessao</p>
                  <div className="mt-3">
                    <ChatStatusBadges compact />
                  </div>
                </div>

                <div className="space-y-2">
                  <InfoRow label="Runtime" value={backendOnline ? 'Backend online' : 'Backend offline'} />
                  <InfoRow label="Sessao" value={sessionLabel} />
                  <InfoRow label="Modelo" value={modelLabel} />
                  <InfoRow label="Versao" value={versionLabel} />
                  <InfoRow label="API" value={clientEnv.apiUrl || 'Nao configurada'} />
                </div>
              </div>

              <div className="shell-card mt-4 rounded-[1.5rem] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)]">
                    <Gauge className="h-4 w-4 text-[var(--fg-secondary)]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--fg-subtle)]">Modo atual</p>
                    <p className="pt-1 text-sm font-medium text-[var(--fg-primary)]">{selectedMode.label}</p>
                    <p className="pt-1 text-sm leading-6 text-[var(--fg-muted)]">{selectedMode.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <ChatModeSelector selectedModeId={selectedModeId} onSelectMode={onSelectMode} />
              </div>

              {warning ? (
                <div className="mt-4 rounded-[1.4rem] border border-amber-400/20 bg-amber-400/8 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">Diagnostico local</p>
                      <p className="pt-1 text-sm leading-6 text-[var(--fg-primary)]">{warning}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 space-y-3">
              {[
                { icon: Cloud, tone: backendOnline ? 'bg-emerald-400' : 'bg-amber-400', label: 'Backend' },
                { icon: Radio, tone: backendOnline ? 'bg-emerald-400' : 'bg-amber-400', label: 'Sessao' },
                { icon: Bot, tone: 'bg-sky-400', label: 'Modelo' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex h-11 items-center justify-center rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)]"
                    title={item.label}
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4 text-[var(--fg-secondary)]" />
                      <span className={cn('absolute -right-1 -top-1 h-2 w-2 rounded-full', item.tone)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
