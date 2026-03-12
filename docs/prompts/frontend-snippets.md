# 🧩 Snippets de Código - Aura Frontend

Snippets prontos para copiar e colar durante a implementação.

---

## 🎨 Tema CSS (globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Cores Primárias */
  --gold: #D4AF37;
  --gold-light: #F4E4BC;
  --gold-dark: #8B7355;
  --cyan: #00D4FF;
  --cyan-deep: #0088AA;
  
  /* Backgrounds */
  --bg-primary: #0A0A0F;
  --bg-secondary: #0D1117;
  --bg-tertiary: #1A1D24;
  
  /* Textos */
  --text-primary: #FFFFFF;
  --text-secondary: #F0F0F0;
  --text-muted: #8B949E;
  
  /* Bordas */
  --border-subtle: rgba(212, 175, 55, 0.1);
  --border-default: rgba(212, 175, 55, 0.2);
  --border-focus: rgba(0, 212, 255, 0.5);
  
  /* Gradients */
  --gradient-gold: linear-gradient(135deg, #D4AF37 0%, #F4E4BC 50%, #D4AF37 100%);
  --gradient-cyan: linear-gradient(180deg, #00D4FF 0%, #0088AA 100%);
  --gradient-aura: linear-gradient(135deg, #D4AF37 0%, #00D4FF 100%);
  --gradient-space: radial-gradient(ellipse at top, #1A1D2E 0%, #0A0A0F 50%, #000000 100%);
}

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased;
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }
}

@layer components {
  /* Glassmorphism */
  .glass {
    @apply bg-[var(--bg-secondary)]/70 backdrop-blur-xl;
    border: 1px solid var(--border-subtle);
  }
  
  .glass-strong {
    @apply bg-[var(--bg-secondary)]/90 backdrop-blur-2xl;
    border: 1px solid var(--border-default);
  }
  
  /* Glow Effects */
  .glow-gold {
    box-shadow: 0 0 30px rgba(212, 175, 55, 0.3), 
                0 0 60px rgba(212, 175, 55, 0.1);
  }
  
  .glow-cyan {
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.4), 
                0 0 40px rgba(0, 212, 255, 0.2);
  }
  
  .glow-text-gold {
    text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
  }
  
  .glow-text-cyan {
    text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  }
  
  /* Scanlines Overlay */
  .scanlines::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    );
    pointer-events: none;
    z-index: 1;
  }
  
  /* Holographic Border */
  .holo-border {
    position: relative;
  }
  
  .holo-border::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: var(--gradient-aura);
    border-radius: inherit;
    z-index: -1;
    opacity: 0.5;
  }
  
  /* Animated Gradient Border */
  @keyframes border-rotate {
    0% { --angle: 0deg; }
    100% { --angle: 360deg; }
  }
  
  .animated-border {
    position: relative;
    background: var(--bg-secondary);
  }
  
  .animated-border::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: conic-gradient(from var(--angle, 0deg), var(--gold), var(--cyan), var(--gold));
    border-radius: inherit;
    z-index: -1;
    animation: border-rotate 4s linear infinite;
  }
  
  /* Button Primary Gold */
  .btn-gold {
    @apply px-6 py-3 rounded-xl font-semibold text-sm;
    background: var(--gradient-gold);
    color: #0A0A0F;
    transition: all 0.2s ease;
  }
  
  .btn-gold:hover {
    transform: scale(1.02);
    box-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
  }
  
  .btn-gold:active {
    transform: scale(0.98);
  }
  
  /* Button Secondary Cyan */
  .btn-cyan {
    @apply px-6 py-3 rounded-xl font-semibold text-sm;
    background: transparent;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    transition: all 0.2s ease;
  }
  
  .btn-cyan:hover {
    background: rgba(0, 212, 255, 0.1);
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }
  
  /* Card Styles */
  .card-aura {
    @apply rounded-2xl p-6;
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    transition: all 0.3s ease;
  }
  
  .card-aura:hover {
    border-color: var(--border-default);
    transform: translateY(-2px);
  }
  
  /* Status Indicators */
  .status-dot {
    @apply w-2 h-2 rounded-full;
  }
  
  .status-online {
    @apply bg-green-500;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  }
  
  .status-busy {
    @apply bg-yellow-500;
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
  }
  
  .status-offline {
    @apply bg-red-500;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  }
  
  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--bg-primary);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--border-default);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--gold-dark);
  }
}
```

---

## ⚛️ Componentes React

### Particle Background

```tsx
// components/layout/particle-background.tsx
'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    const particleCount = 40;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? '#D4AF37' : '#00D4FF',
    }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      // Render every 2nd frame for performance (30fps)
      if (frameCount % 2 === 0) {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particlesRef.current.forEach((particle, i) => {
          // Update position
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Boundary check
          if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

          // Draw particle
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = 0.6;
          ctx.fill();

          // Draw connections (only check every 5th particle for performance)
          if (i % 5 === 0) {
            particlesRef.current.slice(i + 1).forEach((other) => {
              const dx = particle.x - other.x;
              const dy = particle.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 100) {
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(other.x, other.y);
                ctx.strokeStyle = particle.color;
                ctx.globalAlpha = 0.1 * (1 - distance / 100);
                ctx.stroke();
              }
            });
          }
        });
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: 'var(--gradient-space)' }}
    />
  );
}
```

---

### Command Palette

```tsx
// components/layout/command-palette.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Bot, 
  Monitor, 
  FolderOpen, 
  Activity, 
  Settings,
  Search
} from 'lucide-react';

