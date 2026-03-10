# 🚀 Prompt Completo: Frontend Aura v1 - Interface Futurista

## 📋 Visão Geral

Crie um frontend **espetacular** para a Aura, uma assistente operacional pessoal com identidade visual sci-fi futurista, inspirada em Minority Report + Jarvis (Iron Man) + Apple Design.

---

## 🎨 Identidade Visual

### Paleta de Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| **Dourado Primário** | `#D4AF37` | Destaques, botões primários, ícones ativos |
| **Dourado Claro** | `#F4E4BC` | Textos importantes, hover states |
| **Dourado Escuro** | `#8B7355` | Bordas sutis, estados inativos |
| **Ciano Neon** | `#00D4FF` | Hologramas, partículas, acentos tecnológicos |
| **Ciano Profundo** | `#0088AA` | Gradientes, sombras |
| **Branco Puro** | `#FFFFFF` | Textos principais, contraste máximo |
| **Branco Off** | `#F0F0F0` | Textos secundários |
| **Preto Espacial** | `#0A0A0F` | Background principal |
| **Preto Azulado** | `#0D1117` | Cards, painéis |
| **Cinza Escuro** | `#1A1D24` | Bordas, divisores |
| **Cinza Médio** | `#2D3139` | Elementos inativos |

### Gradientes Principais

```css
/* Gradiente Dourado Holográfico */
--gradient-gold: linear-gradient(135deg, #D4AF37 0%, #F4E4BC 50%, #D4AF37 100%);

/* Gradiente Ciano Energia */
--gradient-cyan: linear-gradient(180deg, #00D4FF 0%, #0088AA 100%);

/* Gradiente Aura (Combinação) */
--gradient-aura: linear-gradient(135deg, #D4AF37 0%, #00D4FF 100%);

/* Background Espacial */
--gradient-space: radial-gradient(ellipse at top, #1A1D2E 0%, #0A0A0F 50%, #000000 100%);
```

### Tipografia

| Uso | Fonte | Fallback |
|-----|-------|----------|
| **Display/Títulos** | Space Grotesk | system-ui, sans-serif |
| **Body/Texto** | Inter | system-ui, sans-serif |
| **Monospace/Código** | JetBrains Mono | monospace |
| **Números/Dados** | Roboto Mono | monospace |

### Efeitos Visuais

#### Glassmorphism
```css
.glass {
  background: rgba(13, 17, 23, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(212, 175, 55, 0.1);
}
```

#### Glow Effects
```css
.glow-gold {
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.3), 
              0 0 60px rgba(212, 175, 55, 0.1);
}

.glow-cyan {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4), 
              0 0 40px rgba(0, 212, 255, 0.2);
}
```

#### Scanlines (Overlay sutil)
```css
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
}
```

---

## 🏗️ Arquitetura do Frontend

### Stack Tecnológico

```
Next.js 15 (App Router)
├── TypeScript 5
├── Tailwind CSS 4
├── Framer Motion (animações 60fps)
├── Recharts (gráficos)
├── Lucide React (ícones)
├── Zustand (estado global)
├── TanStack Query (dados/cache)
├── Sonner (toast notifications)
├── cmdk (command palette)
└── @radix-ui/* (componentes acessíveis)
```

### Estrutura de Diretórios

