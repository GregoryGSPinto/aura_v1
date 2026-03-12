from typing import Any, Dict, Optional

from app.models.companion_models import ActionPreview


ACTION_CATALOG: Dict[str, Dict[str, Any]] = {
    "list_projects": {
        "category": "read",
        "risk_score": 1,
        "preview": "Ler a lista de projetos cadastrados no workspace da Aura.",
        "side_effects": [],
    },
    "git_status": {
        "category": "read",
        "risk_score": 1,
        "preview": "Consultar o status Git do projeto solicitado sem alterar arquivos.",
        "side_effects": ["Leitura local do repositório."],
    },
    "show_logs": {
        "category": "read",
        "risk_score": 2,
        "preview": "Ler logs recentes de auditoria e execucao da Aura.",
        "side_effects": ["Exibe historico operacional recente."],
    },
    "system_info": {
        "category": "read",
        "risk_score": 1,
        "preview": "Coletar um resumo do estado operacional do runtime local.",
        "side_effects": [],
    },
    "cpu_status": {
        "category": "read",
        "risk_score": 1,
        "preview": "Consultar o uso atual de CPU do sistema local.",
        "side_effects": [],
    },
    "memory_status": {
        "category": "read",
        "risk_score": 1,
        "preview": "Consultar o uso atual de memoria do sistema local.",
        "side_effects": [],
    },
    "disk_status": {
        "category": "read",
        "risk_score": 1,
        "preview": "Consultar ocupacao de disco do sistema local.",
        "side_effects": [],
    },
    "open_terminal": {
        "category": "launch",
        "risk_score": 2,
        "preview": "Abrir o aplicativo Terminal no dispositivo atual.",
        "side_effects": ["Abre uma janela local do sistema."],
    },
    "open_vscode": {
        "category": "launch",
        "risk_score": 2,
        "preview": "Abrir o VS Code no dispositivo atual.",
        "side_effects": ["Abre um aplicativo local."],
    },
    "open_project": {
        "category": "workspace",
        "risk_score": 2,
        "preview": "Abrir o projeto solicitado no workspace configurado.",
        "side_effects": ["Abre um contexto local de trabalho."],
    },
    "run_project_lint": {
        "category": "script",
        "risk_score": 3,
        "preview": "Executar o script de lint do projeto solicitado.",
        "side_effects": ["Pode consumir CPU e gerar logs."],
    },
    "run_project_build": {
        "category": "script",
        "risk_score": 3,
        "preview": "Executar o build do projeto solicitado.",
        "side_effects": ["Pode consumir CPU, memoria e gerar artefatos."],
    },
    "run_project_test": {
        "category": "script",
        "risk_score": 3,
        "preview": "Executar a suite de testes do projeto solicitado.",
        "side_effects": ["Pode gerar logs e artefatos temporarios."],
    },
    "run_project_dev": {
        "category": "script",
        "risk_score": 4,
        "preview": "Subir o ambiente de desenvolvimento do projeto solicitado.",
        "side_effects": ["Inicia processos locais persistentes."],
    },
    "vercel_deploy": {
        "category": "deploy",
        "risk_score": 5,
        "preview": "Disparar um deploy com efeito externo.",
        "side_effects": ["Cria efeito persistente fora do ambiente local."],
    },
}


class ActionGovernanceService:
    def preview(self, command: str, params: Optional[Dict[str, Any]] = None) -> ActionPreview:
        payload = ACTION_CATALOG.get(
            command,
            {
                "category": "unknown",
                "risk_score": 5,
                "preview": "Acao fora do catalogo governado.",
                "side_effects": ["Superficie nao reconhecida."],
            },
        )
        risk_score = int(payload["risk_score"])
        return ActionPreview(
            command=command,
            category=payload["category"],
            risk_level=self._risk_level(risk_score),
            risk_score=risk_score,
            requires_confirmation=risk_score >= 3,
            preview=self._format_preview(payload["preview"], params or {}),
            side_effects=list(payload.get("side_effects", [])),
            allowed=command in ACTION_CATALOG,
        )

    def _risk_level(self, risk_score: int) -> str:
        if risk_score <= 1:
            return "low"
        if risk_score == 2:
            return "moderate"
        if risk_score == 3:
            return "elevated"
        if risk_score == 4:
            return "high"
        return "critical"

    def _format_preview(self, base: str, params: Dict[str, Any]) -> str:
        name = params.get("name") or params.get("project_name")
        if name:
            return f"{base} Alvo: {name}."
        return base