const commands = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/chat' },
  { id: 'swarm', label: 'Agent Swarm', icon: Bot, href: '/swarm' },
  { id: 'remote', label: 'Controle Remoto', icon: Monitor, href: '/remote' },
  { id: 'projects', label: 'Projetos', icon: FolderOpen, href: '/projects' },
  { id: 'system', label: 'Sistema', icon: Activity, href: '/system' },
  { id: 'settings', label: 'Configurações', icon: Settings, href: '/settings' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl mx-4 overflow-hidden rounded-2xl glass-strong glow-gold">
        <Command.Input
          placeholder="Digite um comando ou busque..."
          className="w-full px-6 py-4 bg-transparent border-none outline-none text-lg placeholder:text-gray-500"
        />
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="p-4 text-center text-gray-500">
            Nenhum comando encontrado
          </Command.Empty>
          
          <Command.Group heading="Navegação">
            {commands.map((cmd) => (
              <Command.Item
                key={cmd.id}
                onSelect={() => handleSelect(cmd.href)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 data-[selected=true]:bg-white/10"
              >
                <cmd.icon className="w-5 h-5 text-[var(--gold)]" />
                <span>{cmd.label}</span>
                <kbd className="ml-auto px-2 py-1 text-xs rounded bg-white/5 text-gray-400">
                  {cmd.id === 'dashboard' ? '⌘1' : ''}
                </kbd>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        
        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 border-t border-white/10">
          <div className="flex gap-4">
            <span>↑↓ para navegar</span>
            <span>↵ para selecionar</span>
          </div>
          <span>⌘K para abrir</span>
        </div>
      </div>
    </Command.Dialog>
  );
}
```

---

### Sidebar Navigation

```tsx
// components/layout/sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Monitor,
  FolderOpen,
  Activity,
  Settings,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/swarm', label: 'Swarm', icon: Bot, badge: 3 },
  { href: '/remote', label: 'Remoto', icon: Monitor },
  { href: '/projects', label: 'Projetos', icon: FolderOpen },
  { href: '/system', label: 'Sistema', icon: Activity },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl glass lg:hidden"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`fixed inset-y-0 left-0 z-40 w-72 glass-strong transform transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--cyan)] blur-lg opacity-50" />
            </div>
            <div>
              <h1 className="text-xl font-bold glow-text-gold">Aura</h1>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-[var(--gold)]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 w-1 h-8 bg-gradient-to-b from-[var(--gold)] to-[var(--cyan)] rounded-r-full"
                    />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-[var(--cyan)]/20 text-[var(--cyan)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status */}
          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-medium">Sistema Online</p>
                <p className="text-xs text-gray-500">3 agentes ativos</p>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
```

---

### Button Component

```tsx
// components/ui/button.tsx
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gold: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-black hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] active:scale-95',
        cyan: 'border border-[var(--cyan)] bg-transparent text-[var(--cyan)] hover:bg-[var(--cyan)]/10 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] active:scale-95',
        ghost: 'hover:bg-white/5 text-gray-300 hover:text-white',
        outline: 'border border-white/10 bg-transparent hover:bg-white/5 text-gray-300',
      },
      size: {
        default: 'h-11 px-6 py-2',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-8 text-lg',
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
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

### Card Component

```tsx
// components/ui/card.tsx
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'gold' | 'cyan' | 'none';
}

export function Card({ className, glow = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[var(--bg-secondary)] border border-white/10 p-6 transition-all duration-300',
        glow === 'gold' && 'hover:border-[var(--gold)]/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)]',
        glow === 'cyan' && 'hover:border-[var(--cyan)]/30 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]',
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
  return <h3 className={cn('text-lg font-semibold text-white', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}
```

---

### Status Badge

```tsx
// components/ui/status-badge.tsx
import { cn } from '@/lib/utils';

type Status = 'online' | 'offline' | 'busy' | 'warning';

interface StatusBadgeProps {
  status: Status;
  label?: string;
  pulse?: boolean;
}

const statusConfig = {
  online: { color: 'bg-green-500', shadow: 'shadow-green-500/50', label: 'Online' },
  offline: { color: 'bg-red-500', shadow: 'shadow-red-500/50', label: 'Offline' },
  busy: { color: 'bg-yellow-500', shadow: 'shadow-yellow-500/50', label: 'Ocupado' },
  warning: { color: 'bg-orange-500', shadow: 'shadow-orange-500/50', label: 'Atenção' },
};

export function StatusBadge({ status, label, pulse = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <div className="flex items-center gap-2">
      <span className={cn('relative flex h-2.5 w-2.5', pulse && status === 'online' && 'animate-pulse')}>
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', config.color, pulse && status === 'online' && 'animate-ping')} />
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.color, config.shadow)} />
      </span>
      <span className="text-sm text-gray-400">{displayLabel}</span>
    </div>
  );
}
```

---

### Loading Spinner

```tsx
// components/ui/loading-spinner.tsx
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-transparent border-t-[var(--gold)] animate-spin',
        sizes[size],
        className
      )}
      style={{
        boxShadow: '0 0 10px rgba(212, 175, 55, 0.3)',
      }}
    />
  );
}
```

---

## 🪝 Hooks Customizados

### useWebSocket

```typescript
// hooks/use-websocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket error occurred');
      };

      ws.onclose = () => {
        setIsConnected(false);
        
        // Attempt reconnection with exponential backoff
        if (reconnectCountRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * 2 ** reconnectCountRef.current, 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current += 1;
            connect();
          }, delay);
        }
      };
    } catch (e) {
      setError('Failed to create WebSocket connection');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  }, []);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, lastMessage, error, send };
}
```

---

### useSystemMetrics

```typescript
// hooks/use-system-metrics.ts
import { useState, useEffect, useCallback } from 'react';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    upload: number;
    download: number;
  };
  timestamp: string;
}

export function useSystemMetrics(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/system/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data: SystemMetrics = await response.json();
      setMetrics(data);
      setHistory((prev) => [...prev.slice(-59), data]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  return { metrics, history, isLoading, error, refetch: fetchMetrics };
}
```

---

## 📦 Configuração Tailwind

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F4E4BC',
          dark: '#8B7355',
        },
        cyan: {
          DEFAULT: '#00D4FF',
          deep: '#0088AA',
        },
        aura: {
          bg: '#0A0A0F',
          panel: '#0D1117',
          border: '#1A1D24',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)' },
          '100%': { boxShadow: '0 0 40px rgba(212, 175, 55, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #F4E4BC 50%, #D4AF37 100%)',
        'gradient-cyan': 'linear-gradient(180deg, #00D4FF 0%, #0088AA 100%)',
        'gradient-aura': 'linear-gradient(135deg, #D4AF37 0%, #00D4FF 100%)',
        'gradient-space': 'radial-gradient(ellipse at top, #1A1D2E 0%, #0A0A0F 50%, #000000 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 🎬 Animações Framer Motion

```typescript
// lib/animations.ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  },
};

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.2 }
  },
};

export const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(212, 175, 55, 0.2)',
      '0 0 40px rgba(212, 175, 55, 0.4)',
      '0 0 20px rgba(212, 175, 55, 0.2)',
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};
```

---

## 🔧 Utilitários

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

---

**Copie, cole e adapte conforme necessário! 🚀**