```
app/
├── page.tsx                    # Dashboard principal
├── layout.tsx                  # Root layout com providers
├── globals.css                 # Estilos globais + tema
├── chat/
│   └── page.tsx               # Interface de chat
├── swarm/
│   └── page.tsx               # Controle de agentes autônomos ⭐
├── remote/
│   └── page.tsx               # Controle remoto do Mac
├── projects/
│   └── page.tsx               # Gerenciamento de projetos
├── system/
│   └── page.tsx               # Monitoramento de sistema
└── settings/
    └── page.tsx               # Configurações

components/
├── ui/                        # Componentes base (shadcn-like)
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── tooltip.tsx
│   └── ...
├── layout/                    # Componentes de layout
│   ├── sidebar.tsx
│   ├── header.tsx
│   ├── particle-background.tsx
│   └── command-palette.tsx
├── dashboard/                 # Widgets do dashboard
│   ├── status-widget.tsx
│   ├── projects-widget.tsx
│   ├── system-metrics.tsx
│   └── recent-activity.tsx
├── swarm/                     # Componentes do Agent Swarm
│   ├── agent-card.tsx
│   ├── swarm-visualizer.tsx
│   ├── task-queue.tsx
│   └── agent-logs.tsx
└── chat/                      # Componentes de chat
    ├── message-list.tsx
    ├── message-input.tsx
    └── code-block.tsx

hooks/
├── use-websocket.ts
├── use-system-metrics.ts
├── use-agents.ts
└── use-command-palette.ts

lib/
├── api.ts                     # Cliente HTTP
├── utils.ts                   # Utilitários
├── constants.ts               # Constantes
└── types.ts                   # Tipos TypeScript

stores/
├── app-store.ts              # Estado global
└── theme-store.ts            # Tema escuro/claro/neon
```

---

## 📱 Páginas e Funcionalidades

### 1. `/` Dashboard (Home)

**Layout:**
- Grid de widgets responsivo (1 col mobile, 2 col tablet, 3 col desktop)
- Partículas animadas no background
- Status geral do sistema em tempo real

**Widgets:**
| Widget | Conteúdo |
|--------|----------|
| **Status Aura** | Online/Offline, versão, uptime |
| **LLM Status** | Modelo ativo, temperatura, tokens/min |
| **Projetos Ativos** | Lista dos 5 projetos mais recentes |
| **Métricas do Sistema** | CPU, RAM, Disco (gráficos em tempo real) |
| **Agentes Ativos** | Contagem de agentes swarm em execução |
| **Atividade Recente** | Últimas ações executadas |

**Animações:**
- Widgets fade-in com stagger (0.1s entre cada)
- Hover: scale(1.02) + glow suave
- Gráficos: animação de entrada draw()

---

### 2. `/swarm` ⭐ Agent Swarm Control (DESTAQUE)

**Esta é a página mais importante - deve ser ESPECTACULAR!**

**Layout:**
- Visualização central tipo "constelação" ou "neural network"
- Sidebar esquerda: lista de agentes
- Painel direito: detalhes e logs do agente selecionado

