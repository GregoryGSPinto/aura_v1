# AURA — PROMPT MASTER FINAL: 100% FUNCIONAL E PRONTA PRA TESTES

**Este prompt é o ÚLTIMO. Depois dele a Aura está completa pra uso diário.**
**Pré-requisitos:** AURA-MEGA-PROMPT.md e AURA-BROWSER-SUPPLEMENT.md já executados.

---

## ANTES DE TUDO

Leia TODOS estes arquivos antes de tocar em qualquer código:

```
~/Projetos/aura_v1/CLAUDE.md
~/Projetos/aura_v1/AUDIT.md
~/Projetos/aura_v1/aura/backend/app/main.py
~/Projetos/aura_v1/aura/backend/app/api/v1/endpoints/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/services/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/tools/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/core/config.py
~/Projetos/aura_v1/aura/backend/.env
~/Projetos/aura_v1/aura/frontend/components/ (TODOS)
~/Projetos/aura_v1/aura/frontend/lib/ (TODOS)
~/Projetos/aura_v1/aura/frontend/app/ (TODOS)
~/Projetos/aura_v1/scripts/ (TODOS)
~/Library/LaunchAgents/com.*.aura*.plist (se existir)
```

**REGRA ABSOLUTA:** Leia ANTES, entenda o que JÁ EXISTE, não duplique, não quebre.

---

# ═══════════════════════════════════════════════════════════
# PARTE 1 — OLLAMA ON-DEMAND (liga/desliga automático)
# ═══════════════════════════════════════════════════════════

O Gregory quer: backend + frontend sempre ligados (leves). Ollama liga automático
quando a Aura precisa dele, e desliga depois de X minutos sem uso pra liberar RAM.

## 1.1 — Ollama Lifecycle Manager

### Crie: `backend/app/services/ollama_lifecycle.py`

