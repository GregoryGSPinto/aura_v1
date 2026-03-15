import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'gold' | 'cyan' | 'none';
}

export function Card({ className, glow = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'shell-card rounded-[1.75rem] p-6 transition-[border-color,box-shadow,transform] duration-200',
        glow === 'gold' && 'hover:border-[color:color-mix(in_srgb,var(--warning)_26%,transparent)]',
        glow === 'cyan' && 'hover:border-[color:color-mix(in_srgb,var(--accent-secondary)_30%,transparent)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-center justify-between gap-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold tracking-[-0.03em] text-[var(--fg-primary)]', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--fg-muted)]', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4', className)} {...props} />;
}
