# AURA — AGI COMPLETA: MEMÓRIA + MISSÕES + PROATIVIDADE + PERSONALIDADE

**Este é o prompt final. Depois dele a Aura é uma AGI pessoal completa.**
**Inclui:** Self-Modification Protocol + Memory Engine + Mission Engine + Proactive Agent + Personalidade viva
**Pré-requisito:** Todos os prompts anteriores (Mega, Browser, Master Final, Facelift, Login) já executados.

---

## ANTES DE TUDO

Leia TODOS estes arquivos antes de tocar em qualquer código:

```
~/Projetos/aura_v1/CLAUDE.md
~/Projetos/aura_v1/aura/backend/app/main.py
~/Projetos/aura_v1/aura/backend/app/services/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/tools/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/api/v1/endpoints/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/api/v1/router.py
~/Projetos/aura_v1/aura/backend/app/core/config.py
~/Projetos/aura_v1/aura/backend/app/models/ (TODOS)
~/Projetos/aura_v1/aura/backend/app/prompts/ (TODOS, especialmente aura_absolute.py)
~/Projetos/aura_v1/aura/backend/.env
~/Projetos/aura_v1/aura/frontend/components/chat/ (TODOS)
~/Projetos/aura_v1/aura/frontend/components/layout/ (TODOS)
~/Projetos/aura_v1/aura/frontend/lib/ (TODOS)
~/Projetos/aura_v1/aura/frontend/app/ (TODOS)
~/Projetos/aura_v1/aura/frontend/hooks/ (TODOS)
```

**REGRA ABSOLUTA:** NÃO duplique. Leia o que existe. Se algo já está implementado (mesmo parcialmente), ESTENDA — não reescreva do zero. Integre com o que já funciona.

---

# ═══════════════════════════════════════════════════════════
# PARTE 1 — MEMÓRIA PERSISTENTE (a Aura lembra de tudo)
# ═══════════════════════════════════════════════════════════

Sem memória, a Aura começa do zero toda conversa. Com memória, ela sabe quem é Gregory, quais são seus projetos, o que decidiu ontem, e o que precisa fazer amanhã.

## 1.1 — SQLite Database

### Crie: `backend/app/services/memory_engine.py`

Se já existe um memory service, ESTENDA com o que falta. Se não, crie:

```python
"""
Memory Engine — Memória persistente da Aura.

Três camadas:
1. Preferences: coisas que Gregory gosta/prefere (pnpm, Vercel, dark mode, direto)
2. Projects: projetos com stack, status, paths, config
3. Facts: fatos por projeto (decisões, next steps, blockers, notas)
4. Conversations: histórico resumido de conversas
5. Session: contexto da conversa atual (limpa a cada 24h)

Tudo em SQLite local. Zero dependência externa.
Path: ~/Projetos/aura_v1/aura/backend/data/memory.db
"""
```

Schema SQLite (criar se não existir):

```sql
CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stack TEXT,
    objective TEXT,
    status TEXT DEFAULT 'active',
    repo_url TEXT,
    deploy_url TEXT,
    root_path TEXT,
    package_manager TEXT DEFAULT 'pnpm',
    default_branch TEXT DEFAULT 'main',
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT REFERENCES projects(id),
    fact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    summary TEXT,
    project_id TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_context (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Implementar:
- `init_db()` — cria tabelas se não existem
- `set_preference(key, value)` / `get_preference(key)` / `get_all_preferences()`
- `create_project(id, name, ...)` / `get_project(id)` / `list_projects()` / `update_project(id, ...)`
- `add_fact(project_id, fact_type, content, expires_at=None)` / `get_facts(project_id, limit=20)` / `deactivate_fact(id)`
- `save_conversation(id, summary, project_id)` / `get_recent_conversations(limit=10)`
- `set_session(key, value)` / `get_session(key)` / `clear_expired_sessions()`
- `get_context_for_prompt(project_id=None)` → retorna string formatada com tudo relevante pro LLM
- `cleanup()` — roda diário: limpa sessions >24h, desativa facts expirados, limita facts a 50/projeto

### Seed inicial (rodar na primeira inicialização):

```python
INITIAL_PREFERENCES = {
    "user_name": "Gregory",
    "language": "pt-BR",
    "package_manager": "pnpm",
    "deploy_target": "Vercel",
    "repo_host": "GitHub",
    "code_style": "premium, CTO/sênior, direto, sem floreio",
    "prompt_style": "executa direto, não pergunta, entrega pronto",
    "timezone": "America/Sao_Paulo",
    "work": "Maquinista ferroviário",
    "philosophy": "Tecnologia existe pra devolver tempo à família",
}

