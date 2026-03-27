# AURA — MEGA PROMPT: AUTOMAÇÃO TOTAL DO MAC

**Autor:** Claude (para Gregory)
**Data:** 2026-03-26
**Objetivo:** Transformar a Aura de chatbot em agente autônomo que controla o Mac inteiro por comando de voz.
**Resultado final:** Gregory manda áudio → Aura entende → executa (código, terminal, git, deploy, browser) → entrega pronto.

---

## ANTES DE TUDO

Leia TODOS estes arquivos antes de tocar em qualquer código:

```
~/Projetos/aura_v1/CLAUDE.md
~/Projetos/aura_v1/AUDIT.md
~/Projetos/aura_v1/EXPERIMENT-qwen-agent.md
~/Projetos/aura_v1/aura/backend/app/main.py
~/Projetos/aura_v1/aura/backend/app/api/ (todos os endpoints)
~/Projetos/aura_v1/aura/backend/app/services/ (todos os serviços)
~/Projetos/aura_v1/aura/backend/app/tools/ (todas as tools existentes)
~/Projetos/aura_v1/aura/backend/app/aura_os/ (toda a estrutura)
~/Projetos/aura_v1/aura/frontend/components/ (todos os componentes)
~/Projetos/aura_v1/aura/frontend/lib/ (stores, api, utils)
~/Projetos/aura_v1/aura/frontend/app/ (todas as pages)
~/Projetos/aura_v1/aura/backend/.env
```

O experimento Qwen provou que ele consegue fazer tool calling (5/5 correto, mas latência de ~208s). A arquitetura agora é:
- **Qwen local** = worker assíncrono (tarefas em background, grátis)
- **Claude API** = cérebro interativo (respostas rápidas, raciocínio, orquestração)
- **Ambos** usam a MESMA tool layer

**REGRA ABSOLUTA:** NÃO quebre nada que já funciona. Leia o código existente. Integre com ele. Se algo já implementado faz o que é pedido aqui, reutilize — não duplique.

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 1 — TOOL LAYER (as mãos da Aura)
# ═══════════════════════════════════════════════════════════

A Aura precisa de mãos. Hoje ela pensa mas não age. Este módulo dá a ela a capacidade de interagir com o Mac inteiro.

## 1.1 — Tool Registry (o framework)

### Crie: `backend/app/tools/tool_registry.py`

```python
"""
Tool Registry — Framework central de ferramentas da Aura.

Toda tool registrada aqui pode ser chamada por qualquer brain (Qwen ou Claude API).
O registry mantém:
- Catálogo de tools disponíveis
- Schema de cada tool (nome, descrição, parâmetros, autonomia)
- Execução com audit logging
- Classificação L1/L2/L3 automática

Para criar uma nova tool:
1. Crie a classe herdando de BaseTool
2. Defina name, description, parameters (JSON schema), autonomy_level
3. Implemente async def execute(self, params: dict) -> ToolResult
4. Registre no registry
"""

import asyncio
import time
import logging
import json
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime

logger = logging.getLogger("aura")


class AutonomyLevel(Enum):
    L1_AUTONOMOUS = 1      # Executa sem perguntar
    L2_APPROVAL = 2        # Pede aprovação do Gregory
    L3_BLOCKED = 3         # NUNCA executa


@dataclass
class ToolResult:
    success: bool
    output: Any
    error: Optional[str] = None
    execution_time_ms: float = 0
    tool_name: str = ""
    autonomy_level: int = 1
    needs_approval: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)

    def to_context_string(self) -> str:
        """Formato que o LLM entende como resultado de tool."""
        if self.success:
            return f"[TOOL_RESULT:{self.tool_name}] SUCCESS\n{self.output}"
        return f"[TOOL_RESULT:{self.tool_name}] ERROR: {self.error}"


class BaseTool(ABC):
    """Classe base para todas as tools da Aura."""

    name: str = ""
    description: str = ""
    parameters: dict = {}  # JSON Schema
    autonomy_level: AutonomyLevel = AutonomyLevel.L1_AUTONOMOUS
    category: str = "general"

    def get_schema(self) -> dict:
        """Retorna schema no formato que LLMs entendem."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "autonomy_level": self.autonomy_level.value,
            "category": self.category,
        }

    @abstractmethod
    async def execute(self, params: dict) -> ToolResult:
        """Executa a tool. Implementar em cada subclasse."""
        pass

    async def validate_params(self, params: dict) -> Optional[str]:
        """Valida parâmetros antes de executar. Retorna erro ou None."""
        required = self.parameters.get("required", [])
        properties = self.parameters.get("properties", {})
        for req in required:
            if req not in params:
                return f"Parâmetro obrigatório ausente: {req}"
        return None


class ToolRegistry:
    """Registro central de todas as tools da Aura."""

    def __init__(self, audit_log_path: str = "data/logs/tool_audit.jsonl"):
        self.tools: Dict[str, BaseTool] = {}
        self.audit_log_path = audit_log_path
        self.pending_approvals: Dict[str, dict] = {}
        os.makedirs(os.path.dirname(audit_log_path), exist_ok=True)

    def register(self, tool: BaseTool):
        """Registra uma tool no catálogo."""
        if not tool.name:
            raise ValueError("Tool precisa de um nome")
        self.tools[tool.name] = tool
        logger.info(f"Tool registrada: {tool.name} (L{tool.autonomy_level.value})")

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self.tools.get(name)

    def list_tools(self) -> List[dict]:
        """Lista todas as tools com seus schemas."""
        return [tool.get_schema() for tool in self.tools.values()]

    def get_tools_prompt(self) -> str:
        """Gera o bloco de prompt que descreve as tools para o LLM."""
        tools_desc = []
        for tool in self.tools.values():
            params_desc = ""
            props = tool.parameters.get("properties", {})
            required = tool.parameters.get("required", [])
            for param_name, param_info in props.items():
                req_mark = " (obrigatório)" if param_name in required else " (opcional)"
                params_desc += f"    - {param_name}: {param_info.get('description', param_info.get('type', 'string'))}{req_mark}\n"

            tools_desc.append(
                f"  - {tool.name}: {tool.description}\n"
                f"    Autonomia: L{tool.autonomy_level.value}\n"
                f"    Parâmetros:\n{params_desc}"
            )
        return "FERRAMENTAS DISPONÍVEIS:\n\n" + "\n".join(tools_desc)

    async def execute(self, tool_name: str, params: dict, bypass_approval: bool = False) -> ToolResult:
        """
        Executa uma tool com todos os checks.

        Fluxo:
        1. Encontra a tool
        2. Valida parâmetros
        3. Checa autonomia (L1=executa, L2=pede aprovação, L3=bloqueia)
        4. Executa
        5. Loga no audit trail
        """
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                output=None,
                error=f"Tool não encontrada: {tool_name}",
                tool_name=tool_name,
            )

        # Validar parâmetros
        validation_error = await tool.validate_params(params)
        if validation_error:
            return ToolResult(
                success=False,
                output=None,
                error=validation_error,
                tool_name=tool_name,
            )

        # Checar autonomia
        if tool.autonomy_level == AutonomyLevel.L3_BLOCKED:
            result = ToolResult(
                success=False,
                output=None,
                error="BLOQUEADO: Ação L3 não pode ser executada pela Aura. Requer ação direta do Gregory.",
                tool_name=tool_name,
                autonomy_level=3,
            )
            await self._audit_log(tool_name, params, result, "BLOCKED_L3")
            return result

        if tool.autonomy_level == AutonomyLevel.L2_APPROVAL and not bypass_approval:
            # Enfileira para aprovação
            approval_id = f"approval_{int(time.time())}_{tool_name}"
            self.pending_approvals[approval_id] = {
                "tool_name": tool_name,
                "params": params,
                "requested_at": datetime.now().isoformat(),
                "description": f"{tool.description} — {json.dumps(params, ensure_ascii=False)[:200]}",
            }
            result = ToolResult(
                success=True,
                output={"approval_id": approval_id, "message": "Ação requer aprovação do Gregory."},
                tool_name=tool_name,
                autonomy_level=2,
                needs_approval=True,
            )
            await self._audit_log(tool_name, params, result, "PENDING_APPROVAL")
            return result

        # Executar (L1 ou L2 aprovado)
        start = time.time()
        try:
            result = await asyncio.wait_for(tool.execute(params), timeout=300)
            result.tool_name = tool_name
            result.autonomy_level = tool.autonomy_level.value
            result.execution_time_ms = (time.time() - start) * 1000
        except asyncio.TimeoutError:
            result = ToolResult(
                success=False,
                output=None,
                error="Timeout: execução excedeu 5 minutos",
                tool_name=tool_name,
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            result = ToolResult(
                success=False,
                output=None,
                error=str(e),
                tool_name=tool_name,
                execution_time_ms=(time.time() - start) * 1000,
            )

        await self._audit_log(tool_name, params, result, "EXECUTED")
        return result

    async def approve(self, approval_id: str) -> Optional[ToolResult]:
        """Gregory aprova uma ação L2 pendente."""
        pending = self.pending_approvals.pop(approval_id, None)
        if not pending:
            return None
        return await self.execute(
            pending["tool_name"], pending["params"], bypass_approval=True
        )

    async def reject(self, approval_id: str) -> bool:
        """Gregory rejeita uma ação L2 pendente."""
        return self.pending_approvals.pop(approval_id, None) is not None

    def get_pending_approvals(self) -> List[dict]:
        """Lista ações L2 esperando aprovação."""
        return [
            {"id": k, **v} for k, v in self.pending_approvals.items()
        ]

    async def _audit_log(self, tool_name: str, params: dict, result: ToolResult, event: str):
        """Log de auditoria — TODA execução é registrada."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event": event,
            "tool": tool_name,
            "params": params,
            "success": result.success,
            "execution_time_ms": result.execution_time_ms,
            "autonomy_level": result.autonomy_level,
            "error": result.error,
        }
        try:
            with open(self.audit_log_path, "a") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Falha ao escrever audit log: {e}")
```

