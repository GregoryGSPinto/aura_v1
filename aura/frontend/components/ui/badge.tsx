import { cn } from '@/lib/utils';

type BadgeVariant = 'gold' | 'cyan' | 'green' | 'red' | 'yellow' | 'purple' | 'default';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  gold: 'border-[color:color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]',
  cyan: 'border-[color:color-mix(in_srgb,var(--accent-secondary)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-secondary)_11%,transparent)] text-[var(--accent-secondary)]',
  green: 'border-[color:color-mix(in_srgb,var(--success)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_11%,transparent)] text-[var(--success)]',
  red: 'border-[color:color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_11%,transparent)] text-[var(--danger)]',
  yellow: 'border-[color:color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--warning)_11%,transparent)] text-[var(--warning)]',
  purple: 'border-[rgba(144,120,214,0.22)] bg-[rgba(144,120,214,0.12)] text-[rgb(132,114,204)]',
  default: 'border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,transparent)] text-[var(--fg-secondary)]',
};

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'idle' | 'running' | 'error';
  label?: string;
  pulse?: boolean;
}

const statusConfig = {
  online: { color: 'bg-green-500', label: 'Online' },
  offline: { color: 'bg-red-500', label: 'Offline' },
  busy: { color: 'bg-yellow-500', label: 'Ocupado' },
  idle: { color: 'bg-blue-500', label: 'Ocioso' },
  running: { color: 'bg-[var(--cyan)]', label: 'Executando' },
  error: { color: 'bg-red-500', label: 'Erro' },
};

export function StatusBadge({ status, label, pulse = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <div className="flex items-center gap-2">
      <span className={cn('relative flex h-2.5 w-2.5', pulse && status === 'online' && 'animate-pulse')}>
        {pulse && status === 'online' && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', config.color)} />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.color)} />
      </span>
      <span className="text-sm text-[var(--text-muted)]">{displayLabel}</span>
    </div>
  );
}