INITIAL_PROJECTS = [
    {"id": "aura", "name": "Aura", "stack": "Next.js 15, FastAPI, Vercel, Ollama, Claude API",
     "status": "active", "root_path": "~/Projetos/aura_v1/aura",
     "repo_url": "https://github.com/GregoryGSPinto/aura_v1"},
    {"id": "blackbelt", "name": "Black Belt", "stack": "BJJ streaming platform",
     "status": "near-complete", "root_path": "~/blackbelt"},
    {"id": "rail360", "name": "Rail360", "stack": "Railway operations platform",
     "status": "awaiting-approval"},
]
```

## 1.2 — Context Injection no Agent Service

### Modifique: `backend/app/services/agent_service.py`

No `_build_system_prompt()`, ANTES da lista de tools, injetar o contexto da memória:

```python
# Buscar contexto da memória
memory_context = await self.memory.get_context_for_prompt(project_id=detected_project)

system_prompt = f"""{base_prompt}

CONTEXTO DO GREGORY (da memória):
{memory_context}

{tools_prompt}
...
"""
```

O `get_context_for_prompt()` retorna algo como:
```
Usuário: Gregory (maquinista ferroviário)
Preferências: pnpm, Vercel, direto e sem floreio
Projeto ativo: Aura (Next.js 15, FastAPI)
Fatos recentes:
- [decisão] Qwen 3.5 funciona pra tool calling (5/5 testes)
- [next_step] Implementar memória persistente
- [nota] Ollama on-demand funcionando (auto start/stop 10min)
```

## 1.3 — Memory Learning (a Aura aprende automaticamente)

### Modifique: `backend/app/services/agent_service.py`

Após cada resposta do agent, analisar se aprendeu algo novo:

```python
# Após gerar resposta final, extrair aprendizados
await self._learn_from_interaction(message, response, tool_calls)

async def _learn_from_interaction(self, message, response, tool_calls):
    """Extrai fatos da interação e salva na memória."""
    # Se houve tool calls, registrar
    for tc in tool_calls:
        if tc["result"]["success"]:
            # Detectar projeto pelo path
            project = self._detect_project(tc)
            if project:
                await self.memory.add_fact(
                    project_id=project,
                    fact_type="command",
                    content=f"{tc['tool']}: {json.dumps(tc['params'])[:200]}",
                    expires_at=datetime.now() + timedelta(days=7)
                )
    
    # Detectar decisões explícitas ("vamos usar X", "decidi Y")
    decision_patterns = [
        r"(vamos usar|decidi|escolhi|optei por|vou com)\s+(.+)",
        r"(let's use|decided|chose|going with)\s+(.+)",
    ]
    for pattern in decision_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            await self.memory.add_fact(
                project_id=self._detect_active_project(),
                fact_type="decision",
                content=match.group(0)[:200],
            )
