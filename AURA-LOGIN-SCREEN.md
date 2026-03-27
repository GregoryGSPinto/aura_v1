# AURA — LOGIN SCREEN PREMIUM

**Rode DEPOIS do facelift terminar.**
**Objetivo:** Tela de login no padrão visual da Aura — a primeira impressão do software.
**NÃO mude lógica de autenticação.** Só o visual da página de login.

---

## ANTES DE TUDO

Leia estes arquivos:

```
~/Projetos/aura_v1/aura/frontend/app/login/page.tsx
~/Projetos/aura_v1/aura/frontend/app/globals.css
~/Projetos/aura_v1/aura/frontend/app/layout.tsx
~/Projetos/aura_v1/aura/frontend/lib/auth-store.ts (ou equivalente)
~/Projetos/aura_v1/aura/frontend/lib/api.ts
~/Projetos/aura_v1/aura/frontend/tailwind.config.ts
~/Projetos/aura_v1/aura/frontend/middleware.ts (se existir)
```

Entenda como o login funciona ANTES de tocar no visual. Mantenha todos os handlers (onSubmit, onChange, redirect). Mude APENAS o JSX e CSS.

---

## DESIGN DA TELA DE LOGIN

### Layout:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│          ── anéis orbitais animados ──            │
│                                                  │
│                     ✦                            │
│                                                  │
│                   AURA                           │
│            autonomous ai agent                   │
│                                                  │
│                                                  │
│        ┌────────────────────────────┐            │
│        │  👤  Usuário               │            │
│        └────────────────────────────┘            │
│        ┌────────────────────────────┐            │
│        │  🔒  Senha            👁   │            │
│        └────────────────────────────┘            │
│                                                  │
│        ┌────────────────────────────┐            │
│        │        CONECTAR            │            │
│        └────────────────────────────┘            │
│                                                  │
│          "devolvendo tempo à família"            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Background:
- Cor base: #0A0E1A (var(--aura-dark) se existir, senão hardcode)
- Gradiente radial sutil: `radial-gradient(ellipse at 50% 40%, rgba(0,212,170,0.04) 0%, transparent 70%)`
- 3 anéis orbitais decorativos (círculos concêntricos) atrás do form:
  - Raio ~200px, ~300px, ~400px (mobile: 150px, 220px, 300px)
  - Border: 1px solid rgba(0,212,170,0.03)
  - Animação: rotação muito lenta (60s, 90s, 120s linear infinite), um deles reverse
  - 2-3 dots orbitais de 3px em rgba(0,212,170,0.15) nos anéis
- Tudo em `pointer-events-none`, `position: absolute`, `z-index: 0`

### Símbolo ✦:
- Cor: #00D4AA
- Tamanho: 56px
- Glow: `filter: drop-shadow(0 0 40px rgba(0,212,170,0.2))`
- Animação: pulse sutil (opacity 0.7↔1, 3s, ease-in-out, infinite)

### Título "AURA":
- Font: system-ui ou a fonte display do projeto
- Weight: 200 (extralight)
- Size: 36px
- Letter-spacing: 12px
- Color: rgba(255,255,255,0.9)

### Subtítulo "autonomous ai agent":
- Font: monospace do projeto
- Size: 11px
- Letter-spacing: 4px
- Color: rgba(0,212,170,0.4)
- Lowercase
- Margin bottom: 48px

### Form container:
- Max-width: 320px
- Width: 100% (com padding 24px nos lados no mobile)
- Centralizado vertical e horizontal (`min-h-dvh flex items-center justify-center`)
- Background: transparente (os inputs têm próprio bg)

### Inputs:
- Width: 100%
- Height: 48px
- Background: rgba(255,255,255,0.03)
- Border: 1px solid rgba(255,255,255,0.06)
- Border hover: rgba(255,255,255,0.12)
- Border focus: rgba(0,212,170,0.3) + `box-shadow: 0 0 0 3px rgba(0,212,170,0.08)`
- Border-radius: 12px
- Padding: 0 16px 0 44px (espaço pro ícone)
- Font: 14px, rgba(255,255,255,0.8)
- Placeholder: rgba(255,255,255,0.2)
- Ícone esquerdo (user/lock): position absolute, left 14px, 16px, rgba(255,255,255,0.2)
- Input senha: botão toggle olho à direita (aberto/fechado), 16px, rgba(255,255,255,0.2)
- Gap entre inputs: 12px
- Transition: border-color 200ms, box-shadow 200ms
- **IMPORTANTE:** font-size 16px no mobile (previne zoom do Safari)