**Visualização Principal:**
```
┌─────────────────────────────────────────────────────┐
│  [Agentes]                                          │
│  ┌──────────┐    ╭────────╮                         │
│  │ Builder  │────│        │────╮                     │
│  │  ●─────  │    │ Master │    │                     │
│  └──────────┘    │   ★    │    │                     │
│       │          ╰────────╯    │                     │
│       │              │         │                     │
│  ┌──────────┐        │    ╭────────╮                 │
│  │  GitOps  │────────┼────│ Review │                 │
│  │  ●─────  │        │    │   ●    │                 │
│  └──────────┘        │    ╰────────╯                 │
│                      │                               │
│                 ╭────────╮                           │
│                 │ Deploy │                           │
│                 │   ●    │                           │
│                 ╰────────╯                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Elementos Visuais:**
- Nós (agentes): Círculos com ícones, glow dourado quando ativo, ciano quando processando
- Conexões: Linhas animadas (stroke-dashoffset) mostrando fluxo de dados
- Partículas: Pontos de luz viajando pelas conexões
- HUD: Dados em tempo real ao redor da visualização

**Funcionalidades:**
- Criar novo agente (modal)
- Iniciar/Parar agente
- Ver logs em tempo real (WebSocket)
- Ajustar parâmetros do swarm
- Visualização de tasks em fila

---

### 3. `/chat` Interface de Chat

**Layout:**
- Full-height chat interface
- Sidebar esquerda: histórico de conversas
- Área central: mensagens
- Input fixo no rodapé

**Features:**
- Mensagens com syntax highlighting para código
- Markdown rendering
- Animação de "digitando..."
- Anexar arquivos (drag & drop)
- Atalhos de comando (/project, /command, /agent)

**Estilo das Mensagens:**
- Usuário: Alinhado direita, fundo gradient dourado, texto escuro
- Aura: Alinhado esquerda, fundo glassmorphism, borda ciano sutil
- Código: Tema dark, fonte monospace, botão copiar

---

### 4. `/remote` Controle Remoto

**Abas:**
1. **Terminal** - Terminal web integrado (xterm.js)
2. **Aplicações** - Controle de apps do Mac (abrir/fechar)
3. **Arquivos** - Navegador de arquivos remoto
4. **Clipboard** - Histórico do clipboard compartilhado

**Estilo:**
- Terminal: Tema escuro, fonte monospace, cursor piscando
- Apps: Grid com ícones, estado ativo/inativo
- Arquivos: Tree view com ícones por tipo

---

### 5. `/projects` Gerenciamento de Projetos

**Layout:**
- Grid de cards de projetos
- Filtros por tipo (Python, JS, etc)
- Barra de busca com autocomplete

**Card de Projeto:**
- Nome e descrição
- Badge do framework
- Status do Git (branch, commits não pushados)
- Ações rápidas (abrir, git status, deploy)
- Última modificação

---

### 6. `/system` Monitoramento

**Widgets:**
- CPU Usage (gráfico de área em tempo real)
- Memory Usage (gauge + histórico)
- Disk Usage (barras horizontais por volume)
- Network (upload/download em tempo real)
- Processos (lista ordenada por CPU/memória)

**Estilo:**
- Gráficos com cores do tema (dourado/ciano)
- Animações suaves de atualização
- Alertas visuais quando thresholds ultrapassados

---

### 7. `/settings` Configurações

**Seções:**
1. **Geral** - Idioma, tema, notificações
2. **LLM** - Modelo padrão, temperatura, timeout
3. **Integrações** - Supabase, GitHub, Vercel
4. **Atalhos** - Configuração de hotkeys
5. **Sobre** - Versão, changelog, diagnóstico

---

## 🎭 Componentes de UI Obrigatórios

### Particle Background
```typescript
// Partículas flutuantes no fundo
// - Cores: dourado (baixa opacidade) + ciano (média opacidade)
// - Movimento: suave, aleatório, mouse-parallax sutil
// - Conexões: linhas entre partículas próximas
// - Contagem: 30-50 partículas (performance)
```

### Command Palette (Ctrl+K)
```typescript
// Modal de comandos estilo VS Code
// - Busca fuzzy
// - Ícones para cada tipo de comando
// - Atalhos de teclado exibidos
// - Categorias: Navegação, Ações, Projetos, Agentes
```

### Toast Notifications
```typescript
// Notificações estilo Sonner
// - Sucesso: ícone check, borda verde
// - Erro: ícone X, borda vermelha
// - Info: ícone info, borda ciano
// - Aviso: ícone alerta, borda dourada
```

### Sidebar Navigation
```typescript
// Menu lateral fixo
// - Logo Aura no topo com glow
// - Items: Dashboard, Chat, Swarm ⭐, Remote, Projects, System, Settings
// - Indicador ativo: linha dourada à esquerda + glow
// - Collapsible em mobile (hamburger menu)
// - Badges de notificação (contadores)
```

---

## ⚡ Animações e Micro-interações

### Padrões de Animação

| Elemento | Animação | Duração | Easing |
|----------|----------|---------|--------|
| Page transition | Fade + slide up | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Modal open | Scale + fade | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Button hover | Scale 1.05 + glow | 150ms | ease-out |
| Card hover | Lift + border glow | 200ms | ease-out |
| Loading spinner | Rotate + pulse | 1s | linear |
| Typing indicator | Bounce dots | 1.4s | ease-in-out |
| Particles | Float + drift | 20s | linear infinite |
| Data update | Flash + fade | 300ms | ease-out |

### Framer Motion Variants

```typescript
// Stagger container
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// Fade up item
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }
};

