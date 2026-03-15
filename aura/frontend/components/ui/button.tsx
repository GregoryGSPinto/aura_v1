'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-[background,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent-primary)_35%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gold: 'border border-[color:color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[linear-gradient(135deg,var(--accent-primary-strong),var(--accent-secondary))] text-white shadow-[0_12px_30px_rgba(88,118,196,0.25)] hover:brightness-105 active:scale-[0.99]',
        cyan: 'border border-[var(--border-strong)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_86%,transparent)] text-[var(--fg-primary)] hover:bg-[color:color-mix(in_srgb,var(--bg-accent-soft)_60%,var(--bg-surface-soft))] hover:border-[color:color-mix(in_srgb,var(--accent-secondary)_38%,transparent)]',
        ghost: 'bg-transparent text-[var(--fg-muted)] hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,transparent)] hover:text-[var(--fg-primary)]',
        outline: 'border border-[var(--border-default)] bg-transparent text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,transparent)] hover:text-[var(--fg-primary)]',
        secondary: 'border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,transparent)] text-[var(--fg-secondary)] hover:border-[var(--border-default)] hover:bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_100%,transparent)] hover:text-[var(--fg-primary)]',
      },
      size: {
        default: 'h-11 px-5 py-2 text-sm',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'secondary',
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
