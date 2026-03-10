import { cn } from '@/lib/utils';

type BadgeVariant = 'gold' | 'cyan' | 'green' | 'red' | 'yellow' | 'default';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  gold: 'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20',
  cyan: 'bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  default: 'bg-white/5 text-[var(--text-muted)] border-white/10',
};

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
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
