import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'gold' | 'cyan' | 'none';
}

export function Card({ className, glow = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 transition-all duration-300',
        glow === 'gold' && 'hover:border-[var(--gold)]/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)]',
        glow === 'cyan' && 'hover:border-[var(--cyan)]/20 hover:shadow-[0_0_30px_rgba(0,212,255,0.08)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-[var(--text-primary)]', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--text-muted)]', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-white/5', className)} {...props} />;
}