```

## 1.4 — Endpoints de Memória

### Crie: `backend/app/api/v1/endpoints/memory_api.py`

(Se já existe, ESTENDA — não duplique)

```
GET    /api/v1/memory/preferences          → todas as preferências
POST   /api/v1/memory/preferences          → salvar preferência {key, value}
GET    /api/v1/memory/projects             → todos os projetos
GET    /api/v1/memory/projects/{id}        → projeto + fatos
POST   /api/v1/memory/facts               → adicionar fato {project_id, fact_type, content}
GET    /api/v1/memory/context              → contexto completo formatado
GET    /api/v1/memory/conversations        → últimas conversas
POST   /api/v1/memory/learn               → forçar aprendizado de um texto
```

Registrar no router.py.

---

# ═══════════════════════════════════════════════════════════
# PARTE 2 — MISSION ENGINE (tarefas multi-step)
# ═══════════════════════════════════════════════════════════

Gregory diz "refatora o auth, adiciona testes, e faz deploy". A Aura quebra em steps, executa sequencialmente, e entrega pronto.

### Crie: `backend/app/services/mission_engine.py`

```python
"""
Mission Engine — Executa objetivos complexos em múltiplos steps.

Fluxo:
1. Gregory define objetivo em linguagem natural
2. Planner (Claude API) quebra em 3-7 steps
3. Executor roda cada step via AgentService
4. Se step falha: retry (2x), depois replanejamento
5. Ao concluir: resumo executivo pro Gregory

Limites:
- Máximo 7 steps por missão (sem paralelismo)
- Timeout: 30 minutos por missão
- Se step falha 3x: pausa e notifica Gregory
"""
```

Implementar:

```python
@dataclass
class MissionStep:
    id: str
    description: str
    status: str  # "pending" | "running" | "completed" | "failed" | "skipped"
    result: Optional[str] = None
    attempts: int = 0
    tool_calls: list = field(default_factory=list)

@dataclass  
class Mission:
    id: str
    objective: str
    project_id: Optional[str]
    steps: List[MissionStep]
    status: str  # "planning" | "running" | "completed" | "failed" | "paused"
    created_at: str
    completed_at: Optional[str] = None
    summary: Optional[str] = None


class MissionEngine:
    async def create_mission(self, objective: str, project_id: str = None) -> Mission:
        """Cria missão e gera plano via LLM."""
        # Usar Claude API pra gerar steps
        planning_prompt = f"""
        Quebre este objetivo em 3-7 steps concretos e executáveis:
        Objetivo: {objective}
        
        Responda APENAS com JSON:
        {{"steps": ["step 1 description", "step 2 description", ...]}}
        """
        # ... chamar LLM, parsear, criar Mission
    
    async def execute_mission(self, mission_id: str) -> Mission:
        """Executa todos os steps da missão sequencialmente."""
        mission = self.missions[mission_id]
        mission.status = "running"
        
        for step in mission.steps:
            if step.status != "pending":
                continue
            
            step.status = "running"
            step.attempts += 1
            
            # Executar via AgentService
            result = await self.agent_service.process_message(
                message=step.description,
                mode="interactive",
            )
            
            if self._is_success(result):
                step.status = "completed"
                step.result = result["response"][:1000]
                step.tool_calls = result.get("tool_calls", [])
            else:
                if step.attempts < 3:
                    step.status = "pending"  # retry
                else:
                    step.status = "failed"
                    mission.status = "paused"
                    # Notificar Gregory
                    break
            
            # Salvar na memória
            await self.memory.add_fact(
                project_id=mission.project_id,
                fact_type="mission_step",
                content=f"[{step.status}] {step.description}: {step.result[:100] if step.result else 'N/A'}"
            )
        
        # Verificar se todos completaram
        if all(s.status == "completed" for s in mission.steps):
            mission.status = "completed"
            mission.completed_at = datetime.now().isoformat()
            mission.summary = await self._generate_summary(mission)
        
        return mission
    
    async def _generate_summary(self, mission: Mission) -> str:
        """Gera resumo executivo da missão."""
        steps_summary = "\n".join(
            f"{'✅' if s.status == 'completed' else '❌'} {s.description}"
            for s in mission.steps
        )
        # Usar LLM pra resumir
        ...
