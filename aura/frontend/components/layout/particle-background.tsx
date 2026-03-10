'use client';

import { useEffect, useRef } from 'react';
import { useAuraPreferences } from '@/components/providers/app-provider';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageLayerRef = useRef<HTMLDivElement>(null);
  const glowLayerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const { resolvedTheme, visuals } = useAuraPreferences();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    const particleCount = window.innerWidth < 768 ? 18 : 34;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: window.innerWidth * (0.45 + Math.random() * 0.22),
      y: window.innerHeight * (0.12 + Math.random() * 0.55),
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 2 + 0.5,
      color: Math.random() > 0.6 ? '#D4AF37' : '#00D4FF',
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const handlePointerMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      pointerRef.current = { x, y };
    };

    const animate = () => {
      frameCountRef.current++;

      if (visuals.animations && window.innerWidth >= 1024) {
        const { x, y } = pointerRef.current;
        if (imageLayerRef.current) {
          imageLayerRef.current.style.transform = `translate3d(${x * 18}px, ${y * 18}px, 0) scale(1.04)`;
        }
        if (glowLayerRef.current) {
          glowLayerRef.current.style.transform = `translate3d(${x * 28}px, ${y * 28}px, 0)`;
        }
      }
      
      // Render every 2nd frame for 30fps
      if (visuals.particles && frameCountRef.current % 2 === 0) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        particlesRef.current.forEach((particle, i) => {
          // Update position
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Boundary check with wrap
          const minX = window.innerWidth * 0.25;
          const maxX = window.innerWidth * 0.8;
          const minY = window.innerHeight * 0.05;
          const maxY = window.innerHeight * 0.9;
          if (particle.x < minX) particle.x = maxX;
          if (particle.x > maxX) particle.x = minX;
          if (particle.y < minY) particle.y = maxY;
          if (particle.y > maxY) particle.y = minY;

          // Draw particle with glow
          const gradient = ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size * 2
          );
          gradient.addColorStop(0, particle.color);
          gradient.addColorStop(1, 'transparent');
          
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.globalAlpha = particle.alpha * 0.3;
          ctx.fill();

          // Draw core
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = particle.alpha;
          ctx.fill();

          // Draw connections (limited for performance)
          if (i % 4 === 0) {
            particlesRef.current.slice(i + 1, i + 8).forEach((other) => {
              const dx = particle.x - other.x;
              const dy = particle.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 120) {
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(other.x, other.y);
                ctx.strokeStyle = particle.color;
                ctx.globalAlpha = 0.08 * (1 - distance / 120);
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            });
          }
        });
        
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handlePointerMove);
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [visuals.animations, visuals.particles]);

  return (
    <>
      <div className="fixed inset-0 -z-30 bg-[var(--bg-primary)]" />
      <div
        ref={imageLayerRef}
        className="pointer-events-none fixed inset-0 -z-20 will-change-transform transition-transform duration-300 ease-out"
        style={{
          backgroundImage: "url('/aura.png')",
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          opacity: resolvedTheme === 'dark' ? 0.38 : 0.28,
        }}
      />
      <div
        ref={glowLayerRef}
        className="pointer-events-none fixed inset-0 -z-20 opacity-90 will-change-transform transition-transform duration-300 ease-out"
        style={{
          background: resolvedTheme === 'dark'
            ? 'radial-gradient(circle at 52% 38%, rgba(0,212,255,0.22) 0%, rgba(0,212,255,0.08) 16%, transparent 36%), radial-gradient(circle at 46% 42%, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.09) 18%, transparent 40%), radial-gradient(circle at 50% 52%, rgba(255,255,255,0.12) 0%, transparent 28%)'
            : 'radial-gradient(circle at 52% 38%, rgba(0,212,255,0.12) 0%, rgba(0,212,255,0.05) 16%, transparent 36%), radial-gradient(circle at 46% 42%, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 18%, transparent 40%), radial-gradient(circle at 50% 52%, rgba(255,255,255,0.08) 0%, transparent 28%)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ opacity: visuals.particles ? 1 : 0 }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.02) 100%), repeating-linear-gradient(180deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 4px)',
          opacity: resolvedTheme === 'dark' ? 0.18 : 0.08,
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: resolvedTheme === 'dark'
            ? 'linear-gradient(180deg, rgba(4,8,18,0.78) 0%, rgba(7,11,22,0.64) 28%, rgba(10,10,15,0.72) 100%)'
            : 'linear-gradient(180deg, rgba(246,249,255,0.52) 0%, rgba(241,245,255,0.34) 24%, rgba(229,235,245,0.58) 100%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: resolvedTheme === 'dark'
            ? 'radial-gradient(circle at 50% 48%, transparent 0%, rgba(10,10,15,0.08) 34%, rgba(10,10,15,0.38) 100%)'
            : 'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.08) 0%, rgba(240,244,250,0.08) 34%, rgba(229,235,245,0.22) 100%)',
        }}
      />
    </>
  );
}