```python
"""
Ollama Lifecycle Manager — Liga e desliga o Ollama automaticamente.

Comportamento:
- Quando uma mensagem chega que precisa do Qwen → liga Ollama automaticamente
- Após 10 minutos sem uso → desliga Ollama e libera RAM
- Se Ollama já está rodando → usa direto
- Se Ollama falha ao ligar → fallback pro Claude API

Isso elimina a necessidade de Gregory clicar no botão de ignição.
O botão continua existindo como override manual, mas o padrão é automático.

Gregory liga o Mac → backend + frontend + ngrok sobem (leves)
Gregory manda mensagem de voz → Brain Router decide se precisa de Qwen
Se precisa → Ollama liga automaticamente → processa → responde
Depois de 10 min sem uso → Ollama desliga sozinho → RAM liberada
"""

import asyncio
import time
import logging
import subprocess
import os
from typing import Optional
from datetime import datetime

logger = logging.getLogger("aura")

IDLE_TIMEOUT_SECONDS = 600  # 10 minutos sem uso → desliga


class OllamaLifecycle:
    def __init__(self, ollama_url: str = "http://localhost:11434", model_name: str = "qwen3:latest"):
        self.ollama_url = ollama_url
        self.model_name = model_name
        self.last_used_at: Optional[float] = None
        self.is_starting = False
        self._idle_task: Optional[asyncio.Task] = None
        self._process: Optional[asyncio.subprocess.Process] = None

    async def is_running(self) -> bool:
        """Verifica se Ollama está rodando e respondendo."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def ensure_running(self) -> bool:
        """
        Garante que o Ollama está rodando. Liga se necessário.
        Retorna True se está pronto, False se falhou.
        
        Este método é chamado automaticamente pelo BrainRouter antes de
        enviar mensagem pro Qwen. Gregory não precisa fazer nada.
        """
        # Já está rodando
        if await self.is_running():
            self.last_used_at = time.time()
            self._restart_idle_timer()
            return True

        # Já está iniciando (outra chamada concorrente)
        if self.is_starting:
            # Esperar até 30s pelo start concorrente
            for _ in range(30):
                await asyncio.sleep(1)
                if await self.is_running():
                    self.last_used_at = time.time()
                    return True
            return False

        # Precisa iniciar
        self.is_starting = True
        logger.info("[OllamaLifecycle] Iniciando Ollama automaticamente...")

        try:
            # Iniciar ollama serve
            self._process = await asyncio.create_subprocess_exec(
                "ollama", "serve",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                env={**os.environ, "OLLAMA_HOST": "0.0.0.0:11434"},
            )

            # Esperar ficar ready (max 30s)
            for i in range(30):
                await asyncio.sleep(1)
                if await self.is_running():
                    logger.info(f"[OllamaLifecycle] Ollama pronto em {i+1}s")
                    self.last_used_at = time.time()
                    self.is_starting = False
                    self._restart_idle_timer()
                    return True

            logger.error("[OllamaLifecycle] Ollama não ficou pronto em 30s")
            self.is_starting = False
            return False

        except FileNotFoundError:
            logger.error("[OllamaLifecycle] Comando 'ollama' não encontrado no PATH")
            self.is_starting = False
            return False
        except Exception as e:
            logger.error(f"[OllamaLifecycle] Erro ao iniciar: {e}")
            self.is_starting = False
            return False

    async def stop(self) -> bool:
        """Para o Ollama e libera RAM."""
        logger.info("[OllamaLifecycle] Desligando Ollama...")
        try:
            # Descarregar modelo da memória
            proc = await asyncio.create_subprocess_exec(
                "ollama", "stop", self.model_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=10)
        except Exception:
            pass

        try:
            # Matar processo
            result = subprocess.run(["pkill", "-f", "ollama"], capture_output=True)
            await asyncio.sleep(1)
            
            if not await self.is_running():
                logger.info("[OllamaLifecycle] Ollama desligado. RAM liberada.")
                self.last_used_at = None
                return True
            else:
                # Force kill
                subprocess.run(["pkill", "-9", "-f", "ollama"], capture_output=True)
                await asyncio.sleep(1)
                return not await self.is_running()
        except Exception as e:
            logger.error(f"[OllamaLifecycle] Erro ao desligar: {e}")
            return False

    def mark_used(self):
        """Marca que o Ollama foi usado agora. Reseta o timer de idle."""
        self.last_used_at = time.time()
        self._restart_idle_timer()

    def _restart_idle_timer(self):
        """Reinicia o timer de desligamento automático."""
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
        self._idle_task = asyncio.ensure_future(self._idle_shutdown())

    async def _idle_shutdown(self):
        """Desliga Ollama após período de inatividade."""
        await asyncio.sleep(IDLE_TIMEOUT_SECONDS)
        if self.last_used_at and (time.time() - self.last_used_at) >= IDLE_TIMEOUT_SECONDS:
            logger.info(f"[OllamaLifecycle] {IDLE_TIMEOUT_SECONDS//60}min sem uso. Desligando Ollama...")
            await self.stop()

    async def get_status(self) -> dict:
        """Status completo para o frontend."""
        running = await self.is_running()
        
        memory_mb = 0
        if running:
            try:
                result = subprocess.run(
                    ["pgrep", "-f", "ollama"],
                    capture_output=True, text=True
                )
                pids = result.stdout.strip().split("\n")
                for pid in pids:
                    if pid:
                        ps = subprocess.run(
                            ["ps", "-o", "rss=", "-p", pid],
                            capture_output=True, text=True
                        )
                        rss = ps.stdout.strip()
                        if rss.isdigit():
                            memory_mb += int(rss) // 1024
            except Exception:
                pass

        idle_seconds = None
        if self.last_used_at:
            idle_seconds = int(time.time() - self.last_used_at)

        return {
            "status": "running" if running else ("starting" if self.is_starting else "stopped"),
            "model": self.model_name,
            "memory_mb": memory_mb,
            "idle_seconds": idle_seconds,
            "auto_shutdown_minutes": IDLE_TIMEOUT_SECONDS // 60,
            "seconds_until_shutdown": max(0, IDLE_TIMEOUT_SECONDS - (idle_seconds or 0)) if idle_seconds else None,
        }
```

---

## 1.2 — Integrar no BrainRouter

### Modifique: o BrainRouter existente (backend/app/services/ — pode ser brain_router.py, chat_router_service.py, ou similar)

Encontre o método que envia mensagem pro Qwen/Ollama e adicione ANTES da chamada:

```python
# ANTES de chamar o Ollama, garantir que está rodando
ollama_lifecycle = request.app.state.ollama_lifecycle  # ou self.ollama_lifecycle
ollama_ready = await ollama_lifecycle.ensure_running()

if not ollama_ready:
    # Fallback pro Claude API
    logger.warning("[BrainRouter] Ollama não disponível, usando Claude API como fallback")
    return await self.process_with_claude(message, system_prompt, conversation_history)

# Marcar uso
ollama_lifecycle.mark_used()

# Agora sim, chamar Ollama normalmente...
```

**NÃO reescreva o BrainRouter inteiro.** Apenas adicione essas 5 linhas no ponto certo.

---

## 1.3 — Endpoints de controle manual

### Crie ou modifique: `backend/app/api/v1/endpoints/engine_api.py`

```python
"""
Engine API — Controle manual do Ollama.

O Ollama liga/desliga automaticamente, mas Gregory pode controlar manualmente.
"""

from fastapi import APIRouter, Depends, Request
from app.core.security import require_bearer_token

router = APIRouter(prefix="/engine", dependencies=[Depends(require_bearer_token)])


@router.get("/status")
async def engine_status(request: Request):
    """Status do Ollama."""
    lifecycle = request.app.state.ollama_lifecycle
    return await lifecycle.get_status()


@router.post("/start")
async def engine_start(request: Request):
    """Liga o Ollama manualmente."""
    lifecycle = request.app.state.ollama_lifecycle
    success = await lifecycle.ensure_running()
    return {"success": success, **(await lifecycle.get_status())}


@router.post("/stop")
async def engine_stop(request: Request):
    """Desliga o Ollama manualmente (libera RAM)."""
    lifecycle = request.app.state.ollama_lifecycle
    success = await lifecycle.stop()
    return {"success": success, **(await lifecycle.get_status())}
```

---

## 1.4 — Registrar no main.py

Adicione ao startup (NÃO substitua, ADICIONE):

```python
from app.services.ollama_lifecycle import OllamaLifecycle
from app.api.v1.endpoints.engine_api import router as engine_router

# No startup:
ollama_lifecycle = OllamaLifecycle(
    ollama_url=settings.ollama_url if hasattr(settings, 'ollama_url') else "http://localhost:11434",
    model_name=settings.model_name if hasattr(settings, 'model_name') else "qwen3:latest",
)
app.state.ollama_lifecycle = ollama_lifecycle

# Registrar router
app.include_router(engine_router, prefix="/api/v1")
```

---

## 1.5 — Frontend: Engine Status no TopBar

### Modifique o componente de TopBar/StatusBar existente

Adicione um indicador do Ollama que mostra:
- 🟢 "Qwen · 4.2GB" quando rodando
- ⚫ "Motor off" quando desligado  
- 🟡 "Iniciando..." quando starting
- Tap → abre popover com: RAM, tempo idle, botão liga/desliga manual
- O indicador é PEQUENO (ícone + texto curto) — não pode dominar o TopBar

### Polling:
```typescript
// Verificar status a cada 15s
useEffect(() => {
    const check = async () => {
        const status = await fetch('/api/v1/engine/status').then(r => r.json());
        setEngineStatus(status);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
}, []);
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 2 — COLA DE INTEGRAÇÃO (conectar tudo)
# ═══════════════════════════════════════════════════════════

Os prompts anteriores criaram as peças. Esta parte garante que estão CONECTADAS.

## 2.1 — Verificar e conectar o Agent Service no fluxo principal de chat

O chat principal da Aura DEVE usar o Agent Service (que tem tool calling).
Verifique se o endpoint que o frontend chama é o do Agent:

```
Se o frontend chama /api/v1/chat → redirecionar para /api/v1/agent/chat
OU
Modificar o handler de /api/v1/chat para usar o AgentService internamente
```

O objetivo: TODA mensagem que Gregory envia (texto ou voz) passa pelo AgentService.
Se é conversa simples, o Agent detecta que não precisa de tools e responde normalmente.
Se precisa de ação, usa as tools.

### Verificar no frontend:

Encontre o arquivo que faz a chamada de chat (lib/api.ts, lib/chat-store.ts, ou similar).
Garanta que aponta para o endpoint que usa AgentService.

```typescript
// ERRADO (chat simples sem tools):
const response = await fetch('/api/v1/chat', { ... });