// Glow pulse
const glow = {
  initial: { boxShadow: "0 0 20px rgba(212,175,55,0.2)" },
  animate: { 
    boxShadow: [
      "0 0 20px rgba(212,175,55,0.2)",
      "0 0 40px rgba(212,175,55,0.4)",
      "0 0 20px rgba(212,175,55,0.2)"
    ],
    transition: { duration: 2, repeat: Infinity }
  }
};
```

---

## 🔌 Integração com Backend

### Configuração de API

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// Endpoints
GET    /api/v1/status
GET    /api/v1/auth/status
POST   /api/v1/chat
POST   /api/v1/command
GET    /api/v1/projects
POST   /api/v1/projects/open
GET    /api/v1/jobs
POST   /api/v1/jobs/{id}/start
POST   /api/v1/jobs/{id}/stop
WS     /ws/agents        # WebSocket para agentes em tempo real
```

### WebSocket Implementation

```typescript
// hooks/use-websocket.ts
// - Reconexão automática com backoff exponencial
// - Heartbeat a cada 30s
// - Tipagem forte das mensagens
// - Estado de conexão visível na UI
```

---

## 📱 Responsividade

### Breakpoints

| Breakpoint | Largura | Layout |
|------------|---------|--------|
| Mobile | < 640px | Sidebar como drawer, stack vertical |
| Tablet | 640-1024px | Sidebar collapsed, 2 col grid |
| Desktop | > 1024px | Sidebar expandida, 3 col grid |
| Wide | > 1440px | Sidebar + max-width container |

### Mobile Considerations
- Touch targets mínimos 44x44px
- Swipe gestures para navegação
- Bottom sheet para modais
- Simplificação da visualização Swarm

---

## 🔧 Requisitos de Performance

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Lighthouse Score**: > 90 (Performance, Acessibilidade, SEO)
- **Animações**: 60fps consistente
- **Bundle Size**: < 200KB (initial JS)
- **Images**: Otimizadas, lazy loading, WebP

---

## ✅ Checklist de Implementação

### Fase 1: Setup
- [ ] Criar projeto Next.js com shadcn
- [ ] Instalar todas as dependências
- [ ] Configurar Tailwind com tema customizado
- [ ] Criar estrutura de diretórios
- [ ] Setup do Zustand para estado global

### Fase 2: Componentes Base
- [ ] Criar tema CSS com variáveis
- [ ] Componentes UI (Button, Card, Badge, Input)
- [ ] Particle Background
- [ ] Sidebar navigation
- [ ] Header com status

### Fase 3: Layout
- [ ] Root layout com providers
- [ ] Command Palette (Ctrl+K)
- [ ] Toast notifications
- [ ] Transições de página

### Fase 4: Páginas
- [ ] Dashboard com widgets
- [ ] Página /swarm (prioridade máxima!)
- [ ] Página /chat
- [ ] Página /remote
- [ ] Página /projects
- [ ] Página /system
- [ ] Página /settings

### Fase 5: Integração
- [ ] Cliente HTTP configurado
- [ ] WebSocket para tempo real
- [ ] Hooks de dados (React Query)
- [ ] Estado global sincronizado

### Fase 6: Polish
- [ ] Animações finas em todas as interações
- [ ] Responsividade testada
- [ ] Performance otimizada
- [ ] Acessibilidade (ARIA, keyboard nav)
- [ ] Testes E2E críticos

---

## 🎯 Critérios de Sucesso

1. **Visual**: Interface que parece saída de um filme sci-fi
2. **UX**: Navegação fluida, feedback imediato, zero confusão
3. **Performance**: 60fps, carregamento rápido, sem lag
4. **Funcionalidade**: Todas as páginas operacionais integradas à API
5. **Swarm**: A página de agentes deve ser o destaque - interativa e visualmente impressionante

---

## 💡 Dicas de Implementação

1. **Use Framer Motion** para todas as animações - é a biblioteca padrão para React
2. **Componentize tudo** - cada widget deve ser um componente reutilizável
3. **Mobile-first** - comece pelo layout mobile e expanda
4. **Teste no Mac** - como é uma interface para controle de Mac, teste no Safari
5. **WebSocket primeiro** - implemente a conexão realtime antes das páginas que dependem dela
6. **Swarm é prioridade** - gaste 40% do tempo nessa página, ela é o diferencial

---

**Vamos criar algo épico! 🚀✨**
