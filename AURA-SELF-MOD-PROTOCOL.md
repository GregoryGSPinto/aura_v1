# AURA — PROTOCOLO DE AUTO-MODIFICAÇÃO (Self-Expansion)

**Objetivo:** Permitir que a Aura modifique seu próprio código quando Gregory pedir, com total transparência e segurança.
**Regra inegociável:** Auto-modificação é SEMPRE L2. Nunca L1. Nunca promovível. Gregory sempre sabe o que está acontecendo.

---

## ANTES DE TUDO

Leia estes arquivos:

```
~/Projetos/aura_v1/CLAUDE.md
~/Projetos/aura_v1/aura/backend/app/services/agent_service.py
~/Projetos/aura_v1/aura/backend/app/tools/claude_code_tool.py
~/Projetos/aura_v1/aura/backend/app/tools/tool_registry.py (ou equivalente)
~/Projetos/aura_v1/aura/backend/app/tools/__init__.py
~/Projetos/aura_v1/aura/backend/app/tools/shell_tool.py
~/Projetos/aura_v1/aura/backend/app/tools/git_tool.py
~/Projetos/aura_v1/aura/backend/app/api/v1/endpoints/agent_api.py
~/Projetos/aura_v1/aura/backend/app/main.py
~/Projetos/aura_v1/aura/frontend/components/chat/tool-call-block.tsx (ou equivalente)
~/Projetos/aura_v1/aura/frontend/components/chat/ApprovalBanner.tsx (ou equivalente)
~/Projetos/aura_v1/aura/frontend/components/chat/message-bubble.tsx
~/Projetos/aura_v1/aura/frontend/lib/api.ts
```

**NÃO quebre nada que já funciona.**

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 1 — SELF-MODIFICATION DETECTOR
# ═══════════════════════════════════════════════════════════

O detector identifica quando Gregory está pedindo pra Aura modificar a si mesma.

### Crie: `backend/app/services/self_mod_detector.py`