---

## 1.2 — Shell Tool (terminal)

### Crie: `backend/app/tools/shell_tool.py`

```python
"""
Shell Tool — Executa comandos no terminal do Mac.

Segurança:
- Comandos destrutivos (rm -rf, mkfs, dd) → L3 BLOQUEADO
- Comandos que modificam sistema (sudo, chmod 777) → L2
- Comandos de leitura (ls, cat, grep, find, wc) → L1
- Timeout de 120 segundos por comando
- Working directory sempre validado
"""

import asyncio
import os
import re
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


# Patterns de comandos perigosos — NUNCA executar
L3_BLOCKED_PATTERNS = [
    r'\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?/',  # rm -rf /
    r'\brm\s+-rf\s+~',          # rm -rf ~
    r'\bmkfs\b',                 # formatar disco
    r'\bdd\s+if=',               # dd
    r'>\s*/dev/',                 # redirecionar para device
    r'\bsudo\s+rm\b',            # sudo rm
    r'\bsudo\s+mkfs\b',          # sudo mkfs
    r':(){ :|:& };:',           # fork bomb
    r'\bshutdown\b',             # desligar
    r'\breboot\b',               # reiniciar
    r'\bsudo\s+passwd\b',        # trocar senha
    r'\bcurl\b.*\|\s*sudo\s+bash', # curl | sudo bash
]

# Patterns que precisam de aprovação
L2_APPROVAL_PATTERNS = [
    r'\bsudo\b',                 # qualquer sudo
    r'\brm\s',                   # rm (sem ser rm -rf /)
    r'\bchmod\b',                # mudar permissões
    r'\bchown\b',                # mudar dono
    r'\bkill\b',                 # matar processo
    r'\bkillall\b',              # matar processos
    r'\bgit\s+push\b',           # git push
    r'\bgit\s+push\s+.*--force', # git push --force
    r'\bnpm\s+publish\b',        # publicar pacote
    r'\bvercel\s+deploy\b',      # deploy
    r'\bpip\s+install\b',        # instalar pacote
    r'\bnpm\s+install\b',        # instalar pacote
    r'\bbrew\s+install\b',       # instalar pacote
]

# Patterns seguros — sempre L1
L1_SAFE_PATTERNS = [
    r'^\s*(ls|cat|head|tail|grep|find|wc|echo|pwd|whoami|date|uptime|df|du|file|which|type|man)',
    r'^\s*(git\s+(status|log|diff|branch|remote|show))',
    r'^\s*(python3?\s+-c)',
    r'^\s*(node\s+-e)',
    r'^\s*(curl\s+-s)',          # curl read-only
    r'^\s*(tree|bat|less|more)',
]


class ShellTool(BaseTool):
    name = "shell"
    description = "Executa comandos no terminal do Mac. Use para qualquer operação: listar arquivos, rodar scripts, git, compilar, testar, etc."
    category = "system"
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "Comando bash a executar"
            },
            "working_dir": {
                "type": "string",
                "description": "Diretório de trabalho (padrão: ~/Projetos/aura_v1/aura)"
            },
            "timeout": {
                "type": "integer",
                "description": "Timeout em segundos (padrão: 120, máximo: 600)"
            }
        },
        "required": ["command"]
    }

    def _classify_command(self, command: str) -> AutonomyLevel:
        """Classifica o nível de autonomia de um comando."""
        # L3: NUNCA executar
        for pattern in L3_BLOCKED_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L3_BLOCKED

        # L1: Seguro
        for pattern in L1_SAFE_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L1_AUTONOMOUS

        # L2: Precisa aprovação
        for pattern in L2_APPROVAL_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return AutonomyLevel.L2_APPROVAL

        # Default: L2 (na dúvida, pede aprovação)
        return AutonomyLevel.L2_APPROVAL

    async def execute(self, params: dict) -> ToolResult:
        command = params["command"]
        working_dir = os.path.expanduser(params.get("working_dir", "~/Projetos/aura_v1/aura"))
        timeout = min(params.get("timeout", 120), 600)

        # Reclassifica autonomia baseado no comando específico
        self.autonomy_level = self._classify_command(command)

        if self.autonomy_level == AutonomyLevel.L3_BLOCKED:
            return ToolResult(
                success=False,
                output=None,
                error=f"BLOQUEADO: Comando perigoso detectado: {command}"
            )

        if not os.path.isdir(working_dir):
            return ToolResult(
                success=False,
                output=None,
                error=f"Diretório não existe: {working_dir}"
            )

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )

            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(
                    success=True,
                    output=output if output else "(sem saída)",
                )
            else:
                return ToolResult(
                    success=False,
                    output=output,
                    error=f"Exit code {proc.returncode}: {errors}",
                )
        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                output=None,
                error=f"Timeout: comando excedeu {timeout}s"
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output=None,
                error=str(e)
            )
```