// CERTO (chat com tools):
const response = await fetch('/api/v1/agent/chat', { ... });
```

Se o endpoint /api/v1/agent/chat não existir (o MEGA-PROMPT não rodou ainda),
crie um wrapper no /api/v1/chat que instancia o AgentService inline.

---

## 2.2 — Verificar e conectar a Voz com o Agent

O pipeline de voz (VoiceButton → transcrição → resposta) DEVE usar o AgentService.

### No frontend, encontre o VoiceButton ou componente de voz:

Quando a transcrição de voz chega:
```typescript
// Ao finalizar transcrição:
const transcribedText = ...; // texto do Web Speech API ou Whisper

// DEVE enviar pro agent, não pro chat simples:
const result = await fetch('/api/v1/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ message: transcribedText }),
});

// Renderizar resultado (inclui tool_calls se houver)
```

---

## 2.3 — Verificar que o ToolCallBlock renderiza no chat

Quando o AgentService retorna tool_calls no response, o chat DEVE mostrar visualmente:
- Qual tool foi chamada
- Parâmetros usados
- Resultado (colapsável)
- Status (sucesso/erro/pendente)

### Se o componente ToolCallBlock existe mas não está sendo usado:

No MessageBubble ou equivalente, adicione:

```tsx
// Dentro da renderização de cada mensagem:
{message.tool_calls && message.tool_calls.length > 0 && (
    <div className="mt-2 space-y-2">
        {message.tool_calls.map((tc, i) => (
            <ToolCallBlock key={i} toolCall={tc} />
        ))}
    </div>
)}
```

### Se o ToolCallBlock NÃO existe, crie um SIMPLES:

```tsx
// components/chat/ToolCallBlock.tsx
function ToolCallBlock({ toolCall }) {
    const [expanded, setExpanded] = useState(false);
    const icons = {
        shell: '🖥️', file_read: '📄', file_write: '✏️', file_search: '🔍',
        file_list: '📁', git: '🔀', claude_code: '🤖', browser: '🌐',
        vercel: '🚀', macos: '🍎', browser_navigate: '🧭', web_workflow: '⚡',
        attachment: '📎',
    };
    const icon = icons[toolCall.tool] || '🔧';
    const success = toolCall.result?.success;

    return (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <span>{icon}</span>
                <span className="font-mono text-xs opacity-70">{toolCall.tool}</span>
                <span>{success ? '✅' : '❌'}</span>
                <span className="ml-auto text-xs opacity-50">{expanded ? '▼' : '▶'}</span>
            </div>
            {expanded && (
                <div className="mt-2 space-y-1">
                    <pre className="text-xs opacity-60 overflow-x-auto">
                        {JSON.stringify(toolCall.params, null, 2)}
                    </pre>
                    {toolCall.result?.output && (
                        <pre className="text-xs bg-black/20 rounded p-2 max-h-48 overflow-auto">
                            {typeof toolCall.result.output === 'string' 
                                ? toolCall.result.output.substring(0, 3000) 
                                : JSON.stringify(toolCall.result.output, null, 2).substring(0, 3000)}
                        </pre>
                    )}
                    {toolCall.result?.error && (
                        <p className="text-xs text-red-400">{toolCall.result.error}</p>
                    )}
                </div>
            )}
        </div>
    );
}
```

---

## 2.4 — Verificar que o ApprovalBanner funciona

Quando uma tool L2 é chamada e precisa de aprovação:

### No chat, verificar aprovações pendentes:

```typescript
// Polling a cada 10s
const checkApprovals = async () => {
    const resp = await fetch('/api/v1/agent/approvals', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    setPendingApprovals(data.pending || []);
};
```

### Se tem aprovações pendentes, mostrar banner:

```tsx
{pendingApprovals.length > 0 && (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mx-4 mt-2">
        <p className="text-sm text-yellow-400 font-medium">
            🔔 {pendingApprovals.length} ação(ões) aguardando aprovação
        </p>
        {pendingApprovals.map(approval => (
            <div key={approval.id} className="mt-2 flex items-center gap-2">
                <p className="text-xs flex-1">{approval.description}</p>
                <button onClick={() => handleApproval(approval.id, true)}
                    className="px-3 py-1 bg-green-600 rounded text-xs">Aprovar</button>
                <button onClick={() => handleApproval(approval.id, false)}
                    className="px-3 py-1 bg-red-600 rounded text-xs">Rejeitar</button>
            </div>
        ))}
    </div>
)}
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 3 — BOOT HARDENED (100% automático)
# ═══════════════════════════════════════════════════════════

## 3.1 — Verificar e corrigir o boot script

### Leia o script de boot existente (scripts/boot.sh, scripts/aura-start.sh, ou similar)

Garanta que ele faz EXATAMENTE isto, nesta ordem:

```bash
#!/bin/bash
# AURA BOOT — Automático no login do Mac
# O que inicia: backend + frontend + ngrok (leves, ~150MB total)
# O que NÃO inicia: Ollama (liga automático quando precisa, desliga após 10min)

AURA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$AURA_DIR/data/logs/boot.log"
mkdir -p "$(dirname "$LOG")"

echo "=== AURA BOOT $(date) ===" >> "$LOG"

# 1. Kill portas que podem estar ocupadas de sessão anterior
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# 2. Start Backend
cd "$AURA_DIR/aura/backend" || exit 1
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> "$LOG" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID" >> "$LOG"

# 3. Esperar backend ficar ready
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
        echo "Backend ready em ${i}x2s" >> "$LOG"
        break
    fi
done

# 4. Start Frontend
cd "$AURA_DIR/aura/frontend" || exit 1
nohup pnpm dev --port 3000 >> "$LOG" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID" >> "$LOG"

# 5. Start ngrok (se domínio configurado)
NGROK_DOMAIN=""
if [ -f "$AURA_DIR/aura/backend/.env" ]; then
    NGROK_DOMAIN=$(grep -i "NGROK_DOMAIN" "$AURA_DIR/aura/backend/.env" | cut -d= -f2 | tr -d '"' | tr -d "'")
fi

if [ -n "$NGROK_DOMAIN" ]; then
    nohup ngrok http 8000 --domain="$NGROK_DOMAIN" >> "$LOG" 2>&1 &
    echo "ngrok PID: $!" >> "$LOG"
else
    # Sem domínio fixo, usar tunnel temporário
    nohup ngrok http 8000 >> "$LOG" 2>&1 &
    echo "ngrok (temporário) PID: $!" >> "$LOG"
fi

# 6. Health check final
sleep 5
if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "✅ AURA ONLINE $(date)" >> "$LOG"
else
    echo "⚠️ AURA BOOT: backend não respondeu ao health check" >> "$LOG"
fi

echo "Boot completo. Backend :8000, Frontend :3000" >> "$LOG"
```

### Garantir que o boot script é executável:
```bash
chmod +x scripts/boot.sh  # ou o nome que tiver
```

### Garantir que o LaunchAgent aponta pro script correto:

Verifique `~/Library/LaunchAgents/com.*.aura*.plist` e garanta:
- `RunAtLoad` = true
- `ProgramArguments` aponta pro script correto
- `WorkingDirectory` aponta pra raiz do projeto
- `PATH` inclui `/opt/homebrew/bin:/usr/local/bin` (pra encontrar pnpm, python3, ngrok, ollama)
- `HOME` está definido

Se o plist NÃO existe, crie e instale:
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aura.boot.plist
```

---

## 3.2 — .env completo

### Verifique que o .env do backend tem TODAS as vars necessárias:

```bash
cd ~/Projetos/aura_v1/aura/backend
cat .env
```

Deve ter no mínimo:
```
ANTHROPIC_API_KEY=sk-ant-...     # Pra Claude API funcionar
AURA_AUTH_TOKEN=...              # Token de autenticação dos endpoints
OLLAMA_URL=http://localhost:11434
MODEL_NAME=qwen3:latest          # Verificar nome exato do modelo instalado
NGROK_DOMAIN=...                 # Domínio ngrok (se tiver)
```

### Se ANTHROPIC_API_KEY não está configurada:
Informe ao Gregory: "A Claude API não vai funcionar sem a ANTHROPIC_API_KEY configurada no .env. 
A Aura vai funcionar APENAS com Qwen local até você adicionar a key."

### Criar .env.example se não existir:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
AURA_AUTH_TOKEN=your-secret-token
OLLAMA_URL=http://localhost:11434
MODEL_NAME=qwen3:latest
NGROK_DOMAIN=your-domain.ngrok-free.app
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 4 — TESTES END-TO-END (validar TUDO funciona junto)
# ═══════════════════════════════════════════════════════════

Rode TODOS estes testes na ordem. Registre resultado de cada um.
Salve o relatório em ~/Projetos/aura_v1/TEST-RESULTS.md

## Grupo 1 — Infra

```bash
echo "=== TESTE 1.1: Backend respondendo ==="
curl -s http://localhost:8000/docs > /dev/null && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 1.2: Health endpoint ==="
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 1.3: Frontend respondendo ==="
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}" | grep -q "200" && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 1.4: ngrok tunnel ==="
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(f'✅ PASS — {t[0][\"public_url\"]}' if t else '❌ FAIL')" 2>/dev/null || echo "⚠️ SKIP — ngrok não está rodando"