### Botão CONECTAR:
- Width: 100%
- Height: 48px
- Background: #00D4AA
- Color: #0A0E1A (texto escuro no botão verde)
- Font: 13px, weight 500, letter-spacing 3px, uppercase
- Border: none
- Border-radius: 12px
- Margin-top: 20px
- Cursor: pointer
- Hover: brightness(1.1) + `box-shadow: 0 0 30px rgba(0,212,170,0.2)`
- Active: scale(0.98)
- Loading state: texto vira spinner circular + "AUTENTICANDO..." (font-size 11px, tracking 2px)
- Disabled: opacity 0.4
- Transition: all 200ms ease

### Erro de login:
- Aparece abaixo do botão
- Background: rgba(239,68,68,0.08)
- Border: 1px solid rgba(239,68,68,0.2)
- Border-radius: 8px
- Padding: 10px 14px
- Font: 12px, color rgb(239,68,68)
- Animação: shake horizontal (translateX -3px → 3px → 0, 300ms) + fade in
- Auto-dismiss após 5 segundos (opcional)

### Tagline rodapé:
- "devolvendo tempo à família"
- Font: 12px, italic
- Color: rgba(255,255,255,0.12)
- Position: absolute, bottom 32px (mobile: `max(env(safe-area-inset-bottom), 24px)`)
- Text-align: center

### Animação de entrada (sequencial):
1. Background + anéis: imediato (anéis fade in 0→opacity final, 1s)
2. ✦: scale 0.5→1 + opacity 0→1, 600ms ease-out
3. "AURA": fade in + translateY(8px→0), 400ms, delay 200ms
4. Subtítulo: fade in, 300ms, delay 400ms
5. Form: fade in + translateY(12px→0), 400ms, delay 600ms
6. Tagline: fade in, 500ms, delay 800ms

Total ~1.5s. Rápido pra não irritar, lento pra impressionar.

Implementação sugerida com CSS classes:
```css
@keyframes entrance-symbol {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes entrance-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes entrance-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

.login-symbol { animation: entrance-symbol 600ms ease-out both; }
.login-title { animation: entrance-fade-up 400ms ease-out 200ms both; }
.login-subtitle { animation: entrance-fade 300ms ease-out 400ms both; }
.login-form { animation: entrance-fade-up 400ms ease-out 600ms both; }
.login-tagline { animation: entrance-fade 500ms ease-out 800ms both; }
.login-error { animation: shake 300ms ease-out, entrance-fade 200ms ease-out; }
.login-ring { animation: spin-slow var(--duration, 60s) linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .login-symbol, .login-title, .login-subtitle,
  .login-form, .login-tagline, .login-ring { animation: none !important; }
}
```

### Transição ao logar com sucesso:
- ✦ faz pulse forte (scale 1→1.2→1, opacity 1, 300ms)
- Form inteiro fade out (opacity 0, 300ms)
- Tela inteira fade to darker (400ms)
- Redirect acontece durante o fade (setTimeout 400ms)

### Estrutura JSX de referência (adapte ao que já existe):