```python
"""
Self-Modification Detector — Identifica pedidos de auto-modificação.

Quando Gregory diz algo como:
- "adiciona uma tool de email"
- "muda o timeout do Ollama pra 5 minutos"
- "cria um endpoint novo no backend"
- "atualiza o design da sidebar"
- "melhora o prompt do agent"
- "se atualiza pra fazer X"

...o detector classifica como AUTO-MODIFICAÇÃO.

Auto-modificação = qualquer alteração em:
- backend/app/ (qualquer arquivo Python da Aura)
- frontend/components/ (qualquer componente React)
- frontend/lib/ (stores, api, utils)
- frontend/app/ (páginas)
- scripts/ (scripts de boot/deploy)
- CLAUDE.md, .env (configuração)

NÃO é auto-modificação:
- Trabalhar em OUTROS projetos (Black Belt, Rail360)
- Criar arquivos em ~/Projetos/outro_projeto/
- Operações de leitura (git status, ls, cat)
- Pesquisa e análise
"""

import re
import logging
from typing import Optional, List
from dataclasses import dataclass

logger = logging.getLogger("aura")


# Paths que são "a Aura"
AURA_PATHS = [
    "aura/backend/",
    "aura/frontend/",
    "aura_v1/aura/",
    "scripts/",
    "CLAUDE.md",
    ".env",
    "backend/app/",
    "frontend/components/",
    "frontend/lib/",
    "frontend/app/",
]

# Patterns que indicam pedido de auto-modificação (PT + EN)
SELF_MOD_PATTERNS = [
    # Português
    r"\b(adiciona|cria|implementa|faz|coloca|bota|mete)\b.*\b(tool|ferramenta|endpoint|rota|componente|tela|página|serviço|service)\b",
    r"\b(muda|altera|modifica|atualiza|melhora|refatora|corrige|arruma|conserta)\b.*\b(seu|teu|da aura|do backend|do frontend|no código|na aura)\b",
    r"\b(se\s+atualiza|se\s+modifica|se\s+melhora|se\s+expande)\b",
    r"\b(novo|nova)\s+(tool|endpoint|componente|serviço|funcionalidade|feature)\b",
    r"\b(remove|deleta|tira)\b.*\b(tool|endpoint|componente)\b.*\b(da aura|do backend|do frontend)\b",
    r"\bauto[\s-]?(modifica|atualiza|expande|melhora)\b",
    r"\b(evolui|evolua|upgrade)\b.*\b(aura|backend|frontend)\b",
    r"\b(adiciona|implementa)\b.*\b(na|no|pra)\s+(aura|backend|frontend|chat)\b",
    r"\b(muda|troca|configura)\b.*\b(timeout|porta|modelo|prompt|comportamento)\b.*\b(da aura|do backend|do ollama)\b",
    # English
    r"\b(add|create|implement|build)\b.*\b(tool|endpoint|route|component|service|feature)\b.*\b(to aura|in aura|for aura)\b",
    r"\b(modify|change|update|improve|refactor|fix)\b.*\b(your|aura|backend|frontend)\b",
    r"\bself[\s-]?(modify|update|improve|expand)\b",
]

# Patterns de LEITURA (NÃO são auto-modificação)
READ_ONLY_PATTERNS = [
    r"\b(mostra|lista|veja|leia|analisa|verifica|checa)\b",
    r"\b(git\s+status|git\s+log|git\s+diff)\b",
    r"\b(ls|cat|head|tail|grep|find)\b",
    r"\b(quantos?|qual|como\s+está|o\s+que\s+tem)\b",
]


@dataclass
class SelfModAnalysis:
    is_self_modification: bool
    confidence: float  # 0.0 a 1.0
    affected_areas: List[str]  # ["backend/tools", "frontend/components"]
    description: str  # Resumo legível do que seria modificado
    risk_level: str  # "low", "medium", "high"
    requires_restart: bool  # Se precisa reiniciar o backend


def detect_self_modification(message: str) -> SelfModAnalysis:
    """
    Analisa se a mensagem do Gregory pede auto-modificação da Aura.
    
    Retorna SelfModAnalysis com detalhes do que seria afetado.
    """
    message_lower = message.lower().strip()
    
    # Primeiro: é read-only? Se sim, não é auto-mod
    for pattern in READ_ONLY_PATTERNS:
        if re.search(pattern, message_lower):
            # Pode ser read-only, mas verifica se também tem mod patterns
            has_mod = any(re.search(p, message_lower) for p in SELF_MOD_PATTERNS)
            if not has_mod:
                return SelfModAnalysis(
                    is_self_modification=False,
                    confidence=0.9,
                    affected_areas=[],
                    description="Operação de leitura",
                    risk_level="low",
                    requires_restart=False,
                )
    
    # Verificar patterns de auto-modificação
    matches = []
    for pattern in SELF_MOD_PATTERNS:
        if re.search(pattern, message_lower):
            matches.append(pattern)
    
    if not matches:
        return SelfModAnalysis(
            is_self_modification=False,
            confidence=0.7,
            affected_areas=[],
            description="Não identificado como auto-modificação",
            risk_level="low",
            requires_restart=False,
        )
    
    # É auto-modificação — analisar o que seria afetado
    affected = []
    requires_restart = False
    risk = "low"
    
    # Detectar áreas afetadas
    backend_keywords = ["backend", "endpoint", "rota", "serviço", "service", "tool", "ferramenta",
                        "api", "python", "fastapi", "ollama", "timeout", "modelo", "prompt"]
    frontend_keywords = ["frontend", "componente", "tela", "página", "design", "sidebar",
                         "chat", "botão", "input", "visual", "ui", "css", "tailwind"]
    infra_keywords = ["script", "boot", "deploy", "vercel", "ngrok", "launchagent",
                      ".env", "configuração", "config", "porta"]
    
    for kw in backend_keywords:
        if kw in message_lower:
            affected.append("backend")
            requires_restart = True
            break
    
    for kw in frontend_keywords:
        if kw in message_lower:
            affected.append("frontend")
            break
    
    for kw in infra_keywords:
        if kw in message_lower:
            affected.append("infra")
            risk = "medium"
            break
    
    if not affected:
        affected = ["backend"]  # default se não conseguiu detectar
        requires_restart = True
    
    # Avaliar risco
    high_risk_keywords = ["delete", "remove", "deleta", ".env", "token", "auth",
                          "segurança", "security", "senha", "password", "force"]
    if any(kw in message_lower for kw in high_risk_keywords):
        risk = "high"
    
    # Gerar descrição
    if "tool" in message_lower or "ferramenta" in message_lower:
        desc = "Criar/modificar tool no backend"
    elif "endpoint" in message_lower or "rota" in message_lower:
        desc = "Criar/modificar endpoint da API"
    elif "componente" in message_lower or "tela" in message_lower:
        desc = "Criar/modificar componente do frontend"
    elif "design" in message_lower or "visual" in message_lower:
        desc = "Modificar aparência do frontend"
    elif "config" in message_lower or "timeout" in message_lower:
        desc = "Alterar configuração do sistema"
    else:
        desc = "Modificar código da Aura"
    
    confidence = min(0.5 + (len(matches) * 0.15), 0.95)
    
    logger.info(f"[SelfMod] Detectado: {desc} | Áreas: {affected} | Risco: {risk} | Confiança: {confidence}")
    
    return SelfModAnalysis(
        is_self_modification=True,
        confidence=confidence,
        affected_areas=affected,
        description=desc,
        risk_level=risk,
        requires_restart=requires_restart,
    )
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 2 — SELF-MODIFICATION PLANNER
# ═══════════════════════════════════════════════════════════

Quando auto-modificação é detectada, o planner gera um plano ANTES de executar.

### Crie: `backend/app/services/self_mod_planner.py`

```python
"""
Self-Modification Planner — Gera plano de modificação para aprovação.

Quando Gregory pede pra Aura se modificar, o planner:
1. Analisa o que precisa mudar
2. Lista os arquivos que serão afetados
3. Descreve as mudanças em linguagem clara
4. Estima o impacto (risco, precisa reiniciar?)
5. Apresenta tudo pro Gregory aprovar ANTES de executar

Nada é executado sem aprovação explícita.
"""