echo "=== TESTE 1.5: Ollama disponível ==="
which ollama > /dev/null && echo "✅ PASS — ollama no PATH" || echo "❌ FAIL — ollama não encontrado"
```

## Grupo 2 — Ollama Lifecycle

```bash
# Pegar o token do .env
TOKEN=$(grep AURA_AUTH_TOKEN ~/Projetos/aura_v1/aura/backend/.env | cut -d= -f2 | tr -d '"' | tr -d "'")

echo "=== TESTE 2.1: Engine status ==="
curl -s http://localhost:8000/api/v1/engine/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 2.2: Engine start ==="
curl -s -X POST http://localhost:8000/api/v1/engine/start \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 2.3: Ollama respondendo após start ==="
sleep 5
curl -s http://localhost:11434/api/tags | python3 -m json.tool && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 2.4: Engine stop ==="
curl -s -X POST http://localhost:8000/api/v1/engine/stop \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool && echo "✅ PASS" || echo "❌ FAIL"

echo "=== TESTE 2.5: Ollama desligou ==="
sleep 3
curl -s http://localhost:11434/api/tags > /dev/null 2>&1 && echo "❌ FAIL — ainda rodando" || echo "✅ PASS — desligou"
```

## Grupo 3 — Tool Layer

```bash
echo "=== TESTE 3.1: Listar tools ==="
curl -s http://localhost:8000/api/v1/agent/tools \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tools = data.get('tools', [])
print(f'Tools registradas: {len(tools)}')
for t in tools:
    print(f'  - {t[\"name\"]}: L{t[\"autonomy_level\"]}')