```tsx
<div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden"
     style={{ background: '#0A0E1A' }}>
  
  {/* Radial glow */}
  <div className="absolute inset-0 pointer-events-none"
       style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,212,170,0.04) 0%, transparent 70%)' }} />
  
  {/* Orbital rings */}
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="absolute rounded-full border border-[rgba(0,212,170,0.03)] login-ring"
         style={{ width: 400, height: 400, '--duration': '60s' }} />
    <div className="absolute rounded-full border border-[rgba(0,212,170,0.02)] login-ring"
         style={{ width: 600, height: 600, '--duration': '90s' }} />
    <div className="absolute rounded-full border border-[rgba(0,212,170,0.015)] login-ring"
         style={{ width: 800, height: 800, '--duration': '120s', animationDirection: 'reverse' }} />
    {/* Orbital dots */}
    <div className="absolute login-ring" style={{ width: 400, height: 400, '--duration': '60s' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full"
           style={{ background: 'rgba(0,212,170,0.2)' }} />
    </div>
    <div className="absolute login-ring" style={{ width: 600, height: 600, '--duration': '90s' }}>
      <div className="absolute bottom-0 left-1/4 w-[3px] h-[3px] rounded-full"
           style={{ background: 'rgba(0,212,170,0.12)' }} />
    </div>
  </div>
  
  {/* Content */}
  <div className="relative z-10 flex flex-col items-center w-full px-6" style={{ maxWidth: 320 }}>
    
    {/* Symbol */}
    <span className="login-symbol text-[56px] mb-4"
          style={{ color: '#00D4AA', filter: 'drop-shadow(0 0 40px rgba(0,212,170,0.2))',
                   animation: 'entrance-symbol 600ms ease-out both, pulse-subtle 3s ease-in-out 1.5s infinite' }}>
      ✦
    </span>
    
    {/* Title */}
    <h1 className="login-title text-[36px] font-extralight tracking-[12px] mb-1"
        style={{ color: 'rgba(255,255,255,0.9)' }}>
      AURA
    </h1>
    
    {/* Subtitle */}
    <p className="login-subtitle font-mono text-[11px] tracking-[4px] lowercase mb-12"
       style={{ color: 'rgba(0,212,170,0.4)' }}>
      autonomous ai agent
    </p>
    
    {/* Form — KEEP EXISTING onSubmit/onChange HANDLERS */}
    <form onSubmit={/* keep existing */} className="login-form w-full space-y-3">
      
      {/* Username */}
      <div className="relative">
        <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}>👤</span>
        <input
          type="text"
          placeholder="Usuário"
          className="w-full h-12 pl-11 pr-4 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 16, /* prevent Safari zoom */
          }}
          /* KEEP EXISTING value/onChange */
        />
      </div>
      
      {/* Password */}
      <div className="relative">
        <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}>🔒</span>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Senha"
          className="w-full h-12 pl-11 pr-11 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 16,
          }}
          /* KEEP EXISTING value/onChange */
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px]"
                style={{ color: 'rgba(255,255,255,0.2)' }}>
          {showPassword ? '👁' : '👁‍🗨'}
        </button>
      </div>
      
      {/* Submit */}
      <button type="submit" disabled={isLoading}
              className="w-full h-12 rounded-xl text-[13px] font-medium tracking-[3px] uppercase transition-all duration-200 mt-5"
              style={{
                background: '#00D4AA',
                color: '#0A0E1A',
                opacity: isLoading ? 0.6 : 1,
              }}>
        {isLoading ? 'AUTENTICANDO...' : 'CONECTAR'}
      </button>
      
      {/* Error */}
      {error && (
        <div className="login-error rounded-lg p-3 mt-2 text-xs"
             style={{
               background: 'rgba(239,68,68,0.08)',
               border: '1px solid rgba(239,68,68,0.2)',
               color: 'rgb(239,68,68)',
             }}>
          {error}
        </div>
      )}
    </form>
  </div>
  
  {/* Tagline */}
  <p className="login-tagline absolute text-xs italic safe-bottom"
     style={{ bottom: 32, color: 'rgba(255,255,255,0.12)' }}>
    devolvendo tempo à família
  </p>
</div>
```

---

## REGRAS

1. NÃO mude a lógica de autenticação — endpoints, token handling, redirect
2. NÃO mude nomes de variáveis de estado (username, password, error, isLoading)
3. NÃO mude o middleware de proteção de rotas
4. Mantenha TODOS os event handlers existentes
5. Se o login já tem estilos inline, migre pra Tailwind classes onde possível
6. Se o login usa um componente de UI library, mantenha a library mas ajuste o visual
7. Animações respeitam prefers-reduced-motion
8. Input font-size 16px no mobile (prevenir zoom Safari)
9. min-h-dvh (não 100vh — fix pra Safari mobile)
10. Teste: `pnpm tsc --noEmit && pnpm build`
11. Commit e push:

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "✦ design: premium login screen — orbital rings, glassmorphism inputs, entrance animation"
git push
```
