from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.models.companion_models import CompanionOverviewData, MemorySignal, PrioritySignal, QuickAction, TrustSignal
from app.services.behavior_service import BehaviorService
from app.services.memory_service import MemoryService
from app.utils.helpers import iso_now


class ContextService:
    def __init__(self, memory_service: MemoryService, behavior_service: BehaviorService):
        self.memory_service = memory_service
        self.behavior_service = behavior_service

    def build_chat_runtime_context(self, session_id: str, message: str, project_id: Optional[str] = None) -> Dict[str, Any]:
        recent_messages = self.memory_service.get_chat_messages(session_id=session_id, limit=8)
        companion_memory = self.memory_service.get_companion_memory()
        memory_signals = self._memory_signals(recent_messages, companion_memory)
        project_hint = next((item for item in companion_memory.get("project_memory", []) if item.get("project_id") == project_id), None)
        context_summary = self._build_context_summary(message, recent_messages, project_hint)
        return {
            "context_summary": context_summary,
            "memory_signals": [item.model_dump() for item in memory_signals[:4]],
            "memory_prompt_points": [item.content for item in memory_signals[:5]],
            "behavior_mode": self.behavior_service.resolve_mode(message),
        }

    def remember_exchange(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        intent: str,
        action_taken: Optional[Dict[str, Any]] = None,
    ) -> None:
        timestamp = iso_now()
        self.memory_service.remember_companion_item(
            "recent_context",
            {
                "id": str(uuid4()),
                "title": "Sessao recente",
                "content": user_message[:180],
                "source": "chat",
                "kind": "recent",
                "updated_at": timestamp,
                "dedupe_key": f"{session_id}:{user_message[:48]}",
                "intent": intent,
            },
        )
        if action_taken and action_taken.get("command"):
            self.memory_service.remember_companion_item(
                "operational_memory",
                {
                    "id": str(uuid4()),
                    "title": f"Acao {action_taken['command']}",
                    "content": assistant_message[:180],
                    "source": "action",
                    "kind": "operational",
                    "updated_at": timestamp,
                    "dedupe_key": f"{action_taken['command']}:{action_taken.get('status')}",
                    "status": action_taken.get("status"),
                },
            )
        self._learn_preferences(user_message, timestamp)

    def companion_overview(
        self,
        *,
        status: Dict[str, Any],
        projects: List[Dict[str, Any]],
        voice_status: Dict[str, Any],
        audit_logs: List[Dict[str, Any]],
    ) -> CompanionOverviewData:
        memory = self.memory_service.get_companion_memory()
        priorities = self._priorities(status, projects, audit_logs)
        trust = self._trust_signals(status, audit_logs, voice_status)
        pending_actions = [
            item
            for item in memory.get("operational_memory", [])
            if item.get("status") in {"awaiting_confirmation", "blocked"}
        ][:4]
        return CompanionOverviewData(
            greeting=self._greeting(),
            focus_summary="Aura acompanha prioridades, contexto recente, memoria util e sinais operacionais em uma unica superficie.",
            founder_mode=True,
            behavior_mode="founder-operational",
            presence_state="ready",
            voice_state="ready" if voice_status.get("pipeline_ready") else "standby",
            priorities=priorities,
            recent_projects=[project.model_dump() if hasattr(project, "model_dump") else dict(project) for project in projects[:4]],
            memory_signals=self._memory_signals(self.memory_service.get_chat_messages(limit=12), memory)[:5],
            trust_signals=trust,
            pending_actions=[
                {
                    "command": item.get("title", "acao"),
                    "category": "governance",
                    "risk_level": "elevated",
                    "risk_score": 3,
                    "requires_confirmation": True,
                    "preview": item.get("content", ""),
                    "side_effects": ["Aguardando confirmacao humana."],
                    "allowed": True,
                }
                for item in pending_actions
            ],
            quick_actions=[
                QuickAction(label="Organizar meu dia", prompt="Organize meu dia com base no contexto atual e nas prioridades em aberto.", category="daily"),
                QuickAction(label="Retomar projeto", prompt="Mostre o projeto mais quente agora e como retomar com clareza.", category="projects"),
                QuickAction(label="Revisar pendencias", prompt="Resuma pendencias, decisoes em aberto e proximos passos.", category="operations"),
                QuickAction(label="Iniciar voz", prompt="Entre em modo de voz e me diga o estado atual da Aura.", category="voice"),
            ],
            telemetry={
                "services": status.get("services", {}),
                "jobs": status.get("jobs", {}),
                "updated_at": iso_now(),
            },
        )

    def memory_snapshot(self) -> Dict[str, Any]:
        memory = self.memory_service.get_companion_memory()
        return {
            "profile": memory.get("profile", {}),
            "preferences": self._normalize_bucket(memory.get("preferences", []), kind="personal", fallback_title="Preferencia")[:6],
            "project_memory": self._normalize_bucket(memory.get("project_memory", []), kind="project", fallback_title="Projeto")[:6],
            "operational_memory": self._normalize_bucket(memory.get("operational_memory", []), kind="operational", fallback_title="Operacao")[:8],
            "recent_context": self._normalize_bucket(memory.get("recent_context", []), kind="recent", fallback_title="Contexto recente")[:8],
        }

    def trust_snapshot(self, *, status: Dict[str, Any], voice_status: Dict[str, Any], audit_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "signals": [item.model_dump() for item in self._trust_signals(status, audit_logs, voice_status)],
            "recent_activity": audit_logs[-10:],
            "voice": voice_status,
            "policy_state": {
                "default_mode": "deny-by-default",
                "confirmation_for_sensitive_actions": True,
                "audit_logging": True,
            },
        }

    def _build_context_summary(self, message: str, recent_messages: List[Dict[str, Any]], project_hint: Optional[Dict[str, Any]]) -> str:
        last_user_message = next((item.get("content") for item in reversed(recent_messages) if item.get("role") == "user"), None)
        summary_parts = []
        if last_user_message:
            summary_parts.append(f"Ultimo foco do usuario: {last_user_message[:140]}")
        if project_hint:
            summary_parts.append(f"Projeto em memoria: {project_hint.get('title')}")
        summary_parts.append(f"Pedido atual: {message[:180]}")
        return " | ".join(summary_parts)

    def _memory_signals(self, recent_messages: List[Dict[str, Any]], companion_memory: Dict[str, Any]) -> List[MemorySignal]:
        signals: List[MemorySignal] = []
        for item in companion_memory.get("preferences", [])[:2]:
            signals.append(
                MemorySignal(
                    id=item.get("id", str(uuid4())),
                    kind="personal",
                    title=item.get("title", "Preferencia"),
                    content=item.get("content", ""),
                    confidence=item.get("confidence", 0.72),
                    source=item.get("source", "profile"),
                    updated_at=item.get("updated_at", iso_now()),
                    sensitive=item.get("sensitive", False),
                )
            )
        for item in companion_memory.get("operational_memory", [])[:2]:
            signals.append(
                MemorySignal(
                    id=item.get("id", str(uuid4())),
                    kind="operational",
                    title=item.get("title", "Operacao recente"),
                    content=item.get("content", ""),
                    confidence=0.77,
                    source=item.get("source", "action"),
                    updated_at=item.get("updated_at", iso_now()),
                )
            )
        for item in recent_messages[-2:]:
            if not item.get("content"):
                continue
            signals.append(
                MemorySignal(
                    id=str(uuid4()),
                    kind="session",
                    title="Contexto recente",
                    content=item["content"][:180],
                    confidence=0.6,
                    source="chat_history",
                    updated_at=iso_now(),
                )
            )
        return signals

    def _normalize_bucket(self, items: List[Dict[str, Any]], *, kind: str, fallback_title: str) -> List[Dict[str, Any]]:
        normalized = []
        for item in items:
            normalized.append(
                {
                    "id": item.get("id", str(uuid4())),
                    "kind": item.get("kind", kind),
                    "title": item.get("title", fallback_title),
                    "content": item.get("content", ""),
                    "confidence": item.get("confidence", 0.7),
                    "source": item.get("source", "memory"),
                    "updated_at": item.get("updated_at", iso_now()),
                    "sensitive": item.get("sensitive", False),
                }
            )
        return normalized

    def _priorities(self, status: Dict[str, Any], projects: List[Dict[str, Any]], audit_logs: List[Dict[str, Any]]) -> List[PrioritySignal]:
        priorities = [
            PrioritySignal(
                id="priority-readiness",
                label="Readiness do runtime",
                description=f"Estado atual da Aura: {status.get('status', 'indisponivel')}.",
                level="important",
                source="system",
            )
        ]
        if projects:
            priorities.append(
                PrioritySignal(
                    id="priority-projects",
                    label="Projetos ativos",
                    description=f"{len(projects)} projeto(s) disponiveis para retomada imediata.",
                    level="active",
                    source="projects",
                )
            )
        if any(log.get("status") == "error" for log in audit_logs[-8:]):
            priorities.append(
                PrioritySignal(
                    id="priority-errors",
                    label="Falhas recentes",
                    description="Existem sinais operacionais recentes que merecem revisao.",
                    level="urgent",
                    source="audit",
                )
            )
        return priorities[:4]

    def _trust_signals(self, status: Dict[str, Any], audit_logs: List[Dict[str, Any]], voice_status: Dict[str, Any]) -> List[TrustSignal]:
        signals = [
            TrustSignal(
                id="trust-auth",
                label="Modo de autenticacao",
                detail=f"Operando em modo {status.get('auth_mode', 'local')}.",
                level="good",
                source="security",
            ),
            TrustSignal(
                id="trust-audit",
                label="Auditoria ativa",
                detail=f"{min(len(audit_logs), 10)} evento(s) recentes disponiveis para revisao.",
                level="good",
                source="audit",
            ),
            TrustSignal(
                id="trust-voice",
                label="Voice runtime",
                detail="Pipeline pronto." if voice_status.get("pipeline_ready") else "Pipeline em standby.",
                level="good" if voice_status.get("pipeline_ready") else "attention",
                source="voice",
            ),
        ]
        if status.get("services", {}).get("llm") != "online":
            signals.append(
                TrustSignal(
                    id="trust-llm",
                    label="Modelo principal",
                    detail="Provider principal nao esta online.",
                    level="warning",
                    source="runtime",
                )
            )
        return signals[:4]

    def _learn_preferences(self, user_message: str, timestamp: str) -> None:
        lowered = user_message.lower()
        inferred = None
        if "seja direto" in lowered or "mais direto" in lowered:
            inferred = {
                "id": str(uuid4()),
                "title": "Preferencia de comunicacao",
                "content": "Preferencia por respostas diretas e executivas.",
                "source": "chat_inference",
                "updated_at": timestamp,
                "confidence": 0.76,
                "dedupe_key": "preference-direct",
            }
        elif "checklist" in lowered:
            inferred = {
                "id": str(uuid4()),
                "title": "Formato preferido",
                "content": "Checklist costuma ser um formato util para organizacao operacional.",
                "source": "chat_inference",
                "updated_at": timestamp,
                "confidence": 0.7,
                "dedupe_key": "preference-checklist",
            }

        if inferred:
            self.memory_service.remember_companion_item("preferences", inferred, limit=12)

    def _greeting(self) -> str:
        hour = datetime.now().hour
        if hour < 12:
            return "Bom dia. A Aura ja organizou o contexto essencial para iniciar o dia."
        if hour < 18:
            return "Boa tarde. O cockpit operacional esta pronto para sustentar o ritmo."
        return "Boa noite. A Aura pode ajudar a consolidar o dia e preparar o proximo passo."