import json
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime

from app.services.self_mod_detector import SelfModAnalysis

logger = logging.getLogger("aura")


@dataclass
class ModificationPlan:
    id: str
    timestamp: str
    request: str  # O que Gregory pediu
    analysis: Dict[str, Any]  # SelfModAnalysis como dict
    plan_description: str  # Descrição humana do plano
    files_affected: list  # Lista de arquivos que serão modificados
    steps: list  # Passos que serão executados
    risk_level: str
    requires_restart: bool
    requires_rebuild: bool
    claude_code_prompt: str  # O prompt que será enviado pro Claude Code
    status: str  # "pending_approval" | "approved" | "rejected" | "executing" | "completed" | "failed"
    result: Optional[str] = None


class SelfModPlanner:
    """
    Gera planos de auto-modificação para aprovação do Gregory.
    """
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client  # Claude API ou Ollama pra gerar o plano
        self.plans: Dict[str, ModificationPlan] = {}
    
    async def create_plan(self, request: str, analysis: SelfModAnalysis) -> ModificationPlan:
        """
        Cria um plano de modificação baseado no pedido e na análise.
        
        Se tiver LLM client disponível, usa pra gerar plano inteligente.
        Se não, gera plano básico baseado em patterns.
        """
        plan_id = f"selfmod_{int(datetime.now().timestamp())}"
        
        # Gerar o prompt que será enviado pro Claude Code
        claude_prompt = self._build_claude_code_prompt(request, analysis)
        
        # Inferir arquivos afetados e passos
        files, steps = self._infer_changes(request, analysis)
        
        plan = ModificationPlan(
            id=plan_id,
            timestamp=datetime.now().isoformat(),
            request=request,
            analysis=asdict(analysis) if hasattr(analysis, '__dataclass_fields__') else {},
            plan_description=self._generate_description(request, analysis, files, steps),
            files_affected=files,
            steps=steps,
            risk_level=analysis.risk_level,
            requires_restart="backend" in analysis.affected_areas,
            requires_rebuild="frontend" in analysis.affected_areas,
            claude_code_prompt=claude_prompt,
            status="pending_approval",
        )
        
        self.plans[plan_id] = plan
        logger.info(f"[SelfMod] Plano criado: {plan_id} — {plan.plan_description}")
        
        return plan
    
    def _build_claude_code_prompt(self, request: str, analysis: SelfModAnalysis) -> str:
        """Constrói o prompt que será enviado pro Claude Code CLI."""
        
        areas = ", ".join(analysis.affected_areas)
        
        prompt = f"""Leia ~/Projetos/aura_v1/CLAUDE.md para contexto do projeto.

TAREFA: {request}

Áreas afetadas: {areas}

REGRAS:
1. Leia os arquivos existentes ANTES de modificar
2. NÃO quebre o que já funciona
3. Siga o padrão de código existente (imports, naming, estrutura)
4. Se criar nova tool, registre no __init__.py e no router.py
5. Se modificar backend, rode: cd ~/Projetos/aura_v1/aura/backend && python3 -c "from app.main import create_app; print('OK')"
6. Se modificar frontend, rode: cd ~/Projetos/aura_v1/aura/frontend && pnpm tsc --noEmit
7. No final, mostre resumo de todos os arquivos criados/modificados
8. NÃO faça commit — o protocolo de auto-modificação faz isso depois

Implemente agora. Não pergunte nada."""
        
        return prompt
    
    def _infer_changes(self, request: str, analysis: SelfModAnalysis) -> tuple:
        """Infere quais arquivos serão afetados e quais passos serão executados."""
        files = []
        steps = []
        
        request_lower = request.lower()
        
        if "tool" in request_lower or "ferramenta" in request_lower:
            files.extend([
                "backend/app/tools/novo_tool.py (criar)",
                "backend/app/tools/__init__.py (registrar)",
                "backend/app/api/v1/router.py (se precisar endpoint)",
            ])
            steps.extend([
                "Criar arquivo da tool com BaseTool",
                "Registrar no tool registry",
                "Testar importação",
            ])
        
        if "endpoint" in request_lower or "rota" in request_lower:
            files.extend([
                "backend/app/api/v1/endpoints/novo_endpoint.py (criar)",
                "backend/app/api/v1/router.py (registrar)",
            ])
            steps.extend([
                "Criar endpoint com FastAPI router",
                "Registrar no router principal",
                "Testar resposta",
            ])
        
        if "componente" in request_lower or "tela" in request_lower or "frontend" in request_lower:
            files.extend([
                "frontend/components/novo_componente.tsx (criar/modificar)",
            ])
            steps.extend([
                "Criar/modificar componente React",
                "TypeScript check",
                "Build check",
            ])
        
        if "config" in request_lower or "timeout" in request_lower or ".env" in request_lower:
            files.extend([
                "backend/app/core/config.py (modificar)",
                "backend/.env (se necessário)",
            ])
            steps.extend([
                "Modificar configuração",
                "Verificar que backend inicia",
            ])
        
        # Steps finais sempre
        steps.extend([
            "Validar que nada quebrou",
            "Reportar resultado ao Gregory",
        ])
        
        if not files:
            files = ["(será determinado pelo Claude Code durante execução)"]
        
        return files, steps
    
    def _generate_description(self, request: str, analysis: SelfModAnalysis, 
                              files: list, steps: list) -> str:
        """Gera descrição legível do plano."""
        areas = " e ".join(analysis.affected_areas)
        risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}[analysis.risk_level]
        restart = "⚠️ Requer reinício do backend." if analysis.requires_restart else ""
        
        desc = f"""AUTO-MODIFICAÇÃO DETECTADA {risk_emoji}

📋 Pedido: "{request}"
🎯 Tipo: {analysis.description}
📁 Áreas: {areas}
{restart}

Arquivos que serão afetados:
{chr(10).join(f"  • {f}" for f in files)}

Passos:
{chr(10).join(f"  {i+1}. {s}" for i, s in enumerate(steps))}"""
        
        return desc
    
    def get_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        return self.plans.get(plan_id)
    
    def approve_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        plan = self.plans.get(plan_id)
        if plan and plan.status == "pending_approval":
            plan.status = "approved"
            return plan
        return None
    
    def reject_plan(self, plan_id: str) -> Optional[ModificationPlan]:
        plan = self.plans.get(plan_id)
        if plan and plan.status == "pending_approval":
            plan.status = "rejected"
            return plan
        return None
    
    def complete_plan(self, plan_id: str, result: str):
        plan = self.plans.get(plan_id)
        if plan:
            plan.status = "completed"
            plan.result = result
    
    def fail_plan(self, plan_id: str, error: str):
        plan = self.plans.get(plan_id)
        if plan:
            plan.status = "failed"
            plan.result = f"ERRO: {error}"
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 3 — SELF-MODIFICATION EXECUTOR
# ═══════════════════════════════════════════════════════════