print('✅ PASS' if len(tools) >= 10 else '❌ FAIL — menos de 10 tools')
" || echo "❌ FAIL — endpoint não existe"

echo "=== TESTE 3.2: Chat com tool (listar arquivos) ==="
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "liste os arquivos do diretório ~/Projetos/aura_v1/aura/backend/app/"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
has_response = bool(data.get('response', ''))
has_tools = len(data.get('tool_calls', [])) > 0
print(f'Resposta: {has_response}, Tool calls: {has_tools}')
print('✅ PASS' if has_response else '❌ FAIL')
" || echo "❌ FAIL — endpoint não existe ou erro"

echo "=== TESTE 3.3: Shell tool (ls) ==="
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "roda o comando ls -la no diretório do backend da aura"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('response', '')[:500])
print('✅ PASS' if data.get('response') else '❌ FAIL')
" || echo "❌ FAIL"

echo "=== TESTE 3.4: Git status ==="
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "mostra o git status do projeto aura"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('response', '')[:500])
print('✅ PASS' if data.get('response') else '❌ FAIL')
" || echo "❌ FAIL"

echo "=== TESTE 3.5: Segurança L3 (deve bloquear rm -rf) ==="
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "executa rm -rf / no terminal"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('response', '').lower()
blocked = 'bloquead' in response or 'não posso' in response or 'não é permitid' in response
print('✅ PASS — comando bloqueado' if blocked else '❌ FAIL — COMANDO NÃO FOI BLOQUEADO!')
" || echo "❌ FAIL"
```

## Grupo 4 — Chat funciona (conversa simples)

```bash
echo "=== TESTE 4.1: Chat simples (deve funcionar mesmo sem Ollama) ==="
curl -s -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "oi, tudo bem?"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('response', '')
print(f'Resposta: {response[:200]}')
print('✅ PASS' if len(response) > 5 else '❌ FAIL — resposta vazia')
" || echo "❌ FAIL"
```

## Grupo 5 — Frontend build

```bash
echo "=== TESTE 5.1: TypeScript sem erros ==="
cd ~/Projetos/aura_v1/aura/frontend
pnpm tsc --noEmit 2>&1 | tail -5
[ $? -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL — erros TypeScript"

echo "=== TESTE 5.2: Build de produção ==="
pnpm build 2>&1 | tail -5
[ $? -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL — build falhou"
```

## Grupo 6 — Acesso remoto

```bash
echo "=== TESTE 6.1: Acesso via ngrok ==="
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null)
if [ -n "$NGROK_URL" ]; then
    curl -s -X POST "$NGROK_URL/api/v1/agent/chat" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "ngrok-skip-browser-warning: true" \
      -d '{"message": "oi"}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✅ PASS — acesso remoto funcionando' if data.get('response') else '❌ FAIL')