---

## 1.3 — File Tool (sistema de arquivos)

### Crie: `backend/app/tools/file_tool.py`

```python
"""
File Tool — Lê, escreve, cria, busca arquivos no Mac.

Segurança:
- Leitura de qualquer arquivo texto → L1
- Escrita/criação de arquivos → L2
- Deleção → L3 BLOQUEADO (usa shell rm via aprovação L2 se necessário)
- Path traversal protegido (não sai do home do usuário)
- Arquivos binários: retorna info, não conteúdo
- .env e secrets: NUNCA expostos ao LLM
"""

import os
import glob
from pathlib import Path
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


SENSITIVE_FILES = {".env", ".env.local", ".env.production", ".env.development"}
BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
                     ".tar", ".gz", ".mp3", ".mp4", ".mov", ".avi", ".exe", ".dmg",
                     ".sqlite", ".db", ".woff", ".woff2", ".ttf", ".eot"}
HOME = os.path.expanduser("~")


class FileReadTool(BaseTool):
    name = "file_read"
    description = "Lê o conteúdo de um arquivo texto. Suporta visualização parcial com line range."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Caminho do arquivo (absoluto ou relativo ao home)"},
            "start_line": {"type": "integer", "description": "Linha inicial (opcional, começa em 1)"},
            "end_line": {"type": "integer", "description": "Linha final (opcional)"},
        },
        "required": ["path"]
    }

    async def execute(self, params: dict) -> ToolResult:
        path = os.path.expanduser(params["path"])
        if not path.startswith(HOME):
            path = os.path.join(HOME, path)

        real_path = os.path.realpath(path)
        if not real_path.startswith(HOME):
            return ToolResult(success=False, output=None,
                              error="Path traversal bloqueado: não pode acessar fora do home")

        if os.path.basename(path) in SENSITIVE_FILES:
            return ToolResult(success=False, output=None,
                              error="Arquivo sensível: não pode ler .env")

        if not os.path.exists(real_path):
            return ToolResult(success=False, output=None,
                              error=f"Arquivo não encontrado: {path}")

        ext = os.path.splitext(path)[1].lower()
        if ext in BINARY_EXTENSIONS:
            size = os.path.getsize(real_path)
            return ToolResult(success=True,
                              output=f"Arquivo binário ({ext}), tamanho: {size} bytes")

        try:
            with open(real_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            start = params.get("start_line", 1) - 1
            end = params.get("end_line", len(lines))
            selected = lines[max(0, start):end]

            # Limitar output a 50KB para não estourar contexto
            content = "".join(selected)
            if len(content) > 50000:
                content = content[:50000] + "\n\n[...TRUNCADO — arquivo muito grande]"

            return ToolResult(
                success=True,
                output=f"Arquivo: {path} ({len(lines)} linhas)\n\n{content}"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileWriteTool(BaseTool):
    name = "file_write"
    description = "Cria ou sobrescreve um arquivo com o conteúdo especificado."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L2_APPROVAL
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Caminho do arquivo"},
            "content": {"type": "string", "description": "Conteúdo a escrever"},
            "append": {"type": "boolean", "description": "Se true, adiciona ao final em vez de sobrescrever"},
        },
        "required": ["path", "content"]
    }

    async def execute(self, params: dict) -> ToolResult:
        path = os.path.expanduser(params["path"])
        if not path.startswith(HOME):
            path = os.path.join(HOME, path)

        real_path = os.path.realpath(os.path.dirname(path))
        if not real_path.startswith(HOME):
            return ToolResult(success=False, output=None,
                              error="Path traversal bloqueado")

        if os.path.basename(path) in SENSITIVE_FILES:
            return ToolResult(success=False, output=None,
                              error="Não pode sobrescrever arquivo sensível")

        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            mode = "a" if params.get("append", False) else "w"
            with open(path, mode, encoding="utf-8") as f:
                f.write(params["content"])
            return ToolResult(
                success=True,
                output=f"Arquivo salvo: {path} ({len(params['content'])} caracteres)"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileSearchTool(BaseTool):
    name = "file_search"
    description = "Busca arquivos por nome ou padrão glob no Mac."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {"type": "string", "description": "Padrão de busca (glob). Ex: '**/*.py', 'README*'"},
            "directory": {"type": "string", "description": "Diretório raiz da busca (padrão: ~/Projetos)"},
            "max_results": {"type": "integer", "description": "Máximo de resultados (padrão: 50)"},
        },
        "required": ["pattern"]
    }

    async def execute(self, params: dict) -> ToolResult:
        directory = os.path.expanduser(params.get("directory", "~/Projetos"))
        pattern = params["pattern"]
        max_results = params.get("max_results", 50)

        try:
            results = []
            for match in glob.iglob(os.path.join(directory, pattern), recursive=True):
                if any(skip in match for skip in ["node_modules", ".git/", "__pycache__", ".next"]):
                    continue
                results.append(match)
                if len(results) >= max_results:
                    break

            if not results:
                return ToolResult(success=True, output="Nenhum arquivo encontrado")

            return ToolResult(
                success=True,
                output=f"Encontrados {len(results)} arquivos:\n" + "\n".join(results)
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))


class FileListTool(BaseTool):
    name = "file_list"
    description = "Lista arquivos e pastas de um diretório com detalhes (tamanho, tipo)."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "directory": {"type": "string", "description": "Diretório a listar"},
            "depth": {"type": "integer", "description": "Profundidade máxima (padrão: 2)"},
        },
        "required": ["directory"]
    }

    async def execute(self, params: dict) -> ToolResult:
        directory = os.path.expanduser(params["directory"])
        depth = params.get("depth", 2)

        if not os.path.isdir(directory):
            return ToolResult(success=False, output=None,
                              error=f"Diretório não encontrado: {directory}")

        excluded = {"node_modules", ".git", "__pycache__", ".next", ".vercel", "dist", "build", ".venv"}
        lines = []

        def walk(path, level=0):
            if level > depth:
                return
            try:
                entries = sorted(os.listdir(path))
            except PermissionError:
                return
            for entry in entries:
                if entry in excluded or entry.startswith("."):
                    continue
                full = os.path.join(path, entry)
                prefix = "  " * level
                if os.path.isdir(full):
                    lines.append(f"{prefix}📁 {entry}/")
                    walk(full, level + 1)
                else:
                    size = os.path.getsize(full)
                    size_str = f"{size}B" if size < 1024 else f"{size//1024}KB"
                    lines.append(f"{prefix}📄 {entry} ({size_str})")

        walk(directory)
        return ToolResult(
            success=True,
            output=f"Diretório: {directory}\n\n" + "\n".join(lines[:500])
        )
```

---

## 1.4 — Git Tool

### Crie: `backend/app/tools/git_tool.py`