Após aprovação, o executor roda o plano e reporta resultado.

### Crie: `backend/app/services/self_mod_executor.py`

```python
"""
Self-Modification Executor — Executa planos aprovados.

Fluxo:
1. Recebe plano aprovado
2. Executa via Claude Code CLI (claude -p "..." --no-input)
3. Monitora progresso
4. Valida resultado (backend importa? frontend builda?)
5. Se OK → commit + push automático
6. Se FALHA → reverte (git checkout) + reporta erro
7. Reporta resultado completo ao Gregory
"""

import asyncio
import os
import shutil
import logging
from typing import Optional
from datetime import datetime

from app.services.self_mod_planner import ModificationPlan

logger = logging.getLogger("aura")

AURA_ROOT = os.path.expanduser("~/Projetos/aura_v1")
BACKEND_DIR = os.path.join(AURA_ROOT, "aura/backend")
FRONTEND_DIR = os.path.join(AURA_ROOT, "aura/frontend")


class SelfModExecutor:
    """Executa planos de auto-modificação aprovados."""
    
    async def execute(self, plan: ModificationPlan) -> dict:
        """
        Executa um plano de auto-modificação.
        
        Retorna:
        {
            "success": bool,
            "output": str (output do Claude Code),
            "validation": {
                "backend_ok": bool,
                "frontend_ok": bool,
                "tests_ok": bool,
            },
            "committed": bool,
            "commit_hash": str | None,
            "error": str | None,
            "execution_time_seconds": float,
        }
        """
        start = asyncio.get_event_loop().time()
        plan.status = "executing"
        
        logger.info(f"[SelfMod] Executando plano {plan.id}: {plan.request}")
        
        # 1. Snapshot do estado atual (pra poder reverter)
        snapshot_hash = await self._git_snapshot()
        
        # 2. Executar via Claude Code
        claude_result = await self._run_claude_code(plan.claude_code_prompt)
        
        if not claude_result["success"]:
            await self._rollback(snapshot_hash)
            return {
                "success": False,
                "output": claude_result["output"],
                "validation": {"backend_ok": False, "frontend_ok": False, "tests_ok": False},
                "committed": False,
                "commit_hash": None,
                "error": f"Claude Code falhou: {claude_result['error']}",
                "execution_time_seconds": asyncio.get_event_loop().time() - start,
            }
        
        # 3. Validar resultado
        validation = await self._validate(plan)
        
        if not validation["backend_ok"]:
            logger.warning(f"[SelfMod] Validação falhou — revertendo")
            await self._rollback(snapshot_hash)
            return {
                "success": False,
                "output": claude_result["output"],
                "validation": validation,
                "committed": False,
                "commit_hash": None,
                "error": "Validação do backend falhou. Mudanças revertidas.",
                "execution_time_seconds": asyncio.get_event_loop().time() - start,
            }
        
        # 4. Commit + push
        commit_hash = await self._commit_and_push(plan)
        
        # 5. Reiniciar backend se necessário
        if plan.requires_restart:
            await self._restart_backend()
        
        return {
            "success": True,
            "output": claude_result["output"][:5000],  # Limitar output
            "validation": validation,
            "committed": True,
            "commit_hash": commit_hash,
            "error": None,
            "execution_time_seconds": asyncio.get_event_loop().time() - start,
        }
    
    async def _git_snapshot(self) -> str:
        """Salva o estado atual do git pra poder reverter."""
        proc = await asyncio.create_subprocess_shell(
            "git rev-parse HEAD",
            stdout=asyncio.subprocess.PIPE,
            cwd=AURA_ROOT,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode().strip()
    
    async def _rollback(self, commit_hash: str):
        """Reverte pra snapshot anterior."""
        logger.warning(f"[SelfMod] Revertendo para {commit_hash[:8]}")
        proc = await asyncio.create_subprocess_shell(
            f"git checkout -- . && git clean -fd",
            cwd=AURA_ROOT,
        )
        await proc.wait()
    
    async def _run_claude_code(self, prompt: str) -> dict:
        """Executa o Claude Code CLI."""
        claude_path = shutil.which("claude")
        if not claude_path:
            return {
                "success": False,
                "output": "",
                "error": "Claude Code CLI não encontrado no PATH",
            }
        
        # Escapar aspas no prompt
        safe_prompt = prompt.replace('"', '\\"')
        cmd = f'claude --dangerously-skip-permissions -p "{safe_prompt}" --no-input'
        
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
            
            output = stdout.decode("utf-8", errors="replace")
            errors = stderr.decode("utf-8", errors="replace")
            
            return {
                "success": proc.returncode == 0,
                "output": output,
                "error": errors if proc.returncode != 0 else None,
            }
        except asyncio.TimeoutError:
            return {
                "success": False,
                "output": "",
                "error": "Timeout: Claude Code excedeu 10 minutos",
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
            }
    
    async def _validate(self, plan: ModificationPlan) -> dict:
        """Valida que as mudanças não quebraram nada."""
        result = {"backend_ok": True, "frontend_ok": True, "tests_ok": True}
        
        # Validar backend (importação)
        if "backend" in plan.analysis.get("affected_areas", []):
            proc = await asyncio.create_subprocess_shell(
                'python3 -c "from app.main import create_app; print(\'OK\')"',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=BACKEND_DIR,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            result["backend_ok"] = proc.returncode == 0 and "OK" in stdout.decode()
            if not result["backend_ok"]:
                logger.error(f"[SelfMod] Backend validation failed: {stderr.decode()[:500]}")
        
        # Validar frontend (TypeScript)
        if "frontend" in plan.analysis.get("affected_areas", []):
            proc = await asyncio.create_subprocess_shell(
                "pnpm tsc --noEmit",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=FRONTEND_DIR,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            result["frontend_ok"] = proc.returncode == 0
            if not result["frontend_ok"]:
                logger.error(f"[SelfMod] Frontend validation failed: {stderr.decode()[:500]}")
        
        return result
    
    async def _commit_and_push(self, plan: ModificationPlan) -> Optional[str]:
        """Commit e push das mudanças."""
        try:
            # Add
            await (await asyncio.create_subprocess_shell(
                "git add -A", cwd=AURA_ROOT
            )).wait()
            
            # Commit
            msg = f"✦ self-mod: {plan.request[:60]}"
            proc = await asyncio.create_subprocess_shell(
                f'git commit -m "{msg}"',
                stdout=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
            )
            stdout, _ = await proc.communicate()
            
            # Extrair hash
            hash_proc = await asyncio.create_subprocess_shell(
                "git rev-parse --short HEAD",
                stdout=asyncio.subprocess.PIPE,
                cwd=AURA_ROOT,
            )
            hash_out, _ = await hash_proc.communicate()
            commit_hash = hash_out.decode().strip()
            
            # Push
            await (await asyncio.create_subprocess_shell(
                "git push origin main", cwd=AURA_ROOT
            )).wait()
            
            logger.info(f"[SelfMod] Committed and pushed: {commit_hash}")
            return commit_hash
            
        except Exception as e:
            logger.error(f"[SelfMod] Commit/push failed: {e}")
            return None
    
    async def _restart_backend(self):
        """Reinicia o backend da Aura."""
        logger.info("[SelfMod] Reiniciando backend...")
        try:
            # Kill backend atual
            await (await asyncio.create_subprocess_shell(
                "lsof -ti:8000 | xargs kill -9 2>/dev/null"
            )).wait()
            
            await asyncio.sleep(2)
            
            # Reiniciar
            await asyncio.create_subprocess_shell(
                f"cd {BACKEND_DIR} && nohup python3 -m uvicorn app.main:app "
                f"--host 0.0.0.0 --port 8000 >> ~/aura-boot.log 2>&1 &",
                cwd=BACKEND_DIR,
            )
            
            # Esperar ficar ready
            for _ in range(10):
                await asyncio.sleep(2)
                proc = await asyncio.create_subprocess_shell(
                    "curl -s http://localhost:8000/docs > /dev/null",
                )
                if (await proc.wait()) == 0:
                    logger.info("[SelfMod] Backend reiniciado com sucesso")
                    return
            
            logger.warning("[SelfMod] Backend não respondeu após restart")
        except Exception as e:
            logger.error(f"[SelfMod] Restart failed: {e}")
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 4 — INTEGRAÇÃO NO AGENT SERVICE
# ═══════════════════════════════════════════════════════════

### Modifique: `backend/app/services/agent_service.py`

Integre o detector e planner no fluxo do agent. O executor roda após aprovação.

No `process_message()`, ANTES de fazer qualquer tool call, adicione:

```python
from app.services.self_mod_detector import detect_self_modification
from app.services.self_mod_planner import SelfModPlanner
from app.services.self_mod_executor import SelfModExecutor