"
else
    echo "⚠️ SKIP — ngrok não está rodando"
fi
```

## Relatório final

```bash
echo ""
echo "═══════════════════════════════════════"
echo "         AURA — RELATÓRIO FINAL"
echo "═══════════════════════════════════════"
echo ""
echo "Backend:        $(curl -s http://localhost:8000/docs > /dev/null 2>&1 && echo '✅ UP' || echo '❌ DOWN')"
echo "Frontend:       $(curl -s http://localhost:3000 -o /dev/null -w '%{http_code}' 2>/dev/null | grep -q '200' && echo '✅ UP' || echo '❌ DOWN')"
echo "Ollama:         $(curl -s http://localhost:11434/api/tags > /dev/null 2>&1 && echo '🟢 Rodando' || echo '⚫ Desligado (normal)')"
echo "ngrok:          $(curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1 && echo '✅ UP' || echo '⚠️ DOWN')"
echo "Claude API:     $(grep -q 'ANTHROPIC_API_KEY=sk-ant' ~/Projetos/aura_v1/aura/backend/.env 2>/dev/null && echo '✅ Configurada' || echo '⚠️ Não configurada')"
echo ""
echo "A Aura está pronta pra uso? Todos os testes acima devem ser ✅ ou ⚠️ SKIP."
echo "❌ em qualquer teste = precisa corrigir antes de usar."
```

Salve todo o output em ~/Projetos/aura_v1/TEST-RESULTS.md

---

# ═══════════════════════════════════════════════════════════
# PARTE 5 — COMMIT E DEPLOY FINAL
# ═══════════════════════════════════════════════════════════

Após TODOS os testes passarem:

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "feat: Aura 1.0 — Ollama on-demand + integration glue + E2E tests + production ready"
git push
```

---

# REGRAS FINAIS

1. NÃO quebre o que já funciona — leia ANTES de modificar
2. Se algo do MEGA-PROMPT ou BROWSER-SUPPLEMENT não foi implementado (endpoint não existe, componente não existe), implemente AGORA como parte deste prompt
3. Se um import falha, corrija o import — não delete o código
4. Se um teste falha, corrija o código — não pule o teste
5. O Ollama NÃO inicia no boot. Liga automático quando precisa, desliga após 10min
6. O backend + frontend + ngrok SEMPRE iniciam no boot (leves)
7. Toda tool call é logada no audit trail
8. L3 NUNCA executa — se um teste L3 passar, o código está ERRADO
9. .env NUNCA vai pro git (verificar .gitignore)
10. Qwen: "think": false, sem num_predict
11. ngrok: sempre header ngrok-skip-browser-warning: true
12. Mobile first: touch targets 44px
13. Rode TODOS os testes e salve em TEST-RESULTS.md
14. Commit e push no final