```python
"""
Git Tool — Operações git completas.

- Status, log, diff, branch → L1 (leitura)
- Add, commit → L2 (modifica repositório local)
- Push, force push → L2 (modifica remoto)
- Delete branch, force push → L3 no main/master
"""

import asyncio
import os
import json
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class GitTool(BaseTool):
    name = "git"
    description = "Operações git: status, diff, log, add, commit, push, pull, branch, checkout."
    category = "version_control"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["status", "diff", "log", "branch", "add", "commit", "push", "pull",
                         "checkout", "stash", "stash_pop", "remote"],
                "description": "Operação git a executar"
            },
            "args": {
                "type": "string",
                "description": "Argumentos adicionais (ex: mensagem de commit, nome de branch, arquivo para diff)"
            },
            "repo_path": {
                "type": "string",
                "description": "Caminho do repositório (padrão: ~/Projetos/aura_v1)"
            }
        },
        "required": ["operation"]
    }

    READONLY_OPS = {"status", "diff", "log", "branch", "remote"}
    WRITE_OPS = {"add", "commit", "push", "pull", "checkout", "stash", "stash_pop"}

    async def execute(self, params: dict) -> ToolResult:
        operation = params["operation"]
        args = params.get("args", "")
        repo = os.path.expanduser(params.get("repo_path", "~/Projetos/aura_v1"))

        # Classificar autonomia
        if operation in self.READONLY_OPS:
            self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
        elif operation == "push" and "--force" in args:
            self.autonomy_level = AutonomyLevel.L3_BLOCKED
            return ToolResult(success=False, output=None,
                              error="BLOQUEADO: git push --force não é permitido pela Aura")
        else:
            self.autonomy_level = AutonomyLevel.L2_APPROVAL

        # Montar comando
        cmd_map = {
            "status": "git status --porcelain",
            "diff": f"git diff {args}".strip(),
            "log": f"git log --oneline -20 {args}".strip(),
            "branch": "git branch -a",
            "add": f"git add {args if args else '-A'}",
            "commit": f'git commit -m "{args}"' if args else 'git commit',
            "push": f"git push {args}".strip(),
            "pull": f"git pull {args}".strip(),
            "checkout": f"git checkout {args}",
            "stash": "git stash",
            "stash_pop": "git stash pop",
            "remote": "git remote -v",
        }

        cmd = cmd_map.get(operation)
        if not cmd:
            return ToolResult(success=False, output=None, error=f"Operação desconhecida: {operation}")

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=repo,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(success=True, output=output or "(sem alterações)")
            else:
                return ToolResult(success=False, output=output, error=errors)
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

---

## 1.5 — Claude Code Tool (enviar código pro terminal)

### Crie: `backend/app/tools/claude_code_tool.py`

```python
"""
Claude Code Tool — Envia prompts pro Claude Code CLI.

ESSE É O DIFERENCIAL: a Aura pode mandar tarefas pro Claude Code
que executa no terminal com acesso total ao filesystem.

Equivale a Gregory sentado no terminal digitando `claude -p "..."`.

- L2: sempre pede aprovação (Claude Code pode modificar QUALQUER coisa)
- Timeout: 10 minutos (tarefas complexas levam tempo)
- Output: captura stdout/stderr completo
"""

import asyncio
import os
import shutil
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class ClaudeCodeTool(BaseTool):
    name = "claude_code"
    description = (
        "Envia um prompt para o Claude Code CLI que executa no terminal com acesso total "
        "ao computador. Use para: implementar features, corrigir bugs, refatorar código, "
        "criar arquivos complexos, rodar análises, qualquer tarefa de engenharia."
    )
    category = "development"
    autonomy_level = AutonomyLevel.L2_APPROVAL
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Prompt detalhado para o Claude Code executar"
            },
            "working_dir": {
                "type": "string",
                "description": "Diretório de trabalho (padrão: ~/Projetos/aura_v1/aura)"
            },
            "dangerously_skip_permissions": {
                "type": "boolean",
                "description": "Se true, pula confirmações do Claude Code (padrão: false)"
            }
        },
        "required": ["prompt"]
    }

    async def execute(self, params: dict) -> ToolResult:
        # Verificar se claude está instalado
        claude_path = shutil.which("claude")
        if not claude_path:
            return ToolResult(
                success=False,
                output=None,
                error="Claude Code CLI não encontrado no PATH. Instale com: npm install -g @anthropic-ai/claude-code"
            )

        prompt = params["prompt"]
        working_dir = os.path.expanduser(
            params.get("working_dir", "~/Projetos/aura_v1/aura")
        )
        skip_perms = params.get("dangerously_skip_permissions", False)

        cmd = f'claude -p "{prompt}" --no-input'
        if skip_perms:
            cmd = f'claude --dangerously-skip-permissions -p "{prompt}" --no-input'

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env={**os.environ, "TERM": "dumb", "NO_COLOR": "1"},
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=600  # 10 minutos
            )

            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(
                    success=True,
                    output=output[:100000]  # Limitar a 100KB
                )
            else:
                return ToolResult(
                    success=False,
                    output=output[:50000],
                    error=f"Claude Code retornou erro: {errors[:5000]}"
                )
        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                output=None,
                error="Timeout: Claude Code excedeu 10 minutos"
            )
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

---

## 1.6 — Browser Tool (automação web)

### Crie: `backend/app/tools/browser_tool.py`