# No __init__ do AgentService, adicione:
self.self_mod_planner = SelfModPlanner()
self.self_mod_executor = SelfModExecutor()

# No início de process_message(), ANTES de chamar o LLM:

# Detectar auto-modificação
self_mod = detect_self_modification(message)

if self_mod.is_self_modification and self_mod.confidence > 0.6:
    # Gerar plano
    plan = await self.self_mod_planner.create_plan(message, self_mod)
    
    # Retornar plano para aprovação (NÃO executar ainda)
    return {
        "response": plan.plan_description,
        "tool_calls": [],
        "mode": "self_modification",
        "needs_approval": [{
            "approval_id": plan.id,
            "description": plan.plan_description,
            "tool": "self_modification",
            "risk_level": plan.risk_level,
            "files_affected": plan.files_affected,
        }],
        "execution_time_ms": 0,
        "self_mod_plan": {
            "id": plan.id,
            "request": plan.request,
            "risk_level": plan.risk_level,
            "requires_restart": plan.requires_restart,
            "requires_rebuild": plan.requires_rebuild,
        },
    }
```

### Modifique o handler de aprovação (agent_api.py ou onde approvals são processados):

Quando um approval_id começa com "selfmod_", executar via SelfModExecutor:

```python
# Ao aprovar:
if body.approval_id.startswith("selfmod_"):
    planner = request.app.state.agent_service.self_mod_planner
    executor = request.app.state.agent_service.self_mod_executor
    
    plan = planner.approve_plan(body.approval_id)
    if not plan:
        return {"status": "error", "message": "Plano não encontrado"}
    
    # Executar em background
    result = await executor.execute(plan)
    
    if result["success"]:
        planner.complete_plan(plan.id, result["output"][:2000])
        return {
            "status": "completed",
            "message": f"✅ Auto-modificação concluída. Commit: {result['commit_hash']}",
            "result": {
                "validation": result["validation"],
                "commit_hash": result["commit_hash"],
                "execution_time": f"{result['execution_time_seconds']:.1f}s",
            }
        }
    else:
        planner.fail_plan(plan.id, result["error"])
        return {
            "status": "failed",
            "message": f"❌ Auto-modificação falhou. Mudanças revertidas.\nErro: {result['error']}",
            "result": result,
        }
