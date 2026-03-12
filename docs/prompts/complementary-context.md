# PROMPT COMPLEMENTAR PARA CODEX — Contexto do Projeto Aura

Use este prompt APÓS o prompt principal para dar contexto específico.

---

## 📁 ESTRUTURA ATUAL DO FRONTEND

```
app/
  ├── layout.tsx          # Layout principal com Sidebar, MobileNav
  ├── page.tsx            # Dashboard (mudar para redirecionar pro chat)
  ├── chat/page.tsx       # Chat existente (bem estruturado)
  ├── globals.css         # Tema escuro já configurado
  └── ...

components/
  ├── layout/
  │   ├── sidebar.tsx     # JÁ TEM estrutura para collapse (ver abaixo)
  │   ├── mobile-nav.tsx
  │   └── particle-background.tsx
  ├── ui/
  │   ├── button.tsx
  │   ├── card.tsx
  │   └── badge.tsx
  └── providers/

lib/
  ├── api.ts              # APIs já configuradas (ver endpoints abaixo)
  ├── types.ts
  └── utils.ts
```

---

## 🔧 SIDEBAR JÁ PREPARADA PARA COLLAPSE

O arquivo `components/layout/sidebar.tsx` JÁ TEM:

```typescript
const collapsed = false;  // ← Só trocar para useState

// Já tem classes condicionais:
collapsed ? 'lg:w-20' : 'lg:w-72'
collapsed && 'lg:justify-center lg:px-4'

// Já tem AnimatePresence para esconder textos
```

**O que faltar:**
1. Trocar `const collapsed = false` para `const [collapsed, setCollapsed] = useState(false)`
2. Adicionar botão de toggle no topo da sidebar
3. Salvar estado no localStorage

---

## 🎙️ APIs DE ÁUDIO DO BACKEND

O backend JÁ SUPORTA áudio! Endpoints em `lib/api.ts`:

```typescript
// Adicionar estas funções:

export async function transcribeAudio(audioBlob: Blob): Promise<ApiResponse<{ text: string }>> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  
  return fetchApi('/api/v1/audio/transcribe', {
    method: 'POST',
    body: formData,
    headers: {}, // Remover Content-Type para multipart
  });
}

export async function synthesizeSpeech(text: string): Promise<ApiResponse<{ audio_url: string }>> {
  return fetchApi('/api/v1/audio/synthesize', {
    method: 'POST',
    body: JSON.stringify({ text, voice: 'pt-BR-Wavenet-A' }),
  });
}
```

---

## 📎 UPLOAD DE ARQUIVOS

Endpoint já existe:

```typescript
export async function uploadFile(file: File): Promise<ApiResponse<{ 
  file_id: string; 
  url: string;
  type: string;
}>> {
  const formData = new FormData();
  formData.append('file', file);
  
  return fetchApi('/api/v1/upload', {
    method: 'POST',
    body: formData,
    headers: {},
  });
}
```

---

## 🎨 TEMA JÁ CONFIGURADO

O tema escuro já está em `globals.css`:

```css
:root {
  --gold: #ffd166;
  --gold-light: #ffe4a1;
  --cyan: #06b6d4;
  --bg-primary: #0f172a;    /* #0f172a ✅ */
  --bg-secondary: rgba(30, 41, 59, 0.6);
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
}
```

**Tailwind já configurado** com as cores da Aura.

---

## 🧩 COMPONENTES UI EXISTENTES

Usar os componentes em `components/ui/`:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Button já tem variantes:
// variant="default" | "outline" | "ghost" | "gold"
```

---

## 🎯 TAREFAS ESPECÍFICAS (Prioridade)

### 1. Sidebar Collapse (5 min)
```typescript
// sidebar.tsx
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('aura-sidebar-collapsed') === 'true';
});

useEffect(() => {
  localStorage.setItem('aura-sidebar-collapsed', String(collapsed));
}, [collapsed]);

// Adicionar botão toggle próximo ao logo
<button onClick={() => setCollapsed(!collapsed)}>
  {collapsed ? <ChevronRight /> : <ChevronLeft />}
</button>
```

### 2. Redirecionar Dashboard → Chat (2 min)
```typescript
// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/chat');
}
```

### 3. Botão de Microfone no Chat
```typescript
// app/chat/page.tsx
const [isRecording, setIsRecording] = useState(false);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const response = await transcribeAudio(blob);
    setInput(response.data.text);
  };
  
  recorder.start();
  mediaRecorderRef.current = recorder;
  setIsRecording(true);
};

const stopRecording = () => {
  mediaRecorderRef.current?.stop();
  setIsRecording(false);
};
```

### 4. Resposta em Áudio
```typescript
const speak = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  speechSynthesis.speak(utterance);
};

// Chamar após receber resposta do chat
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'assistant' && audioEnabled) {
    speak(lastMessage.content);
  }
}, [messages]);
```

### 5. Anexos Funcionando
```typescript
const handleFileUpload = async (file: File) => {
  try {
    const response = await uploadFile(file);
    setAttachments((prev) => [...prev, response.data]);
    notifySuccess('Arquivo anexado', file.name);
  } catch (error) {
    notifyError('Falha ao anexar', error.message);
  }
};
```

---

## 🔥 EXTRA: MODO JARVIS (Visual Futurista)

Adicionar opcionalmente:

### Orb Central Animado
```typescript
// components/ai-orb.tsx
<motion.div
  className="relative w-32 h-32"
  animate={{
    scale: isListening ? [1, 1.2, 1] : 1,
    rotate: isProcessing ? 360 : 0,
  }}
>
  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 blur-xl opacity-50" />
  <div className="absolute inset-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" />
</motion.div>
```

### Visualização de Áudio (Waveform)
```typescript
// Analisar áudio em tempo real
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
// Desenhar barras com canvas
```

### HUD de Agentes Ativos
```typescript
// Mostrar swarm de agentes em círculo ao redor do orb
const agents = [
  { id: 'planner', angle: 0, color: '#ffd166' },
  { id: 'executor', angle: 90, color: '#06b6d4' },
  { id: 'validator', angle: 180, color: '#a78bfa' },
];
```

---

## ✅ CHECKLIST FINAL

Antes de commitar, verificar:

- [ ] Sidebar colapsa/expande suavemente
- [ ] Estado da sidebar salvo no localStorage
- [ ] Aura abre direto no `/chat`
- [ ] Microfone captura áudio e transcreve
- [ ] Toggle "Resposta em áudio" funciona
- [ ] Anexos enviam arquivos para backend
- [ ] Preview de imagens/videos nos anexos
- [ ] Animações suaves com framer-motion
- [ ] Tema escuro consistente
- [ ] Mobile responsivo
- [ ] Build passa sem erros: `pnpm build`

---

## 🚀 COMANDOS PARA EXECUTAR

```bash
cd aura/frontend

# Instalar dependências
pnpm install

# Build de produção
pnpm build

# Type check
pnpm typecheck

# Commit
git add .
git commit -m "feat: modernize Aura UI with voice, collapsible sidebar, and file uploads"
git push origin main
```

---

**DICA:** O projeto usa Next.js 15 + React 19. Evitar APIs deprecadas!
