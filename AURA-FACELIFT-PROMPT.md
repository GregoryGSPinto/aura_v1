# AURA — FACELIFT COMPLETO: UI PREMIUM MOBILE + DESKTOP

**Objetivo:** Transformar a UI da Aura de "dev funcional" em "produto premium que impressiona".
**Design direction:** Calm Intelligence — dark mode, glassmorphism sutil, tipografia refinada, micro-animações intencionais. Estética inspirada em Arc Browser + Linear + Apple Intelligence. NÃO é chatbot genérico — é um cockpit de IA pessoal.

---

## ANTES DE TUDO

Leia TODOS estes arquivos antes de modificar qualquer coisa:

```
~/Projetos/aura_v1/aura/frontend/app/layout.tsx
~/Projetos/aura_v1/aura/frontend/app/chat/page.tsx (ou equivalente)
~/Projetos/aura_v1/aura/frontend/app/globals.css (ou equivalente de estilos globais)
~/Projetos/aura_v1/aura/frontend/components/ (TODOS os componentes)
~/Projetos/aura_v1/aura/frontend/components/layout/ (TopBar, Sidebar, AppShell, etc)
~/Projetos/aura_v1/aura/frontend/components/chat/ (todos os componentes de chat)
~/Projetos/aura_v1/aura/frontend/lib/ (stores, api, types)
~/Projetos/aura_v1/aura/frontend/tailwind.config.ts (ou .js)
~/Projetos/aura_v1/aura/frontend/package.json
```

**REGRA ABSOLUTA:** NÃO quebre funcionalidade. Isso é facelift visual — a lógica (API calls, stores, hooks) NÃO muda. Só aparência, layout, animações, tipografia, e responsividade.

---

## 1. DESIGN TOKENS (fundação visual)

### Modifique: `tailwind.config.ts` e/ou `globals.css`

Adicione/ajuste estes tokens (NÃO remova os existentes, ESTENDA):

```css
:root {
  /* Aura brand */
  --aura-green: #00D4AA;
  --aura-green-dim: rgba(0, 212, 170, 0.15);
  --aura-green-glow: rgba(0, 212, 170, 0.08);
  --aura-dark: #0A0E1A;
  --aura-surface: #111827;
  --aura-surface-elevated: #1a2235;
  --aura-border: rgba(255, 255, 255, 0.06);
  --aura-border-hover: rgba(255, 255, 255, 0.12);
  
  /* Typography */
  --font-display: 'SF Pro Display', 'Inter', system-ui, sans-serif;
  --font-body: 'SF Pro Text', 'Inter', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Glassmorphism */
  --glass-bg: rgba(17, 24, 39, 0.75);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 20px;
  
  /* Spacing rhythm */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Glassmorphism utility */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
}

/* Glow accent */
.glow-green {
  box-shadow: 0 0 20px rgba(0, 212, 170, 0.15), 
              0 0 60px rgba(0, 212, 170, 0.05);
}

/* Smooth scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { 
  background: rgba(255,255,255,0.1); 
  border-radius: 3px; 
}
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* Safe area for iPhone notch/home indicator */
.safe-bottom {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
}
.safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}
```

---

## 2. TOPBAR REFINADO

### Modifique o componente TopBar/Header existente

Design target:
```
┌─────────────────────────────────────────────────┐
│ [≡]  ✦ Aura              🟢 Qwen · 4.2GB  [⚙] │
└─────────────────────────────────────────────────┘
```

Especificações:
- Altura: 48px
- Background: `glass` (blur + transparência, NÃO opaco)
- Border-bottom: 1px solid var(--aura-border)
- O ✦ é o mark da Aura em var(--aura-green), 18px, com pulse sutil quando processando
- "Aura" em font-display, weight 300, letter-spacing 2px, 16px
- Engine status à direita: dot + texto em font-mono, 11px, opacity 0.6
- Mobile: esconder texto do engine, mostrar só o dot
- Transição suave ao mudar de status (fade, não jump)

```tsx
// Pseudo-código do layout:
<header className="glass safe-top h-12 flex items-center px-4 border-b border-white/[0.06] sticky top-0 z-50">
  {/* Hamburger (mobile only) */}
  <button className="lg:hidden w-8 h-8 ...">≡</button>
  
  {/* Brand */}
  <div className="flex items-center gap-2 ml-2">
    <span className="text-[--aura-green] text-lg animate-pulse-subtle">✦</span>
    <span className="font-light tracking-widest text-sm text-white/90">AURA</span>
  </div>
  
  {/* Spacer */}
  <div className="flex-1" />
  
  {/* Engine status */}
  <div className="hidden sm:flex items-center gap-2 mr-3">
    <div className={`w-2 h-2 rounded-full ${engineRunning ? 'bg-green-400' : 'bg-zinc-600'}`} />
    <span className="font-mono text-[11px] text-white/40">
      {engineRunning ? `Qwen · ${memoryMB}MB` : 'Motor off'}
    </span>
  </div>
  
  {/* Settings */}
  <button className="w-8 h-8 rounded-lg hover:bg-white/5 ...">⚙</button>
</header>
```