```

### Registrar no main.py:

Garantir que o agent_service tem acesso ao planner e executor (já instanciados dentro do AgentService).

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 5 — FRONTEND: SELF-MOD APPROVAL CARD
# ═══════════════════════════════════════════════════════════

### Crie: `frontend/components/chat/SelfModCard.tsx`

Card especial que aparece no chat quando auto-modificação é detectada:

```
┌─────────────────────────────────────────────┐
│ ✦ AUTO-MODIFICAÇÃO DETECTADA          🟡    │
│                                             │
│ 📋 "adiciona tool de email na Aura"         │
│                                             │
│ Arquivos afetados:                          │
│   • backend/app/tools/email_tool.py (criar) │
│   • backend/app/tools/__init__.py           │
│   • backend/app/api/v1/router.py            │
│                                             │
│ Passos:                                     │
│   1. Criar arquivo da tool                  │
│   2. Registrar no registry                  │
│   3. Testar importação                      │
│   4. Validar que nada quebrou               │
│                                             │
│ Risco: 🟢 Baixo                             │
│ Requer restart: Sim                         │
│                                             │
│              [Rejeitar]  [✦ Executar]        │
└─────────────────────────────────────────────┘
```

Especificações visuais:
- Background: rgba(0,212,170,0.05) (verde sutil da Aura)
- Border: 1px solid rgba(0,212,170,0.15)
- Border-left: 3px solid var(--aura-green)
- Border-radius: 12px
- Padding: 16px
- Header com ✦ e título bold
- Badge de risco colorido (🟢 baixo, 🟡 médio, 🔴 alto)
- Lista de arquivos em font-mono, 12px
- Lista de passos numerados
- Botão "Executar" em var(--aura-green), text dark
- Botão "Rejeitar" em transparent, border white/20
- Enquanto executando: botão vira progress indicator com texto "Executando... (pode levar até 10min)"
- Quando completo: card muda pra verde com ✅ e mostra commit hash
- Quando falha: card muda pra vermelho com ❌ e mostra erro

### Integrar no MessageBubble:

Quando a resposta do agent tem `mode: "self_modification"`:
```tsx
{message.selfModPlan && (
    <SelfModCard
        plan={message.selfModPlan}
        approvals={message.needs_approval}
        onApprove={handleApproval}
        onReject={handleReject}
    />
)}
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 6 — TESTES
# ═══════════════════════════════════════════════════════════

