import re
from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional

from app.models.project_models import Project


@dataclass
class ToolRoute:
    command: str
    params: Dict[str, object] = field(default_factory=dict)
    reason: str = ""


@dataclass
class ToolAnalysis:
    status: Literal["allowed", "blocked", "unimplemented", "non_operational"]
    route: Optional[ToolRoute] = None
    reason: str = ""
    action_label: Optional[str] = None


class ToolRouter:
    BLOCKED_OPERATION_TERMS = (
        "apaga",
        "apagar",
        "delete",
        "deletar",
        "excluir",
        "remover",
        "format",
        "shutdown",
        "deslig",
        "reinici",
        "reboot",
        "killall",
        "sudo",
        "rm ",
        "rm-",
        "rm/",
    )

    OPERATIONAL_HINTS = (
        "abra",
        "abrir",
        "open",
        "launch",
        "rode",
        "rodar",
        "run ",
        "execut",
        "deploy",
        "status do git",
        "git status",
        "logs",
        "log",
        "cpu",
        "processador",
        "memoria",
        "memória",
        "ram",
        "disco",
        "disk",
        "terminal",
        "vscode",
        "projeto",
    )

    def analyze(self, message: str, projects: List[Project]) -> ToolAnalysis:
        lowered = message.lower()
        project_name = self._detect_project_name(lowered, projects)

        if any(term in lowered for term in ["liste meus projetos", "listar projetos", "quais projetos", "liste os projetos"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="list_projects", reason="Solicitação explícita para listar projetos."),
                action_label="listar projetos",
            )

        if self._is_open_terminal_request(lowered):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="open_terminal", reason="Pedido explícito para abrir o Terminal."),
                action_label="abrir Terminal",
            )

        if "vscode" in lowered and any(term in lowered for term in ["abra", "abrir", "open"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="open_vscode", reason="Pedido explícito para abrir o VS Code."),
                action_label="abrir VS Code",
            )

        if any(term in lowered for term in ["abra o projeto", "abrir projeto", "abrir o projeto", "open project"]):
            if project_name:
                return ToolAnalysis(
                    status="allowed",
                    route=ToolRoute(
                        command="open_project",
                        params={"name": project_name},
                        reason=f"Pedido explícito para abrir o projeto {project_name}.",
                    ),
                    action_label=f"abrir projeto {project_name}",
                )
            return ToolAnalysis(
                status="unimplemented",
                reason="A ação pede abertura de projeto, mas nenhum projeto conhecido foi identificado na mensagem.",
                action_label="abrir projeto",
            )

        if "git" in lowered and "status" in lowered:
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="git_status",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido de status do Git.",
                ),
                action_label="consultar status do Git",
            )

        if any(term in lowered for term in ["logs", "log", "erros recentes"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="show_logs", reason="Pedido por logs recentes."),
                action_label="mostrar logs",
            )

        if any(term in lowered for term in ["cpu", "processador"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="cpu_status", reason="Pedido por uso de CPU."),
                action_label="consultar CPU",
            )

        if any(term in lowered for term in ["memoria", "memória", "ram"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="memory_status", reason="Pedido por uso de memória."),
                action_label="consultar memória",
            )

        if any(term in lowered for term in ["disco", "disk"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="disk_status", reason="Pedido por uso de disco."),
                action_label="consultar disco",
            )

        if any(term in lowered for term in ["saude do sistema", "saúde do sistema", "status do sistema", "system status"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(command="system_info", reason="Pedido por status geral do sistema."),
                action_label="consultar status do sistema",
            )

        if any(term in lowered for term in ["rode lint", "run lint", "pnpm lint", "lint nesse projeto"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_lint",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar lint.",
                ),
                action_label="rodar lint",
            )

        if any(term in lowered for term in ["rode build", "run build", "pnpm build"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_build",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar build.",
                ),
                action_label="rodar build",
            )

        if any(term in lowered for term in ["rode test", "run test", "pnpm test"]):
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="run_project_test",
                    params={"name": project_name} if project_name else {},
                    reason="Pedido explícito para rodar testes.",
                ),
                action_label="rodar testes",
            )

        if any(term in lowered for term in ["rode dev", "run dev", "suba o projeto", "ambiente local"]):
            if project_name:
                return ToolAnalysis(
                    status="allowed",
                    route=ToolRoute(
                        command="run_project_dev",
                        params={"name": project_name},
                        reason="Pedido explícito para subir ambiente local.",
                    ),
                    action_label=f"subir ambiente do projeto {project_name}",
                )
            return ToolAnalysis(
                status="unimplemented",
                reason="A ação pede execução de ambiente local, mas a mensagem não identifica um projeto alvo.",
                action_label="subir ambiente local",
            )

        # AuraDev integration — detect dev intent before Claude Code
        dev_result = self._check_dev_request(message)
        if dev_result:
            return dev_result

        # Claude Code integration
        claude_result = self._check_claude_code_request(lowered, message)
        if claude_result:
            return claude_result

        if any(term in lowered for term in self.BLOCKED_OPERATION_TERMS):
            return ToolAnalysis(
                status="blocked",
                reason="A solicitação é operacional, mas cai fora da whitelist segura de comandos da Aura.",
            )

        if any(term in lowered for term in self.OPERATIONAL_HINTS):
            return ToolAnalysis(
                status="unimplemented",
                reason="A solicitação parece operacional, mas ainda não existe uma tool/comando implementado para ela.",
            )

        return ToolAnalysis(status="non_operational")

    def route(self, message: str, projects: List[Project]) -> Optional[ToolRoute]:
        return self.analyze(message, projects).route

    def _is_open_terminal_request(self, message: str) -> bool:
        return "terminal" in message and any(term in message for term in ["abra", "abrir", "open", "launch"])

    def _detect_project_name(self, message: str, projects: List[Project]) -> Optional[str]:
        for project in projects:
            if project.name.lower() in message:
                return project.name
        return None

    def _check_dev_request(self, message: str) -> Optional[ToolAnalysis]:
        """Detect dev intent and route to AuraDev."""
        try:
            from app.tools.dev_tool import detect_dev_intent
        except ImportError:
            return None

        detected = detect_dev_intent(message)
        if not detected:
            return None

        intent_type = detected["intent_type"]
        params = detected["params"]

        return ToolAnalysis(
            status="allowed",
            route=ToolRoute(
                command="auradev_execute",
                params={
                    "intent_type": intent_type,
                    **params,
                },
                reason=f"Tarefa de desenvolvimento detectada: {intent_type}",
            ),
            action_label=f"AuraDev: {intent_type}",
        )

    CLAUDE_ACTION_PATTERNS = (
        "manda pro claude", "mande pro claude",
        "envia pro claude", "envie pro claude",
        "pede pro claude", "peça pro claude",
        "executa no claude", "execute no claude",
        "usa o claude", "use o claude",
        "fala pro claude", "diz pro claude",
        "roda no claude", "rode no claude",
        "manda para o claude", "envia para o claude",
        "pede para o claude", "peça para o claude",
        "manda pra o claude", "envia pra o claude",
        "manda comando pro claude", "manda comando para o claude",
        "mandar comando pro claude", "mandar comando para o claude",
    )

    CLAUDE_QUESTION_INDICATORS = ("?", "consegue", "pode ", "como ", "o que é", "o que e")

    def _check_claude_code_request(self, lowered: str, original: str) -> Optional[ToolAnalysis]:
        """Detect Claude Code delegation requests and extract prompt."""
        has_claude_ref = "claude code" in lowered or "claude" in lowered
        if not has_claude_ref:
            return None

        # Questions about Claude Code → let LLM answer conversationally
        if any(q in lowered for q in self.CLAUDE_QUESTION_INDICATORS):
            return ToolAnalysis(
                status="non_operational",
                reason="Pergunta sobre Claude Code — resposta conversacional.",
            )

        # Direct action patterns
        for pattern in self.CLAUDE_ACTION_PATTERNS:
            if pattern in lowered:
                prompt = self._extract_claude_prompt(original, pattern)
                return ToolAnalysis(
                    status="allowed",
                    route=ToolRoute(
                        command="claude_execute",
                        params={"prompt": prompt},
                        reason="Delegação explícita para Claude Code CLI.",
                    ),
                    action_label="executar via Claude Code",
                )

        # "claude code, [prompt]" or "claude code: [prompt]" at start
        if lowered.startswith("claude code") or lowered.startswith("claude,") or lowered.startswith("claude:"):
            prompt = self._extract_claude_prompt(original, "")
            return ToolAnalysis(
                status="allowed",
                route=ToolRoute(
                    command="claude_execute",
                    params={"prompt": prompt},
                    reason="Delegação direta para Claude Code CLI.",
                ),
                action_label="executar via Claude Code",
            )

        return None

    def _extract_claude_prompt(self, message: str, matched_pattern: str) -> str:
        """Extract the actual prompt from a Claude Code request."""
        # Try regex patterns: "... claude code: [prompt]" or "... claude code, [prompt]"
        for regex in (
            r"claude\s*code\s*[,:]\s*(.+)",
            r"claude\s*[,:]\s*(.+)",
        ):
            match = re.search(regex, message, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Strip matched action pattern prefix and "claude code" to get the prompt
        if matched_pattern:
            idx = message.lower().find(matched_pattern)
            if idx >= 0:
                after = message[idx + len(matched_pattern):].strip()
                # Remove remaining "code" if pattern ended with "claude"
                after_lower = after.lower()
                if after_lower.startswith("code"):
                    after = after[4:].strip()
                # Remove separator
                if after and after[0] in ":,":
                    after = after[1:].strip()
                if after:
                    return after

        # Fallback: strip "claude code" prefix
        cleaned = re.sub(r"^claude\s*code\s*[,:;]?\s*", "", message, flags=re.IGNORECASE).strip()
        return cleaned if cleaned else message