---

## 3. CHAT AREA — O CORE

### Modifique os componentes de chat existentes

#### 3.1 — Container do chat
- Background: var(--aura-dark) sólido, SEM padrões
- Scroll: `overflow-y: auto`, scrollbar thin (6px, transparente)
- Padding: 16px horizontal mobile, 24px desktop, max-width 768px centralizado
- `flex-col-reverse` no scroll container (padrão WhatsApp/iMessage — novas mensagens sempre visíveis)

#### 3.2 — Bolhas de mensagem

**Mensagem do Gregory (direita):**
```
Background: var(--aura-green-dim) — verde muito sutil
Border: 1px solid rgba(0, 212, 170, 0.12)
Border-radius: 16px 16px 4px 16px (canto inferior direito mais agudo)
Text: white/90
Font: 14px, line-height 1.6
Max-width: 80% desktop, 85% mobile
Padding: 12px 16px
```

**Mensagem da Aura (esquerda):**
```
Background: var(--aura-surface-elevated)
Border: 1px solid var(--aura-border)
Border-radius: 16px 16px 16px 4px (canto inferior esquerdo mais agudo)
Text: white/80
Font: 14px, line-height 1.6
Max-width: 80% desktop, 85% mobile
Padding: 12px 16px
```

**Tool call blocks (dentro da mensagem da Aura):**
```
Background: rgba(0, 0, 0, 0.2)
Border: 1px solid var(--aura-border)
Border-radius: 8px
Margin: 8px 0
Padding: 10px 12px
Font: mono, 12px

Ícone da tool + nome em white/50
Resultado colapsável (click to expand)
Cor de status: verde (✅), vermelho (❌), amarelo (⏳)
```

**Loading indicator (Aura pensando):**
```
Três dots animados em var(--aura-green), 8px cada
Animação: bounce sequencial (200ms delay entre dots)
Aparece DENTRO de uma bolha da Aura (não flutuante)
```

#### 3.3 — Timestamps
- Entre grupos de mensagens (>5min gap): timestamp centralizado
- Font: mono, 10px, white/20
- Formato: "Hoje, 22:30" ou "Ontem, 14:15"
- Divider lines: 1px solid var(--aura-border) nas laterais

---

## 4. COMPOSER (input de mensagem)

### Modifique o componente de input existente

Design target (mobile):
```
┌──────────────────────────────────────────┐
│ [📎] [🎤]  Fale com a Aura...      [➤]  │
└──────────────────────────────────────────┘
```

Especificações:
- Container: `glass` + `safe-bottom` (iPhone home indicator)
- Border-top: 1px solid var(--aura-border)
- Padding: 12px 16px
- Textarea com auto-resize (1 linha → até 4 linhas)
- Placeholder: "Fale com a Aura..." em white/25, font-body 14px
- Background do textarea: transparent (herda do glass container)

**Botões:**
- Attachment (📎): 36px circle, bg transparent, hover bg-white/5
- Voice (🎤): 36px circle, bg transparent, hover bg-white/5
  - Quando gravando: bg var(--aura-green-dim), border var(--aura-green), pulse animation
  - Indicador de voz: barra acima do composer com waveform/pulsing dot + "Ouvindo..."
- Send (➤): 36px circle, bg var(--aura-green), text dark
  - Só aparece quando tem texto digitado (transition: scale + opacity)
  - Disabled state: opacity 0.3

**Attachment preview (quando arquivo selecionado):**
- Card acima do textarea: nome + tamanho + ícone tipo + botão ✕
- Background: var(--aura-surface)
- Border-radius: 8px
- Animação de entrada: slide up + fade

---

## 5. SIDEBAR ESQUERDA (conversas)

### Modifique o componente de sidebar/drawer existente

**Desktop (>1024px):**
- Width: 260px, collapsible to 0 (toggle via hamburger)
- Background: glass
- Border-right: 1px solid var(--aura-border)
- Lista de conversas: título truncado + data relativa
- Hover: bg-white/5, transição 150ms
- Conversa ativa: bg-white/8, border-left 2px solid var(--aura-green)
- Botão "Nova conversa": topo, border dashed, hover solid

**Mobile (<1024px):**
- Drawer overlay: fixed, bg-black/50 backdrop-blur-sm
- Drawer panel: 280px, slide from left, glass background
- Swipe to close (se já implementado, manter)
- Fechar ao clicar no overlay