### Teste 1 — Detector:
```bash
cd ~/Projetos/aura_v1/aura/backend
python3 -c "
from app.services.self_mod_detector import detect_self_modification

# Deve detectar auto-mod
r1 = detect_self_modification('adiciona uma tool de email na aura')
print(f'Tool email: self_mod={r1.is_self_modification}, conf={r1.confidence:.2f}, areas={r1.affected_areas}')
assert r1.is_self_modification, 'FAIL: deveria detectar auto-mod'

# Deve detectar auto-mod
r2 = detect_self_modification('muda o timeout do ollama pra 5 minutos')
print(f'Timeout: self_mod={r2.is_self_modification}, conf={r2.confidence:.2f}')
assert r2.is_self_modification, 'FAIL: deveria detectar auto-mod'

# NÃO deve detectar auto-mod (é operação de leitura)
r3 = detect_self_modification('mostra o git status do projeto')
print(f'Git status: self_mod={r3.is_self_modification}')
assert not r3.is_self_modification, 'FAIL: não deveria detectar auto-mod'

# NÃO deve detectar auto-mod (é projeto diferente)
r4 = detect_self_modification('oi, tudo bem?')
print(f'Saudação: self_mod={r4.is_self_modification}')
assert not r4.is_self_modification, 'FAIL: não deveria detectar auto-mod'

print('✅ Todos os testes passaram')
"
```