```python
"""
Browser Tool — Automação de navegador via AppleScript + Playwright.

Duas camadas:
1. AppleScript (leve): abre URLs, lê página ativa, clica, preenche — funciona
   com o Chrome/Safari que já está aberto, sem instalar nada.
2. Playwright (pesado, opcional): screenshot, scraping complexo, formulários.

Casos de uso reais do Gregory:
- Abrir Vercel dashboard e verificar status de deploy
- Abrir Supabase e criar tabela
- Abrir GitHub e criar PR
- Navegar documentação e extrair info
- Preencher formulários web

Segurança:
- Abrir URL → L1
- Ler conteúdo de página → L1
- Clicar/preencher → L2
- Login/credenciais → L3 BLOQUEADO
"""

import asyncio
import os
import subprocess
from typing import Optional

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class BrowserTool(BaseTool):
    name = "browser"
    description = (
        "Controla o navegador do Mac. Pode abrir URLs, ler conteúdo de páginas, "
        "clicar em elementos, preencher formulários. Usa AppleScript para Chrome/Safari."
    )
    category = "browser"
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_url", "get_page_content", "get_page_title",
                         "get_current_url", "click_element", "fill_input",
                         "screenshot", "run_javascript", "list_tabs"],
                "description": "Ação a executar no navegador"
            },
            "url": {"type": "string", "description": "URL a abrir (para open_url)"},
            "selector": {"type": "string", "description": "Seletor CSS do elemento (para click/fill)"},
            "value": {"type": "string", "description": "Valor a preencher (para fill_input)"},
            "javascript": {"type": "string", "description": "Código JS a executar na página (para run_javascript)"},
            "browser": {"type": "string", "enum": ["chrome", "safari"], "description": "Navegador (padrão: chrome)"},
        },
        "required": ["action"]
    }

    READONLY_ACTIONS = {"get_page_content", "get_page_title", "get_current_url", "list_tabs"}
    WRITE_ACTIONS = {"click_element", "fill_input", "run_javascript"}
    L3_PATTERNS = ["password", "login", "signin", "credential", "token", "api_key", "secret"]

    def _classify_action(self, action: str, params: dict) -> AutonomyLevel:
        # Verificar se envolve credenciais
        all_text = " ".join(str(v) for v in params.values()).lower()
        if any(p in all_text for p in self.L3_PATTERNS):
            return AutonomyLevel.L3_BLOCKED

        if action == "open_url":
            return AutonomyLevel.L1_AUTONOMOUS
        if action == "screenshot":
            return AutonomyLevel.L1_AUTONOMOUS
        if action in self.READONLY_ACTIONS:
            return AutonomyLevel.L1_AUTONOMOUS
        if action in self.WRITE_ACTIONS:
            return AutonomyLevel.L2_APPROVAL
        return AutonomyLevel.L2_APPROVAL

    async def _run_applescript(self, script: str) -> str:
        """Executa AppleScript e retorna resultado."""
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode().strip())
        return stdout.decode().strip()

    async def execute(self, params: dict) -> ToolResult:
        action = params["action"]
        browser = params.get("browser", "chrome")
        app_name = "Google Chrome" if browser == "chrome" else "Safari"

        self.autonomy_level = self._classify_action(action, params)
        if self.autonomy_level == AutonomyLevel.L3_BLOCKED:
            return ToolResult(success=False, output=None,
                              error="BLOQUEADO: Ação envolve credenciais/login — requer ação direta do Gregory")

        try:
            if action == "open_url":
                url = params.get("url", "")
                if not url:
                    return ToolResult(success=False, output=None, error="URL obrigatória")
                await self._run_applescript(
                    f'tell application "{app_name}" to open location "{url}"'
                )
                await self._run_applescript(f'tell application "{app_name}" to activate')
                return ToolResult(success=True, output=f"Aberto: {url} no {app_name}")

            elif action == "get_page_title":
                if browser == "chrome":
                    title = await self._run_applescript(
                        f'tell application "{app_name}" to get title of active tab of front window'
                    )
                else:
                    title = await self._run_applescript(
                        f'tell application "{app_name}" to get name of front document'
                    )
                return ToolResult(success=True, output=f"Título: {title}")

            elif action == "get_current_url":
                if browser == "chrome":
                    url = await self._run_applescript(
                        f'tell application "{app_name}" to get URL of active tab of front window'
                    )
                else:
                    url = await self._run_applescript(
                        f'tell application "{app_name}" to get URL of front document'
                    )
                return ToolResult(success=True, output=url)

            elif action == "get_page_content":
                if browser == "chrome":
                    # Extrai texto visível da página via JavaScript
                    content = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "document.body.innerText.substring(0, 50000)"'
                    )
                else:
                    content = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript '
                        f'"document.body.innerText.substring(0, 50000)" in front document'
                    )
                return ToolResult(success=True, output=content[:50000])

            elif action == "run_javascript":
                js = params.get("javascript", "")
                if not js:
                    return ToolResult(success=False, output=None, error="JavaScript obrigatório")
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=result)

            elif action == "list_tabs":
                if browser == "chrome":
                    tabs = await self._run_applescript(
                        f'tell application "{app_name}" to get {{title, URL}} of every tab of front window'
                    )
                else:
                    tabs = await self._run_applescript(
                        f'tell application "{app_name}" to get {{name, URL}} of every document'
                    )
                return ToolResult(success=True, output=tabs)

            elif action == "click_element":
                selector = params.get("selector", "")
                js = f"document.querySelector('{selector}')?.click(); 'clicked'"
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=f"Clicado: {selector}")

            elif action == "fill_input":
                selector = params.get("selector", "")
                value = params.get("value", "")
                js = (f"var el = document.querySelector('{selector}'); "
                      f"if(el){{el.value='{value}'; el.dispatchEvent(new Event('input', {{bubbles:true}})); 'filled'}} "
                      f"else {{'not found'}}")
                if browser == "chrome":
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to execute active tab of front window '
                        f'javascript "{js}"'
                    )
                else:
                    result = await self._run_applescript(
                        f'tell application "{app_name}" to do JavaScript "{js}" in front document'
                    )
                return ToolResult(success=True, output=f"Preenchido: {selector} = {value}")

            elif action == "screenshot":
                screenshot_path = os.path.expanduser("~/aura-screenshot.png")
                await asyncio.create_subprocess_shell(
                    f"screencapture -x {screenshot_path}",
                )
                return ToolResult(success=True, output=f"Screenshot salvo: {screenshot_path}")

            else:
                return ToolResult(success=False, output=None, error=f"Ação desconhecida: {action}")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

---

## 1.7 — Vercel Tool

### Crie: `backend/app/tools/vercel_tool.py`

```python
"""
Vercel Tool — Deploy e gerenciamento de projetos na Vercel.

Usa a Vercel CLI (`vercel` instalado globalmente).
- Status/list → L1
- Deploy → L2
- Delete → L3 BLOQUEADO
"""

import asyncio
import os
from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class VercelTool(BaseTool):
    name = "vercel"
    description = "Deploy e gerenciamento de projetos Vercel. Pode deployar, listar projetos, verificar status de deploy."
    category = "deployment"
    parameters = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["deploy", "deploy_prod", "list", "status", "logs", "env_list"],
                "description": "Operação Vercel"
            },
            "project_path": {
                "type": "string",
                "description": "Caminho do projeto (padrão: ~/Projetos/aura_v1)"
            },
            "args": {
                "type": "string",
                "description": "Argumentos adicionais"
            }
        },
        "required": ["operation"]
    }

    async def execute(self, params: dict) -> ToolResult:
        operation = params["operation"]
        project_path = os.path.expanduser(params.get("project_path", "~/Projetos/aura_v1"))
        args = params.get("args", "")

        # Classificar
        if operation in ("list", "status", "logs", "env_list"):
            self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
        elif operation in ("deploy", "deploy_prod"):
            self.autonomy_level = AutonomyLevel.L2_APPROVAL
        else:
            self.autonomy_level = AutonomyLevel.L2_APPROVAL

        cmd_map = {
            "deploy": f"vercel --yes {args}".strip(),
            "deploy_prod": f"vercel --prod --yes --force {args}".strip(),
            "list": "vercel ls",
            "status": "vercel inspect --yes 2>/dev/null || vercel ls --limit 1",
            "logs": f"vercel logs {args}".strip(),
            "env_list": "vercel env ls",
        }

        cmd = cmd_map.get(operation)
        if not cmd:
            return ToolResult(success=False, output=None, error=f"Operação desconhecida: {operation}")

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=project_path,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
            output = stdout.decode("utf-8", errors="replace").strip()
            errors = stderr.decode("utf-8", errors="replace").strip()

            if proc.returncode == 0:
                return ToolResult(success=True, output=output)
            else:
                return ToolResult(success=False, output=output, error=errors)
        except asyncio.TimeoutError:
            return ToolResult(success=False, output=None, error="Timeout: Vercel excedeu 5 minutos")
        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

---

## 1.8 — macOS Tool (controle do sistema)

### Crie: `backend/app/tools/macos_tool.py`