---

## 6. APPROVAL BANNER (ações L2)

### Modifique o ApprovalBanner existente

Quando há ações pendentes de aprovação:

```
┌─────────────────────────────────────────────────┐
│ 🔔 1 ação aguardando aprovação                  │
│                                                 │
│ 🔀 git push origin main                        │
│                        [Rejeitar] [✓ Aprovar]   │
└─────────────────────────────────────────────────┘
```

- Position: sticky, abaixo do TopBar
- Background: rgba(234, 179, 8, 0.08) (amarelo sutil)
- Border: 1px solid rgba(234, 179, 8, 0.2)
- Border-radius: 12px
- Margin: 8px 16px
- Botão Aprovar: bg var(--aura-green), text dark, rounded-full
- Botão Rejeitar: bg transparent, border white/20, text white/60
- Animação de entrada: slide down + fade
- Animação ao aprovar/rejeitar: scale down + fade out

---

## 7. MICRO-ANIMAÇÕES

### Adicione ao globals.css ou equivalente:

```css
/* Pulse sutil no ✦ da Aura */
@keyframes pulse-subtle {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 0.6; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s ease-in-out infinite;
}

/* Bounce dots (loading) */
@keyframes bounce-dot {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

/* Fade in up (mensagens novas) */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 300ms ease-out;
}

/* Scale in (botão send aparecendo) */
@keyframes scale-in {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Slide in from left (sidebar) */
@keyframes slide-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Respeitar preferência de reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Em cada mensagem nova no chat:
- Adicionar classe `animate-fade-in-up` ao montar
- Remover após animação (300ms)

---

## 8. RESPONSIVIDADE MOBILE

### Breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Regras mobile-specific:
- TopBar: esconder texto de engine status, mostrar só dot
- Sidebar: drawer overlay (nunca visível por padrão)
- Chat: padding 12px, bolhas max-width 88%
- Composer: safe-bottom para iPhone, botões 40px touch targets
- Fontes: base 14px (não 13px — legibilidade)
- Nenhum hover effect no mobile (touch devices)

### iPhone safe areas:
```css
/* Layout principal */
.app-shell {
  min-height: 100dvh; /* dynamic viewport height — adapta à barra do Safari */
  padding-top: env(safe-area-inset-top);
}

/* Composer */
.composer {
  padding-bottom: max(env(safe-area-inset-bottom), 16px);
}
```

### Prevenir bugs comuns no Safari iOS:
```css
/* Prevenir zoom em inputs */
input, textarea, select {
  font-size: 16px !important; /* Safari faz zoom se < 16px */
}

/* Prevenir bounce scroll */
html, body {
  overscroll-behavior: none;
}

/* 100vh fix para Safari */
.full-height {
  height: 100dvh;
}
```

---

## 9. EMPTY STATE (chat vazio)

Quando não há mensagens, mostrar:

```
                  ✦
            
         Fale ou digite
        para começar.
     
    Estou aqui pra te dar
         mais tempo.
```

- ✦ em var(--aura-green), 48px, com glow sutil
- Texto em white/30, font-display, 16px, text-center
- Tagline menor em white/15, 13px
- Posição: centralizado vertical e horizontal no chat area
- Fade out suave quando primeira mensagem é enviada

---

## 10. TESTES VISUAIS

Após implementar tudo:

1. **Desktop Chrome:** Verificar todos os componentes em 1440px
2. **Mobile Safari (iPhone):** Verificar via ngrok
   - Safe areas funcionando (notch, home indicator)
   - Teclado não esconde o composer
   - Scroll suave no chat
   - Botão de voz acessível com o teclado aberto
3. **TypeScript:** `pnpm tsc --noEmit` sem erros
4. **Build:** `pnpm build` sem erros
5. **Commit e push:**

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "✨ design: premium UI facelift — glassmorphism, animations, mobile-first, Aura brand"
git push
```

---

## REGRAS FINAIS

1. NÃO mude lógica de negócio — só visual
2. NÃO instale novas dependências de UI (nada de shadcn, radix, headless) — use Tailwind puro
3. NÃO mude nomes de componentes ou props — só o JSX/CSS interno
4. MANTENHA todos os event handlers existentes (onClick, onChange, onSubmit)
5. Se um componente já tem glassmorphism, REFINE em vez de reescrever
6. Todas as cores devem usar CSS variables (não hex hardcoded no JSX)
7. Animações respeitam `prefers-reduced-motion`
8. Touch targets mínimo 44px no mobile
9. Font-size mínimo 14px no corpo, 11px em labels mono
10. Rode build no final — NÃO entregue com erros
