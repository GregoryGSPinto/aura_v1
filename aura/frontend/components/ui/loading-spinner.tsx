import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: 'gold' | 'cyan' | 'white';
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
};

const colors = {
  gold: 'border-[var(--gold)]',
  cyan: 'border-[var(--cyan)]',
  white: 'border-white',
};

export function LoadingSpinner({ size = 'md', color = 'gold', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-transparent animate-spin',
        sizes[size],
        colors[color],
        className
      )}
      style={{
        borderTopColor: 'currentColor',
        boxShadow: color === 'gold' ? '0 0 10px rgba(212, 175, 55, 0.3)' : 
                   color === 'cyan' ? '0 0 10px rgba(0, 212, 255, 0.3)' : 'none',
      }}
    />
  );
}