```python
"""
macOS Tool — Controle do sistema via AppleScript e comandos nativos.

- Abrir apps, controlar volume, notificações → L1/L2
- Controlar Finder, mover arquivos → L2
- Configurações de sistema → L3
"""

import asyncio
import os
from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


class MacOSTool(BaseTool):
    name = "macos"
    description = "Controla o macOS: abrir apps, notificações, volume, clipboard, Finder, processos."
    category = "system"
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_app", "quit_app", "notification", "volume", "clipboard_get",
                         "clipboard_set", "open_finder", "list_processes", "system_info",
                         "say", "open_file"],
                "description": "Ação do sistema"
            },
            "target": {"type": "string", "description": "App/arquivo/texto alvo da ação"},
            "value": {"type": "string", "description": "Valor (volume 0-100, texto do clipboard, etc)"},
        },
        "required": ["action"]
    }

    async def _applescript(self, script: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode().strip())
        return stdout.decode().strip()

    async def execute(self, params: dict) -> ToolResult:
        action = params["action"]
        target = params.get("target", "")
        value = params.get("value", "")

        try:
            if action == "open_app":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                await self._applescript(f'tell application "{target}" to activate')
                return ToolResult(success=True, output=f"App aberto: {target}")

            elif action == "quit_app":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                await self._applescript(f'tell application "{target}" to quit')
                return ToolResult(success=True, output=f"App fechado: {target}")

            elif action == "notification":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                title = target or "Aura"
                msg = value or "Notificação"
                await self._applescript(
                    f'display notification "{msg}" with title "{title}" sound name "Glass"'
                )
                return ToolResult(success=True, output=f"Notificação enviada: {msg}")

            elif action == "volume":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                vol = int(value) if value else 50
                await self._applescript(f'set volume output volume {vol}')
                return ToolResult(success=True, output=f"Volume: {vol}%")

            elif action == "clipboard_get":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                content = await self._applescript('return (the clipboard)')
                return ToolResult(success=True, output=f"Clipboard: {content[:5000]}")

            elif action == "clipboard_set":
                self.autonomy_level = AutonomyLevel.L2_APPROVAL
                await self._applescript(f'set the clipboard to "{value}"')
                return ToolResult(success=True, output="Clipboard atualizado")

            elif action == "open_finder":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                path = os.path.expanduser(target or "~/Projetos")
                await self._applescript(f'tell application "Finder" to open POSIX file "{path}"')
                return ToolResult(success=True, output=f"Finder aberto: {path}")

            elif action == "open_file":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                path = os.path.expanduser(target)
                proc = await asyncio.create_subprocess_exec("open", path)
                await proc.wait()
                return ToolResult(success=True, output=f"Arquivo aberto: {path}")

            elif action == "list_processes":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                proc = await asyncio.create_subprocess_shell(
                    "ps aux --sort=-%mem | head -20",
                    stdout=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                return ToolResult(success=True, output=stdout.decode().strip())

            elif action == "system_info":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                info = []
                for cmd, label in [
                    ("sw_vers", "macOS"), ("uptime", "Uptime"),
                    ("df -h /", "Disco"), ("vm_stat | head -5", "Memória"),
                ]:
                    proc = await asyncio.create_subprocess_shell(
                        cmd, stdout=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    info.append(f"=== {label} ===\n{stdout.decode().strip()}")
                return ToolResult(success=True, output="\n\n".join(info))

            elif action == "say":
                self.autonomy_level = AutonomyLevel.L1_AUTONOMOUS
                text = value or target
                proc = await asyncio.create_subprocess_exec(
                    "say", "-v", "Luciana", text
                )
                await proc.wait()
                return ToolResult(success=True, output=f"Falou: {text}")

            else:
                return ToolResult(success=False, output=None, error=f"Ação desconhecida: {action}")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
```

---

## 1.9 — Registrar todas as tools

### Crie: `backend/app/tools/__init__.py`

```python
"""
Tool Layer — Inicialização e registro de todas as tools.

Importar create_tool_registry() no main.py e passar pro AgentService.
"""

from app.tools.tool_registry import ToolRegistry
from app.tools.shell_tool import ShellTool
from app.tools.file_tool import FileReadTool, FileWriteTool, FileSearchTool, FileListTool
from app.tools.git_tool import GitTool
from app.tools.claude_code_tool import ClaudeCodeTool
from app.tools.browser_tool import BrowserTool
from app.tools.vercel_tool import VercelTool
from app.tools.macos_tool import MacOSTool


def create_tool_registry() -> ToolRegistry:
    """Cria e registra todas as tools da Aura."""
    registry = ToolRegistry()

    # Sistema
    registry.register(ShellTool())
    registry.register(MacOSTool())

    # Filesystem
    registry.register(FileReadTool())
    registry.register(FileWriteTool())
    registry.register(FileSearchTool())
    registry.register(FileListTool())

    # Git
    registry.register(GitTool())

    # Desenvolvimento
    registry.register(ClaudeCodeTool())

    # Deploy
    registry.register(VercelTool())

    # Browser
    registry.register(BrowserTool())

    return registry
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 2 — AGENT SERVICE (o cérebro que usa as mãos)
# ═══════════════════════════════════════════════════════════

O Agent Service é a ponte entre o chat e as tools. Quando Gregory fala algo que requer ação, o Agent Service:
1. Recebe a mensagem
2. Envia pro LLM (Qwen ou Claude API) junto com a lista de tools disponíveis
3. O LLM decide qual tool usar e com quais parâmetros
4. O Agent Service executa a tool via ToolRegistry
5. Retorna o resultado pro LLM para gerar resposta final
6. Envia resposta pro Gregory

### Crie: `backend/app/services/agent_service.py`

```python
"""
Agent Service — Orquestrador de ações.

Integra o BrainRouter (Qwen/Claude) com o ToolRegistry.
Suporta múltiplas tool calls em sequência (agent loop).
Máximo de 10 tool calls por mensagem para evitar loops infinitos.

Dois modos:
1. INTERATIVO (Claude API): resposta rápida, tool calls via API nativa
2. BACKGROUND (Qwen local): tarefa assíncrona, tool calls via prompt engineering

O BrainRouter decide qual usar baseado na complexidade.
"""

import json
import logging
import asyncio
import re
import time
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.tools.tool_registry import ToolRegistry, ToolResult

logger = logging.getLogger("aura")

MAX_TOOL_CALLS = 10
TOOL_CALL_PATTERN = re.compile(
    r'<tool_call>\s*(\{.*?\})\s*</tool_call>',
    re.DOTALL
)