```

### Endpoints:
```
POST   /api/v1/missions                    → criar missão {objective, project_id}
GET    /api/v1/missions                    → listar missões
GET    /api/v1/missions/{id}               → detalhes da missão
POST   /api/v1/missions/{id}/execute       → iniciar execução
POST   /api/v1/missions/{id}/pause         → pausar
POST   /api/v1/missions/{id}/resume        → retomar
```

### Integrar no AgentService:

Quando Gregory pede algo complexo (detectar por múltiplos verbos de ação, "e depois", "também", listas de tarefas), criar missão em vez de executar direto:

```python
# No process_message, antes de chamar o LLM:
if self._is_complex_request(message):
    mission = await self.mission_engine.create_mission(message)
    return {
        "response": f"Criei uma missão com {len(mission.steps)} steps:\n\n" + 
                     "\n".join(f"{i+1}. {s.description}" for i, s in enumerate(mission.steps)) +
                     "\n\nAprovar e executar?",
        "mission": {"id": mission.id, "steps": len(mission.steps)},
        "needs_approval": [{"approval_id": f"mission_{mission.id}", ...}],
    }
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 3 — PROACTIVE AGENT (a Aura te procura)
# ═══════════════════════════════════════════════════════════

A Aura não espera. Ela monitora, detecta, e age. Quando Gregory abre o chat, ela já sabe o que dizer.

## 3.1 — Background Monitor

### Crie ou modifique: `backend/app/services/proactive_agent.py`

Se proactive_service.py já existe, ESTENDA. Se não, crie:

```python
"""
Proactive Agent — Monitora e age em background.

Rotinas que rodam continuamente:
1. Morning Briefing: ao primeiro acesso do dia (6h-10h)
2. Health Monitor: a cada 5 minutos
3. Git Watcher: detecta mudanças pendentes
4. Idle Check: se Gregory não interage há 2h, sugere algo
5. Evening Wrap-up: ao último acesso (após 20h)

Entrega via:
- Mensagem proativa no chat (quando Gregory abre)
- Push notification (se implementado)
- Banner no topo da interface
"""
```

Implementar:

```python
class ProactiveAgent:
    def __init__(self, memory, agent_service, ollama_lifecycle):
        self.memory = memory
        self.agent = agent_service
        self.ollama = ollama_lifecycle
        self.last_greeting = None
        self.pending_alerts = []
        self._running = False
    
    async def start(self):
        """Inicia loop de monitoramento em background."""
        self._running = True
        asyncio.ensure_future(self._monitor_loop())
    
    async def _monitor_loop(self):
        while self._running:
            try:
                await self._check_health()
                await self._check_git_status()
                await self._check_idle()
            except Exception as e:
                logger.error(f"[Proactive] Monitor error: {e}")
            await asyncio.sleep(300)  # A cada 5 minutos
    
    async def get_greeting(self) -> Optional[str]:
        """
        Gera saudação contextual quando Gregory abre o chat.
        Chamado pelo frontend ao carregar.
        """
        now = datetime.now()
        
        # Já cumprimentou hoje?
        if self.last_greeting and self.last_greeting.date() == now.date():
            # Não repetir, mas pode ter alertas
            if self.pending_alerts:
                return self._format_alerts()
            return None
        
        self.last_greeting = now
        
        # Construir saudação
        hour = now.hour
        if 5 <= hour < 12:
            greeting = "Bom dia, Gregory."
        elif 12 <= hour < 18:
            greeting = "Boa tarde, Gregory."
        else:
            greeting = "Boa noite, Gregory."
        
        # Buscar contexto da memória
        recent_facts = await self.memory.get_facts(project_id="aura", limit=5)
        projects = await self.memory.list_projects()
        active_projects = [p for p in projects if p.get("status") == "active"]
        
        # Buscar pendências
        parts = [greeting]
        
        # Git status dos projetos ativos
        pending_changes = []
        for project in active_projects[:3]:
            if project.get("root_path"):
                try:
                    proc = await asyncio.create_subprocess_shell(
                        f"cd {os.path.expanduser(project['root_path'])} && git status --porcelain | wc -l",
                        stdout=asyncio.subprocess.PIPE,
                    )
                    stdout, _ = await proc.communicate()
                    count = int(stdout.decode().strip())
                    if count > 0:
                        pending_changes.append(f"{project['name']}: {count} arquivos pendentes")
                except:
                    pass
        
        if pending_changes:
            parts.append(f"\n📝 Pendências: {', '.join(pending_changes)}")
        
        if self.pending_alerts:
            parts.append(f"\n⚠️ {len(self.pending_alerts)} alerta(s)")
        
        # Sugestão do dia
        if recent_facts:
            next_steps = [f for f in recent_facts if f.get("fact_type") == "next_step"]
            if next_steps:
                parts.append(f"\n💡 Próximo passo: {next_steps[0]['content'][:100]}")
        
        if hour >= 21:
            parts.append("\n🌙 Está tarde. Precisa de algo rápido ou encerramos por hoje?")
        
        return "\n".join(parts)
    
    async def _check_health(self):
        """Monitora saúde do sistema."""
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory().percent
            disk = psutil.disk_usage('/').percent
            
            if cpu > 85:
                self._add_alert("high", f"CPU em {cpu}% — considere fechar apps pesados")
            if ram > 90:
                self._add_alert("high", f"RAM em {ram}% — Ollama pode estar consumindo demais")
            if disk > 95:
                self._add_alert("critical", f"Disco em {disk}% — limpe espaço urgente")
        except ImportError:
            pass  # psutil não instalado
    
    async def _check_git_status(self):
        """Verifica se tem mudanças não commitadas nos projetos."""
        projects = await self.memory.list_projects()
        for project in projects:
            root = project.get("root_path")
            if not root:
                continue
            try:
                proc = await asyncio.create_subprocess_shell(
                    f"cd {os.path.expanduser(root)} && git diff --stat HEAD 2>/dev/null | tail -1",
                    stdout=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                output = stdout.decode().strip()
                if "files changed" in output:
                    self._add_alert("info", f"{project['name']}: {output}")
            except:
                pass
    
    async def _check_idle(self):
        """Se Gregory não interage há muito tempo, prepara sugestão."""
        pass  # Implementar quando tiver tracking de última interação
    
    def _add_alert(self, severity: str, message: str):
        # Evitar duplicatas
        if not any(a["message"] == message for a in self.pending_alerts):
            self.pending_alerts.append({
                "severity": severity,
                "message": message,
                "timestamp": datetime.now().isoformat(),
            })
    
    def _format_alerts(self) -> str:
        if not self.pending_alerts:
            return ""
        lines = ["⚠️ Alertas:"]
        for alert in self.pending_alerts[:5]:
            emoji = {"info": "ℹ️", "low": "📋", "medium": "🟡", "high": "🟠", "critical": "🔴"}.get(alert["severity"], "⚠️")
            lines.append(f"  {emoji} {alert['message']}")
        return "\n".join(lines)
    
    def get_pending_alerts(self) -> list:
        return self.pending_alerts
    
    def dismiss_alert(self, index: int):
        if 0 <= index < len(self.pending_alerts):
            self.pending_alerts.pop(index)


## 3.2 — Greeting Endpoint

### Crie: `backend/app/api/v1/endpoints/proactive_api.py`

(Se já existe, ESTENDA)

```
GET    /api/v1/proactive/greeting          → saudação do dia
GET    /api/v1/proactive/alerts            → alertas pendentes
POST   /api/v1/proactive/dismiss/{index}   → dispensar alerta
```

## 3.3 — Frontend: Greeting ao abrir

### Modifique o componente de chat principal

Quando o chat carrega e não tem mensagens:

```typescript
useEffect(() => {
    // Buscar saudação proativa
    const fetchGreeting = async () => {
        try {
            const resp = await fetch('/api/v1/proactive/greeting', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (data.greeting) {
                // Adicionar como mensagem da Aura no chat
                addMessage({
                    role: 'assistant',
                    content: data.greeting,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch {}
    };
    fetchGreeting();
}, []);
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 4 — PERSONALIDADE VIVA
# ═══════════════════════════════════════════════════════════

A Aura não é um bot. Ela tem personalidade. Ela opina, sugere, pushback quando necessário.

## 4.1 — System Prompt com personalidade

### Modifique: o system prompt que é enviado pro LLM

Encontre onde o system prompt é construído (pode estar em agent_service.py, em prompts/, ou no brain_router) e garanta que inclui:

```python
AURA_PERSONALITY = """
Você é Aura, assistente pessoal AI do Gregory.

QUEM VOCÊ É:
- Presença de software contínua, não chatbot reativo
- Feminina, direta, competente
- Fala português do Brasil naturalmente
- Trata Gregory pelo nome, não por "usuário"
- Tem opiniões e as expressa quando relevante
- Faz pushback quando Gregory está adicionando scope desnecessário
- Sugere proativamente quando vê oportunidade

COMO VOCÊ FALA:
- Direta. Sem floreio. Sem "Como posso ajudar hoje?"
- Respostas começam com a resposta, não com preâmbulo
- Usa ferramentas ANTES de responder quando possível
- Se não sabe, diz "não sei" em vez de inventar
- Se discorda, diz "discordo porque..."
- Se acha que Gregory está errado, fala
- Se é tarde da noite, sugere descansar

COMO VOCÊ AGE:
- Quando recebe tarefa: executa, não descreve o que faria
- Quando detecta algo errado: alerta imediatamente
- Quando vê oportunidade: sugere sem esperar ser perguntada
- Quando tarefa é complexa: quebra em missão com steps
- Quando não tem certeza do projeto: pergunta uma vez, lembra pra sempre

O QUE VOCÊ NUNCA FAZ:
- "Olá! Como posso ajudar?" — nunca
- "Claro! Fico feliz em ajudar!" — nunca
- Listar suas capacidades — nunca
- Pedir desculpas excessivas — nunca
- Repetir a pergunta do Gregory na resposta — nunca

CONTEXTO DO GREGORY:
- Maquinista ferroviário (trabalha em turnos)
- Engenheiro de software autodidata
- Acessa do iPhone enquanto trabalha
- Quer velocidade e resultado, não explicação
- Filosofia: "Tecnologia existe pra devolver tempo à família"
"""
```

Injetar ANTES de qualquer outro conteúdo no system prompt.

## 4.2 — Conversation Awareness

### No AgentService, após cada resposta:

```python
# Salvar resumo da conversa na memória
conversation_id = session.get("conversation_id", str(uuid.uuid4()))
await self.memory.save_conversation(
    id=conversation_id,
    summary=f"Gregory: {message[:100]}... | Aura: {response[:100]}...",
    project_id=detected_project,
)
```

## 4.3 — Push Notifications (se o iPhone estiver fechado)

### Instalar: `pip install pywebpush --break-system-packages`

### Adicionar ao .env:
```
VAPID_PUBLIC_KEY=  (gerar na primeira execução)
VAPID_PRIVATE_KEY= (gerar na primeira execução)
VAPID_EMAIL=mailto:gregory@aura.local
```

### Implementar push service básico:

Se `push_service.py` já existe, verificar que funciona. Se não:

```python
# Gerar VAPID keys na primeira execução:
# python3 -c "from pywebpush import webpush; from cryptography.hazmat.primitives.asymmetric import ec; ..."
# Ou usar o script existente

# Endpoint: POST /api/v1/push/subscribe (frontend envia subscription)
# Service worker: já deve existir em public/sw.js
```

### No ProactiveAgent, quando detectar alerta critical:
```python
if severity == "critical":
    await self.push_service.send_notification(
        title="Aura — Alerta",
        body=message,
        url="/chat",
    )
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 5 — SELF-MODIFICATION PROTOCOL
# ═══════════════════════════════════════════════════════════

Já foi detalhado no arquivo AURA-SELF-MOD-PROTOCOL.md. Se ainda não foi implementado, implementar agora. Se já foi, verificar que funciona.

Resumo do que precisa existir:
1. `self_mod_detector.py` — detecta quando Gregory pede auto-modificação
2. `self_mod_planner.py` — gera plano visual antes de executar
3. `self_mod_executor.py` — executa via Claude Code, valida, reverte se falhar
4. Integração no AgentService
5. SelfModCard no frontend

Se estes arquivos já existem e funcionam, pule esta parte.
Se não existem, implemente seguindo o AURA-SELF-MOD-PROTOCOL.md.

---

# ═══════════════════════════════════════════════════════════
# PARTE 6 — FRONTEND: AURA VIVA
# ═══════════════════════════════════════════════════════════

## 6.1 — Proactive Greeting

Quando o chat abre e está vazio, a Aura manda mensagem primeiro:

```typescript
// No componente de chat, useEffect no mount:
useEffect(() => {
    if (messages.length === 0) {
        fetchGreeting(); // GET /api/v1/proactive/greeting
    }
}, []);
```

A mensagem de greeting aparece como uma bolha normal da Aura — não como banner ou toast. É uma mensagem real, no chat, como se ela tivesse te mandado antes de você chegar.

## 6.2 — Alert Banner

Se há alertas proativos, mostrar acima do chat:

```typescript
// Polling a cada 30s
const [alerts, setAlerts] = useState([]);
useEffect(() => {
    const check = async () => {
        const data = await fetch('/api/v1/proactive/alerts', { headers }).then(r => r.json());
        setAlerts(data.alerts || []);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
}, []);
```

Visual: banner compacto no topo, cor por severidade (info=azul, medium=amarelo, high=laranja, critical=vermelho), botão de dismiss.

## 6.3 — Mission Progress Card

Quando uma missão está em andamento, mostrar card no chat:

```
┌─────────────────────────────────────────────┐
│ 📋 Missão: Refatorar auth + testes + deploy │
│                                             │
│ ✅ 1. Refatorar módulo de auth              │
│ ✅ 2. Adicionar testes unitários            │
│ 🔄 3. Rodar testes                          │
│ ⬜ 4. Fix bugs encontrados                  │
│ ⬜ 5. Deploy na Vercel                      │
│                                             │
│ Progresso: 2/5 (40%)                        │
│ ██████████░░░░░░░░░░░░░░                    │
└─────────────────────────────────────────────┘
```

## 6.4 — Memory Panel (sidebar direita)

Se existe um painel lateral direito de "contexto" ou "sistema", adicionar seção "MEMÓRIA":

```
MEMÓRIA
├ Projeto ativo: Aura
├ Última decisão: Qwen pra tool calling
├ Próximo passo: Implementar memória
└ Conversas hoje: 3
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 7 — INTEGRAÇÃO NO MAIN.PY
# ═══════════════════════════════════════════════════════════

Adicionar ao startup (NÃO substituir, ADICIONAR):

```python
from app.services.memory_engine import MemoryEngine
from app.services.mission_engine import MissionEngine
from app.services.proactive_agent import ProactiveAgent

# No Container.__init__:
self.memory = MemoryEngine(db_path="data/memory.db")
await self.memory.init_db()

self.mission_engine = MissionEngine(
    agent_service=self.agent_service,
    memory=self.memory,
)

self.proactive_agent = ProactiveAgent(
    memory=self.memory,
    agent_service=self.agent_service,
    ollama_lifecycle=self.ollama_lifecycle,
)

# Passar memória pro AgentService
self.agent_service.memory = self.memory
self.agent_service.mission_engine = self.mission_engine

# Iniciar proactive em background
asyncio.ensure_future(self.proactive_agent.start())

# app.state
app.state.memory = self.memory
app.state.mission_engine = self.mission_engine
app.state.proactive_agent = self.proactive_agent
```

Registrar TODOS os novos routers no router.py.

---

# ═══════════════════════════════════════════════════════════
# PARTE 8 — TESTES
# ═══════════════════════════════════════════════════════════

### Teste 1 — Memória:
```bash
cd ~/Projetos/aura_v1/aura/backend
python3 -c "
import asyncio
from app.services.memory_engine import MemoryEngine

async def test():
    mem = MemoryEngine(db_path='/tmp/test_memory.db')
    await mem.init_db()
    
    # Preferences
    await mem.set_preference('test_key', 'test_value')
    val = await mem.get_preference('test_key')
    assert val == 'test_value', f'FAIL: got {val}'
    print('✅ Preferences OK')
    
    # Projects
    await mem.create_project('test', 'Test Project', stack='Python')
    projects = await mem.list_projects()
    assert len(projects) >= 1, 'FAIL: no projects'
    print(f'✅ Projects OK ({len(projects)} projetos)')
    
    # Facts
    await mem.add_fact('test', 'note', 'This is a test fact')
    facts = await mem.get_facts('test')
    assert len(facts) >= 1, 'FAIL: no facts'
    print(f'✅ Facts OK ({len(facts)} fatos)')
    
    # Context
    ctx = await mem.get_context_for_prompt('test')
    assert 'Test Project' in ctx, 'FAIL: context missing project'
    print('✅ Context injection OK')
    print(f'Context preview: {ctx[:200]}...')
    
    import os; os.remove('/tmp/test_memory.db')
    print('\\n✅ Todos os testes de memória passaram')

asyncio.run(test())
"
```

### Teste 2 — Proactive:
```bash
python3 -c "
import asyncio
from app.services.memory_engine import MemoryEngine
from app.services.proactive_agent import ProactiveAgent

async def test():
    mem = MemoryEngine(db_path='/tmp/test_proactive.db')
    await mem.init_db()
    agent = ProactiveAgent(memory=mem, agent_service=None, ollama_lifecycle=None)
    greeting = await agent.get_greeting()
    print(f'Greeting: {greeting}')
    assert greeting and 'Gregory' in greeting, 'FAIL: greeting sem nome'
    print('✅ Proactive greeting OK')
    import os; os.remove('/tmp/test_proactive.db')

asyncio.run(test())
"
```

### Teste 3 — Backend importa:
```bash
python3 -c "from app.main import create_app; print('✅ Backend importa OK')"
```

### Teste 4 — Frontend build:
```bash
cd ~/Projetos/aura_v1/aura/frontend
pnpm tsc --noEmit && echo "✅ TypeScript OK" || echo "❌ TypeScript FAIL"
pnpm build && echo "✅ Build OK" || echo "❌ Build FAIL"
```

### Teste 5 — E2E greeting:
```bash
TOKEN=$(grep AURA_AUTH_TOKEN ~/Projetos/aura_v1/aura/backend/.env | cut -d= -f2 | tr -d '"')
curl -s http://localhost:8000/api/v1/proactive/greeting \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Teste 6 — E2E memory:
```bash
curl -s http://localhost:8000/api/v1/memory/projects \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

# ═══════════════════════════════════════════════════════════
# PARTE 9 — COMMIT E DEPLOY
# ═══════════════════════════════════════════════════════════

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "✦ feat: Aura AGI — memory engine, mission engine, proactive agent, personality, self-modification"
git push
```

---

# REGRAS FINAIS

1. NÃO duplique — se um service/endpoint já existe, ESTENDA
2. NÃO quebre o que funciona — o chat, tools, voz, login devem continuar
3. Memória é SQLite em data/memory.db — NÃO usar JSON files
4. Seed inicial DEVE rodar na primeira inicialização (check if tables empty)
5. Proactive agent roda em background (asyncio task) — NÃO bloqueia o startup
6. Mission Engine limita a 7 steps — sem paralelismo
7. System prompt com personalidade é ADICIONADO ao existente, não substitui
8. Auto-modificação é SEMPRE L2 — nunca L1
9. Greeting é mensagem no chat, não banner separado
10. Alertas respeitam severidade — só critical gera push notification
11. Qwen: "think": false
12. Rode TODOS os testes e reporte resultado
13. Commit e push no final