### Teste 2 — Planner:
```bash
python3 -c "
import asyncio
from app.services.self_mod_detector import detect_self_modification
from app.services.self_mod_planner import SelfModPlanner

async def test():
    planner = SelfModPlanner()
    analysis = detect_self_modification('cria uma tool de busca web na aura')
    plan = await planner.create_plan('cria uma tool de busca web na aura', analysis)
    print(f'Plan ID: {plan.id}')
    print(f'Status: {plan.status}')
    print(f'Risk: {plan.risk_level}')
    print(f'Files: {plan.files_affected}')
    print(f'Prompt preview: {plan.claude_code_prompt[:200]}...')
    print()
    print(plan.plan_description)
    print()
    print('✅ Planner funciona')

asyncio.run(test())
"
```

### Teste 3 — Frontend build:
```bash
cd ~/Projetos/aura_v1/aura/frontend
pnpm tsc --noEmit && echo "✅ TypeScript OK" || echo "❌ TypeScript FAIL"
pnpm build && echo "✅ Build OK" || echo "❌ Build FAIL"
```

### Teste 4 — Backend importação:
```bash
cd ~/Projetos/aura_v1/aura/backend
python3 -c "
from app.services.self_mod_detector import detect_self_modification
from app.services.self_mod_planner import SelfModPlanner
from app.services.self_mod_executor import SelfModExecutor
print('✅ Todos os módulos importam corretamente')
"
```

---

# ═══════════════════════════════════════════════════════════
# COMMIT E PUSH
# ═══════════════════════════════════════════════════════════

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "✦ feat: self-modification protocol — detector, planner, executor, approval UI"
git push
```

---

# REGRAS FINAIS

1. Auto-modificação é SEMPRE L2 — nunca L1, nunca promovível
2. NADA é executado sem aprovação explícita do Gregory
3. Se a validação falhar (backend não importa, frontend não builda) → REVERTE tudo
4. Todo plano é logado no audit trail
5. O Gregory sempre vê: o que vai mudar, quais arquivos, qual risco, se precisa restart
6. Claude Code roda com --dangerously-skip-permissions pra executar rápido
7. Commit automático após sucesso com prefixo "✦ self-mod:"
8. Se o detector tiver dúvida (confidence < 0.6), NÃO trata como auto-mod — trata normal
9. NÃO quebre o que já funciona
10. Rode todos os testes no final