class AgentService:
    def __init__(self, tool_registry: ToolRegistry, brain_router, settings):
        self.tools = tool_registry
        self.brain = brain_router
        self.settings = settings
        self.active_tasks: Dict[str, dict] = {}

    def _build_system_prompt(self, base_prompt: str = "") -> str:
        """Constrói system prompt com tools disponíveis."""
        tools_prompt = self.tools.get_tools_prompt()
        return f"""{base_prompt}

{tools_prompt}

COMO USAR FERRAMENTAS:
Quando precisar usar uma ferramenta, responda EXATAMENTE neste formato:
<tool_call>
{{"tool": "nome_da_ferramenta", "params": {{"param1": "valor1", "param2": "valor2"}}}}
</tool_call>

Regras:
- Pode usar múltiplas ferramentas em sequência
- SEMPRE use <tool_call> tags — não descreva o que faria, FAÇA
- Após receber o resultado, continue sua resposta normalmente
- Se a ferramenta falhar, tente abordagem alternativa
- Se precisar de aprovação (L2), explique ao Gregory o que quer fazer e por quê
- NUNCA tente executar ações L3 (financeiro, legal, delete permanente)
- Para tarefas de código complexas, prefira claude_code em vez de file_write
"""

    def _extract_tool_calls(self, text: str) -> List[dict]:
        """Extrai tool calls do texto do LLM."""
        calls = []
        for match in TOOL_CALL_PATTERN.finditer(text):
            try:
                parsed = json.loads(match.group(1))
                if "tool" in parsed:
                    calls.append(parsed)
            except json.JSONDecodeError:
                logger.warning(f"Tool call com JSON inválido: {match.group(1)[:200]}")
        return calls

    async def process_message(
        self,
        message: str,
        conversation_history: List[dict] = None,
        mode: str = "interactive",
    ) -> dict:
        """
        Processa uma mensagem com capacidade de tool calling.

        Retorna:
        {
            "response": "texto final da resposta",
            "tool_calls": [{"tool": "...", "params": {...}, "result": {...}}],
            "mode": "interactive|background",
            "needs_approval": [{"approval_id": "...", "description": "..."}],
            "execution_time_ms": 1234
        }
        """
        start = time.time()
        system_prompt = self._build_system_prompt()
        tool_calls_log = []
        needs_approval = []
        accumulated_context = ""

        history = conversation_history or []

        for iteration in range(MAX_TOOL_CALLS + 1):
            # Construir mensagem com contexto acumulado
            if accumulated_context:
                current_message = (
                    f"{message}\n\n"
                    f"RESULTADOS DE FERRAMENTAS ANTERIORES:\n{accumulated_context}\n\n"
                    f"Continue sua resposta com base nos resultados acima."
                )
            else:
                current_message = message

            # Chamar o brain (Qwen ou Claude)
            if mode == "interactive":
                brain_response = await self.brain.process_with_claude(
                    message=current_message,
                    system_prompt=system_prompt,
                    conversation_history=history,
                )
            else:
                brain_response = await self.brain.process_with_qwen(
                    message=current_message,
                    system_prompt=system_prompt,
                )

            response_text = brain_response.get("response", "")

            # Extrair tool calls
            tool_calls = self._extract_tool_calls(response_text)

            if not tool_calls:
                # Sem mais tool calls — resposta final
                # Limpar tags residuais
                clean_response = re.sub(r'</?tool_call>', '', response_text).strip()
                return {
                    "response": clean_response,
                    "tool_calls": tool_calls_log,
                    "mode": mode,
                    "needs_approval": needs_approval,
                    "execution_time_ms": (time.time() - start) * 1000,
                    "iterations": iteration,
                }

            # Executar cada tool call
            for call in tool_calls:
                tool_name = call.get("tool", "")
                params = call.get("params", {})

                logger.info(f"Agent executando tool: {tool_name} com params: {params}")

                result = await self.tools.execute(tool_name, params)

                tool_call_entry = {
                    "tool": tool_name,
                    "params": params,
                    "result": result.to_dict(),
                }
                tool_calls_log.append(tool_call_entry)

                if result.needs_approval:
                    needs_approval.append({
                        "approval_id": result.output.get("approval_id"),
                        "description": f"{tool_name}: {json.dumps(params, ensure_ascii=False)[:200]}",
                        "tool": tool_name,
                    })
                    accumulated_context += (
                        f"\n[TOOL:{tool_name}] AGUARDANDO APROVAÇÃO — "
                        f"Ação L2 enfileirada. Gregory precisa aprovar.\n"
                    )
                else:
                    accumulated_context += f"\n{result.to_context_string()}\n"

        # Atingiu limite de iterações
        return {
            "response": "Atingi o limite de 10 ações em sequência. Posso continuar se quiser.",
            "tool_calls": tool_calls_log,
            "mode": mode,
            "needs_approval": needs_approval,
            "execution_time_ms": (time.time() - start) * 1000,
            "iterations": MAX_TOOL_CALLS,
        }

    async def process_background(self, message: str, task_id: str) -> dict:
        """Executa tarefa em background com Qwen (assíncrono)."""
        self.active_tasks[task_id] = {
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "message": message,
        }

        try:
            result = await self.process_message(message, mode="background")
            self.active_tasks[task_id] = {
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "result": result,
            }
            return result
        except Exception as e:
            self.active_tasks[task_id] = {
                "status": "failed",
                "error": str(e),
            }
            raise

    def get_task_status(self, task_id: str) -> Optional[dict]:
        return self.active_tasks.get(task_id)
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 3 — ENDPOINTS (conectar tudo ao frontend)
# ═══════════════════════════════════════════════════════════

### Crie: `backend/app/api/v1/endpoints/agent_api.py`

```python
"""
Agent API — Endpoints para o Agent Service.

Expõe as capacidades do agente para o frontend:
- Chat com tool calling
- Tarefas em background
- Aprovações L2
- Status de tools
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.core.security import require_bearer_token

router = APIRouter(prefix="/agent", dependencies=[Depends(require_bearer_token)])


class AgentChatRequest(BaseModel):
    message: str
    mode: str = "auto"  # auto, interactive, background
    conversation_history: Optional[List[dict]] = None


class ApprovalRequest(BaseModel):
    approval_id: str
    approved: bool


@router.post("/chat")
async def agent_chat(request: Request, body: AgentChatRequest, background_tasks: BackgroundTasks):
    """Chat com capacidade de tool calling."""
    agent = request.app.state.agent_service

    if body.mode == "background":
        task_id = str(uuid.uuid4())
        background_tasks.add_task(
            agent.process_background, body.message, task_id
        )
        return {"task_id": task_id, "status": "started", "message": "Tarefa iniciada em background"}

    # Auto ou interactive
    result = await agent.process_message(
        message=body.message,
        conversation_history=body.conversation_history,
        mode="interactive",
    )
    return result


@router.get("/tools")
async def list_tools(request: Request):
    """Lista todas as tools disponíveis."""
    registry = request.app.state.tool_registry
    return {"tools": registry.list_tools()}


@router.get("/approvals")
async def get_approvals(request: Request):
    """Lista ações L2 pendentes de aprovação."""
    registry = request.app.state.tool_registry
    return {"pending": registry.get_pending_approvals()}


@router.post("/approvals")
async def handle_approval(request: Request, body: ApprovalRequest):
    """Aprova ou rejeita uma ação L2."""
    registry = request.app.state.tool_registry

    if body.approved:
        result = await registry.approve(body.approval_id)
        if result:
            return {"status": "approved", "result": result.to_dict()}
        return {"status": "error", "message": "Aprovação não encontrada"}
    else:
        rejected = registry.reject(body.approval_id)
        return {"status": "rejected" if rejected else "error"}


@router.get("/tasks/{task_id}")
async def get_task_status(request: Request, task_id: str):
    """Status de tarefa em background."""
    agent = request.app.state.agent_service
    status = agent.get_task_status(task_id)
    if not status:
        return {"status": "not_found"}
    return status


@router.get("/audit")
async def get_audit_log(request: Request, limit: int = 50):
    """Últimas entradas do audit log."""
    import json
    log_path = "data/logs/tool_audit.jsonl"
    try:
        with open(log_path, "r") as f:
            lines = f.readlines()
        entries = [json.loads(line) for line in lines[-limit:]]
        entries.reverse()
        return {"entries": entries}
    except FileNotFoundError:
        return {"entries": []}
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 4 — INTEGRAÇÃO NO MAIN.PY
# ═══════════════════════════════════════════════════════════

### Modifique: `backend/app/main.py`

Adicione ao startup da aplicação (NÃO substitua o que já existe, ADICIONE):

```python
# === TOOL LAYER + AGENT SERVICE ===
from app.tools import create_tool_registry
from app.services.agent_service import AgentService

