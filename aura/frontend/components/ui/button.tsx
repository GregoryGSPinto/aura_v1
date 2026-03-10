'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gold: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-black hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] active:scale-95',
        cyan: 'border border-[var(--cyan)] bg-transparent text-[var(--cyan)] hover:bg-[var(--cyan)]/10 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] active:scale-95',
        ghost: 'hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        outline: 'border border-white/10 bg-transparent hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        secondary: 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10',
      },
      size: {
        default: 'h-11 px-6 py-2 text-sm',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'gold',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