# No startup/lifespan:
tool_registry = create_tool_registry()
app.state.tool_registry = tool_registry

agent_service = AgentService(
    tool_registry=tool_registry,
    brain_router=app.state.brain_router,  # já existe do BrainRouter implementado
    settings=app.state.settings,
)
app.state.agent_service = agent_service

# Registrar router
from app.api.v1.endpoints.agent_api import router as agent_router
app.include_router(agent_router, prefix="/api/v1")
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 5 — FRONTEND: TOOL CALL UI
# ═══════════════════════════════════════════════════════════

### Crie: `frontend/components/chat/ToolCallBlock.tsx`

Componente que renderiza uma tool call dentro da mensagem:
- Ícone da ferramenta (emoji por categoria: 🖥️ shell, 📁 file, 🔀 git, 🚀 vercel, 🌐 browser, 🤖 claude_code, 🍎 macos)
- Nome da tool + parâmetros (colapsável)
- Status: ✅ sucesso | ❌ erro | ⏳ esperando aprovação
- Resultado (colapsável, monospace para output de terminal)
- Se esperando aprovação: botões "Aprovar" e "Rejeitar" inline
- Animação de loading enquanto executa

### Modifique: `frontend/components/chat/message-bubble.tsx`

Quando a mensagem contém `tool_calls` no metadata:
- Renderiza texto normal + ToolCallBlocks intercalados
- Se tem `needs_approval`: mostra banner amarelo "Ação pendente de aprovação"

### Crie: `frontend/components/chat/ApprovalBanner.tsx`

Banner fixo no topo do chat quando há ações L2 pendentes:
- "🔔 1 ação aguardando aprovação"
- Tap para expandir e ver detalhes
- Botões Aprovar / Rejeitar
- Chama POST /api/v1/agent/approvals

### Modifique: `frontend/lib/api.ts`

Adicionar funções:
```typescript
export async function agentChat(message: string, mode?: string) {
  // POST /api/v1/agent/chat
}

export async function getApprovals() {
  // GET /api/v1/agent/approvals
}

export async function handleApproval(approvalId: string, approved: boolean) {
  // POST /api/v1/agent/approvals
}

export async function getToolsList() {
  // GET /api/v1/agent/tools
}
```

### Modifique o fluxo do chat:

O chat principal deve usar o endpoint `/api/v1/agent/chat` em vez do `/api/v1/chat` antigo.
O agent endpoint já faz o roteamento internamente (conversa simples vs ação com tools).
Manter o endpoint antigo funcionando como fallback.

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 6 — INTEGRAÇÃO COM VOZ
# ═══════════════════════════════════════════════════════════

O pipeline de voz já foi implementado. A única mudança necessária:

### Modifique o pipeline de voz para usar o Agent Service:

No endpoint que recebe áudio transcrito (seja via Web Speech API no frontend ou Whisper no backend), ao invés de enviar pro endpoint de chat simples, enviar pro `/api/v1/agent/chat`.

Fluxo completo:
1. Gregory segura botão de microfone e fala
2. Web Speech API transcreve (ou Whisper se configurado)
3. Texto transcrito vai pro `/api/v1/agent/chat`
4. Agent Service detecta intent → executa tools se necessário
5. Resposta volta com texto + tool_calls + audio (TTS)
6. Frontend renderiza texto + ToolCallBlocks + audio player

### No frontend, garantir que o VoiceButton envia pro agent endpoint:

```typescript
// Ao finalizar transcrição de voz:
const result = await agentChat(transcribedText, "interactive");
// Renderizar resultado normalmente (inclui tool_calls se houver)
```

---

# ═══════════════════════════════════════════════════════════
# MÓDULO 7 — TESTES E VALIDAÇÃO
# ═══════════════════════════════════════════════════════════

Após implementar tudo, rode estes testes:

### Teste 1 — Tool Registry:
```bash
cd ~/Projetos/aura_v1/aura/backend
python3 -c "
from app.tools import create_tool_registry
registry = create_tool_registry()
print(f'Tools registradas: {len(registry.list_tools())}')
for tool in registry.list_tools():
    print(f'  - {tool[\"name\"]}: L{tool[\"autonomy_level\"]} — {tool[\"description\"][:60]}')
"
```
Esperado: 10 tools registradas (shell, file_read, file_write, file_search, file_list, git, claude_code, browser, vercel, macos)

### Teste 2 — Shell Tool L1:
```bash
python3 -c "
import asyncio
from app.tools.shell_tool import ShellTool
tool = ShellTool()
result = asyncio.run(tool.execute({'command': 'ls ~/Projetos', 'working_dir': '/tmp'}))
print(f'Success: {result.success}')
print(f'Output: {result.output}')
"
```

### Teste 3 — Shell Tool L3 (deve bloquear):
```bash
python3 -c "
import asyncio
from app.tools.shell_tool import ShellTool
tool = ShellTool()
result = asyncio.run(tool.execute({'command': 'rm -rf /', 'working_dir': '/tmp'}))
print(f'Blocked: {not result.success}')
print(f'Error: {result.error}')
"
```
Esperado: Blocked: True, Error contém "BLOQUEADO"

### Teste 4 — Agent endpoint:
```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AURA_TOKEN" \
  -d '{"message": "liste os arquivos do diretório backend"}'
```
Esperado: resposta com tool_calls contendo file_list ou shell

### Teste 5 — Agent com múltiplas tools:
```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AURA_TOKEN" \
  -d '{"message": "veja o git status do projeto aura e me diz se tem algo pra commitar"}'
```
Esperado: chama git status → analisa → responde

### Teste 6 — Browser tool:
```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AURA_TOKEN" \
  -d '{"message": "abre o github.com no chrome"}'
```
Esperado: abre Chrome no GitHub

### Teste 7 — Frontend build:
```bash
cd ~/Projetos/aura_v1/aura/frontend
pnpm tsc --noEmit && pnpm build
```
Esperado: build sem erros

### Teste 8 — Commit e deploy:
```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "feat: tool layer + agent service + browser automation + mac control"
git push
```

---

# ═══════════════════════════════════════════════════════════
# REGRAS FINAIS
# ═══════════════════════════════════════════════════════════

1. NÃO quebre o que já funciona — chat simples, voz, health checks devem continuar
2. NÃO instale dependências pesadas (playwright, puppeteer) — use AppleScript para browser
3. NÃO exponha .env ou credentials em nenhum output
4. NÃO permita L3 em hipótese alguma — rm -rf, force push, delete permanente, financeiro
5. SEMPRE logue no audit trail — toda tool call é registrada
6. SEMPRE valide paths — path traversal bloqueado
7. O endpoint antigo /api/v1/chat continua funcionando como fallback
8. Timeout de 5 minutos para tools normais, 10 minutos para claude_code
9. Máximo 10 tool calls por mensagem
10. Qwen: "think": false, sem num_predict limit
11. ngrok headers: sempre ngrok-skip-browser-warning: true
12. Mobile first: touch targets 44px, componentes responsivos
13. Se algo já existe e funciona (verificar antes), reutilize — não duplique
14. Rode TODOS os testes no final e reporte resultado de cada um
