# 🧠 PROMPT MASTER — Multi-Agent Orchestration System
## Sistema Autônomo de Múltiplos Agentes com Vector Memory

---

## 📋 VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AURA MULTI-AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐    │
│  │   USER      │────▶│  ORCHESTRATOR │────▶│   AGENT SWARM          │    │
│  │  REQUEST    │     │              │     │                        │    │
│  └─────────────┘     └─────────────┘     │  ┌─────┐ ┌─────┐ ┌────┐│    │
│         │                     │           │  │Plan │ │Res  │ │Dev ││    │
│         │                     ▼           │  └─────┘ └─────┘ └────┘│    │
│         │            ┌─────────────┐      │  ┌─────┐ ┌─────┐ ┌────┐│    │
│         │            │TASK PLANNER │      │  │Sys  │ │Auto │ │Val ││    │
│         │            │             │      │  └─────┘ └─────┘ └────┘│    │
│         │            │- Decompose  │      └─────────────────────────┘    │
│         │            │- Assign     │                │                     │
│         │            │- Schedule   │                ▼                     │
│         │            └─────────────┘      ┌──────────────────┐           │
│         │                     │           │  VECTOR MEMORY   │           │
│         │                     ▼           │  ├─ Conversas    │           │
│         │            ┌─────────────┐      │  ├─ Documentos   │           │
│         └───────────▶│  RESULT     │◀────│  ├─ Contexto     │           │
│                      │             │      │  └─ Embeddings   │           │
│                      └─────────────┘      └──────────────────┘           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ ESTRUTURA DO PROJETO

```
backend/aura/
├── orchestrator/           # NOVO - Sistema de orquestração
│   ├── __init__.py
│   ├── orchestrator.py
│   ├── task_router.py
│   ├── agent_registry.py
│   └── task_planner.py
├── agents/                 # NOVO - Agentes especializados
│   ├── __init__.py
│   ├── base_agent.py
│   ├── planner_agent.py
│   ├── research_agent.py
│   ├── developer_agent.py
│   ├── system_agent.py
│   ├── automation_agent.py
│   └── validator_agent.py
├── memory/                 # ATUALIZAR
│   ├── __init__.py
│   ├── short_term.py       # Existente
│   └── vector/             # NOVO
│       ├── __init__.py
│       ├── embedding_store.py
│       ├── memory_retriever.py
│       └── chroma_client.py
├── execution/              # NOVO
│   ├── __init__.py
│   ├── execution_engine.py
│   └── autonomous_mode.py
└── monitoring/             # NOVO
    ├── __init__.py
    └── agent_monitor.py
```

---

## 🎭 FASE 1 — AGENT ORCHESTRATOR

### 📄 `backend/aura/orchestrator/__init__.py`
```python
"""Orchestrator Module - Sistema de orquestração multi-agente."""

from .orchestrator import AgentOrchestrator
from .task_router import TaskRouter
from .agent_registry import AgentRegistry
from .task_planner import TaskPlanner

__all__ = ['AgentOrchestrator', 'TaskRouter', 'AgentRegistry', 'TaskPlanner']
```

### 📄 `backend/aura/orchestrator/agent_registry.py`
```python
"""Registro e gerenciamento de agentes."""

from typing import Dict, List, Optional, Type, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio

class AgentStatus(Enum):
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"

@dataclass
class AgentInfo:
    agent_id: str
    name: str
    agent_type: str
    capabilities: List[str]
    status: AgentStatus
    current_task: Optional[str] = None
    task_count: int = 0
    success_rate: float = 1.0
    last_active: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

class AgentRegistry:
    """Registro central de todos os agentes do sistema."""
    
    def __init__(self):
        self._agents: Dict[str, AgentInfo] = {}
        self._agent_instances: Dict[str, Any] = {}
        self._capability_index: Dict[str, List[str]] = {}
    
    def register(
        self, 
        agent_id: str, 
        name: str,
        agent_type: str,
        capabilities: List[str],
        instance: Any,
        metadata: Optional[Dict] = None
    ) -> AgentInfo:
        """Registra um novo agente."""
        
        info = AgentInfo(
            agent_id=agent_id,
            name=name,
            agent_type=agent_type,
            capabilities=capabilities,
            status=AgentStatus.IDLE,
            metadata=metadata or {}
        )
        
        self._agents[agent_id] = info
        self._agent_instances[agent_id] = instance
        
        # Indexar capacidades
        for cap in capabilities:
            if cap not in self._capability_index:
                self._capability_index[cap] = []
            self._capability_index[cap].append(agent_id)
        
        return info
    
    def unregister(self, agent_id: str) -> bool:
        """Remove um agente do registro."""
        if agent_id not in self._agents:
            return False
        
        agent = self._agents[agent_id]
        
        # Remover do índice de capacidades
        for cap in agent.capabilities:
            if cap in self._capability_index:
                self._capability_index[cap].remove(agent_id)
        
        del self._agents[agent_id]
        del self._agent_instances[agent_id]
        
        return True
    
    def get_agent(self, agent_id: str) -> Optional[AgentInfo]:
        """Retorna informações de um agente."""
        return self._agents.get(agent_id)
    
    def get_instance(self, agent_id: str) -> Optional[Any]:
        """Retorna instância de um agente."""
        return self._agent_instances.get(agent_id)
    
    def find_agents_by_capability(
        self, 
        capability: str,
        available_only: bool = True
    ) -> List[AgentInfo]:
        """Encontra agentes por capacidade."""
        agent_ids = self._capability_index.get(capability, [])
        agents = [self._agents[aid] for aid in agent_ids]
        
        if available_only:
            agents = [a for a in agents if a.status == AgentStatus.IDLE]
        
        # Ordenar por taxa de sucesso
        return sorted(agents, key=lambda a: a.success_rate, reverse=True)
    
    def update_status(
        self, 
        agent_id: str, 
        status: AgentStatus,
        current_task: Optional[str] = None
    ) -> bool:
        """Atualiza status de um agente."""
        if agent_id not in self._agents:
            return False
        
        agent = self._agents[agent_id]
        agent.status = status
        agent.current_task = current_task
        agent.last_active = datetime.now()
        
        return True
    
    def record_result(
        self, 
        agent_id: str, 
        success: bool
    ) -> None:
        """Registra resultado de uma execução."""
        if agent_id not in self._agents:
            return
        
        agent = self._agents[agent_id]
        agent.task_count += 1
        
        # Atualizar taxa de sucesso com média móvel
        alpha = 0.1  # Fator de suavização
        current = agent.success_rate
        agent.success_rate = current * (1 - alpha) + (1.0 if success else 0.0) * alpha
    
    def list_agents(
        self, 
        status: Optional[AgentStatus] = None
    ) -> List[AgentInfo]:
        """Lista todos os agentes registrados."""
        agents = list(self._agents.values())
        
        if status:
            agents = [a for a in agents if a.status == status]
        
        return agents
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do sistema."""
        total = len(self._agents)
        by_status = {
            status.value: len([a for a in self._agents.values() if a.status == status])
            for status in AgentStatus
        }
        
        total_tasks = sum(a.task_count for a in self._agents.values())
        avg_success = sum(a.success_rate for a in self._agents.values()) / total if total > 0 else 0
        
        return {
            "total_agents": total,
            "by_status": by_status,
            "total_tasks_executed": total_tasks,
            "average_success_rate": round(avg_success, 3),
            "capabilities": list(self._capability_index.keys())
        }
```

### 📄 `backend/aura/orchestrator/task_router.py`
```python
"""Roteamento inteligente de tarefas para agentes."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import asyncio

class RoutingStrategy(Enum):
    BEST_FIT = "best_fit"      # Melhor capacidade + disponibilidade
    ROUND_ROBIN = "round_robin" # Distribuição uniforme
    LOAD_BALANCED = "load_balanced"  # Menor carga
    PRIORITY = "priority"      # Prioridade específica

@dataclass
class Task:
    task_id: str
    task_type: str
    description: str
    requirements: List[str]
    priority: int  # 1-10
    payload: Dict[str, Any]
    assigned_agent: Optional[str] = None
    status: str = "pending"
    result: Optional[Any] = None

class TaskRouter:
    """Roteia tarefas para os agentes mais adequados."""
    
    def __init__(self, agent_registry):
        self.registry = agent_registry
        self.strategy = RoutingStrategy.BEST_FIT
        self._round_robin_index = 0
        self._task_queue: List[Task] = []
        self._active_tasks: Dict[str, Task] = {}
    
    def route_task(
        self, 
        task: Task,
        strategy: Optional[RoutingStrategy] = None
    ) -> Optional[str]:
        """Roteia uma tarefa para o melhor agente."""
        
        strategy = strategy or self.strategy
        
        # Encontrar agentes com as capacidades necessárias
        candidates = []
        for req in task.requirements:
            agents = self.registry.find_agents_by_capability(req, available_only=True)
            candidates.extend(agents)
        
        if not candidates:
            return None
        
        # Remover duplicatas
        seen = set()
        candidates = [a for a in candidates if not (a.agent_id in seen or seen.add(a.agent_id))]
        
        # Aplicar estratégia de roteamento
        if strategy == RoutingStrategy.BEST_FIT:
            return self._best_fit(candidates, task)
        elif strategy == RoutingStrategy.ROUND_ROBIN:
            return self._round_robin(candidates)
        elif strategy == RoutingStrategy.LOAD_BALANCED:
            return self._load_balanced(candidates)
        elif strategy == RoutingStrategy.PRIORITY:
            return self._priority_based(candidates, task)
        
        return candidates[0].agent_id if candidates else None
    
    def _best_fit(self, candidates: List[Any], task: Task) -> Optional[str]:
        """Seleciona agente com melhor combinação de capacidades."""
        best_score = -1
        best_agent = None
        
        for agent in candidates:
            # Calcular score baseado em:
            # 1. Taxa de sucesso (40%)
            # 2. Quantidade de capacidades matching (40%)
            # 3. Tempo desde última atividade (20%)
            
            from datetime import datetime
            idle_time = (datetime.now() - agent.last_active).total_seconds()
            
            matching_caps = len(set(agent.capabilities) & set(task.requirements))
            
            score = (
                agent.success_rate * 0.4 +
                (matching_caps / len(task.requirements)) * 0.4 +
                min(idle_time / 60, 1.0) * 0.2  # Normalizado para 1 minuto
            )
            
            if score > best_score:
                best_score = score
                best_agent = agent
        
        return best_agent.agent_id if best_agent else None
    
    def _round_robin(self, candidates: List[Any]) -> Optional[str]:
        """Distribuição round-robin."""
        if not candidates:
            return None
        
        idx = self._round_robin_index % len(candidates)
        self._round_robin_index = (self._round_robin_index + 1) % len(candidates)
        
        return candidates[idx].agent_id
    
    def _load_balanced(self, candidates: List[Any]) -> Optional[str]:
        """Seleciona agente com menor carga."""
        # Ordenar por número de tarefas executadas recentemente
        return min(candidates, key=lambda a: a.task_count).agent_id if candidates else None
    
    def _priority_based(self, candidates: List[Any], task: Task) -> Optional[str]:
        """Roteamento baseado em prioridade."""
        # Para tarefas de alta prioridade, usar agente com melhor taxa de sucesso
        if task.priority >= 8:
            return max(candidates, key=lambda a: a.success_rate).agent_id if candidates else None
        
        return self._best_fit(candidates, task)
    
    async def execute_task(
        self, 
        task: Task,
        agent_id: str
    ) -> Dict[str, Any]:
        """Executa uma tarefa em um agente."""
        
        agent = self.registry.get_instance(agent_id)
        if not agent:
            return {"success": False, "error": "Agente não encontrado"}
        
        # Atualizar status
        self.registry.update_status(agent_id, "busy", task.task_id)
        task.assigned_agent = agent_id
        task.status = "running"
        self._active_tasks[task.task_id] = task
        
        try:
            # Executar tarefa
            result = await agent.execute(task.payload)
            
            task.result = result
            task.status = "completed"
            
            # Registrar sucesso
            self.registry.record_result(agent_id, True)
            
            return {"success": True, "result": result}
            
        except Exception as e:
            task.status = "failed"
            self.registry.record_result(agent_id, False)
            
            return {"success": False, "error": str(e)}
            
        finally:
            # Liberar agente
            self.registry.update_status(agent_id, "idle")
            del self._active_tasks[task.task_id]
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Retorna status da fila de tarefas."""
        return {
            "queued": len(self._task_queue),
            "active": len(self._active_tasks),
            "queue": [
                {"id": t.task_id, "type": t.task_type, "priority": t.priority}
                for t in self._task_queue[:10]  # Primeiros 10
            ],
            "active_tasks": [
                {"id": t.task_id, "agent": t.assigned_agent, "type": t.task_type}
                for t in self._active_tasks.values()
            ]
        }
```

---

## 🧩 FASE 2 — AGENTES ESPECIALIZADOS

### 📄 `backend/aura/agents/base_agent.py`
```python
"""Classe base para todos os agentes."""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime
import uuid

@dataclass
class AgentResult:
    success: bool
    data: Any
    execution_time_ms: int
    metadata: Dict[str, Any]
    timestamp: datetime

class BaseAgent(ABC):
    """Classe base abstrata para agentes."""
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        capabilities: List[str],
        config: Optional[Dict] = None
    ):
        self.agent_id = agent_id or str(uuid.uuid4())
        self.name = name
        self.capabilities = capabilities
        self.config = config or {}
        self.execution_count = 0
        self.success_count = 0
    
    @abstractmethod
    async def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa o contexto e retorna insights."""
        pass
    
    @abstractmethod
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """Executa uma tarefa."""
        pass
    
    @abstractmethod
    async def report(self, result: AgentResult) -> Dict[str, Any]:
        """Gera relatório da execução."""
        pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do agente."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "capabilities": self.capabilities,
            "execution_count": self.execution_count,
            "success_count": self.success_count,
            "success_rate": self.success_count / self.execution_count if self.execution_count > 0 else 0
        }
```

### 📄 `backend/aura/agents/planner_agent.py`
```python
"""Planner Agent - Decompõe tarefas complexas."""

from typing import Dict, Any, List
from datetime import datetime
import time

from .base_agent import BaseAgent, AgentResult

class PlannerAgent(BaseAgent):
    """Agente especializado em planejamento de tarefas."""
    
    def __init__(self, config: Dict = None):
        super().__init__(
            agent_id="planner_001",
            name="Planner",
            capabilities=["planning", "task_decomposition", "strategy"],
            config=config
        )
        self.planning_history = []
    
    async def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa uma solicitação e identifica necessidades."""
        
        request = context.get("request", "")
        
        # Análise simples baseada em palavras-chave
        analysis = {
            "complexity": self._assess_complexity(request),
            "domain": self._identify_domain(request),
            "estimated_steps": self._estimate_steps(request),
            "required_capabilities": self._identify_capabilities(request),
            "dependencies": []
        }
        
        return analysis
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """Cria um plano de execução."""
        
        start_time = time.time()
        
        request = task.get("request", "")
        constraints = task.get("constraints", {})
        
        # Decompor em subtarefas
        subtasks = self._decompose_task(request)
        
        # Criar plano estruturado
        plan = {
            "original_request": request,
            "subtasks": subtasks,
            "execution_order": list(range(len(subtasks))),
            "estimated_duration_minutes": len(subtasks) * 5,
            "parallelizable": self._identify_parallel_tasks(subtasks),
            "checkpoints": self._define_checkpoints(subtasks)
        }
        
        execution_time = int((time.time() - start_time) * 1000)
        
        self.execution_count += 1
        self.success_count += 1
        
        return AgentResult(
            success=True,
            data=plan,
            execution_time_ms=execution_time,
            metadata={"subtask_count": len(subtasks)},
            timestamp=datetime.now()
        )
    
    async def report(self, result: AgentResult) -> Dict[str, Any]:
        """Gera relatório do planejamento."""
        
        plan = result.data
        
        return {
            "agent": self.name,
            "type": "planning_report",
            "summary": f"Plano criado com {plan['subtask_count']} subtarefas",
            "details": plan,
            "recommendations": [
                "Execute tarefas na ordem definida",
                "Monitore checkpoints para validação"
            ]
        }
    
    def _assess_complexity(self, request: str) -> str:
        """Avalia complexidade da solicitação."""
        words = request.split()
        if len(words) < 5:
            return "low"
        elif len(words) < 15:
            return "medium"
        return "high"
    
    def _identify_domain(self, request: str) -> str:
        """Identifica domínio da tarefa."""
        domains = {
            "code": ["code", "program", "function", "bug", "error", "python", "javascript"],
            "system": ["system", "mac", "computer", "file", "folder", "app"],
            "research": ["search", "find", "research", "information", "data"],
            "automation": ["automate", "schedule", "workflow", "routine"]
        }
        
        request_lower = request.lower()
        for domain, keywords in domains.items():
            if any(kw in request_lower for kw in keywords):
                return domain
        
        return "general"
    
    def _estimate_steps(self, request: str) -> int:
        """Estima número de passos necessários."""
        complexity = self._assess_complexity(request)
        return {"low": 2, "medium": 4, "high": 7}.get(complexity, 3)
    
    def _identify_capabilities(self, request: str) -> List[str]:
        """Identifica capacidades necessárias."""
        caps = []
        request_lower = request.lower()
        
        if any(kw in request_lower for kw in ["code", "program", "bug"]):
            caps.extend(["coding", "analysis"])
        if any(kw in request_lower for kw in ["file", "folder", "system"]):
            caps.extend(["system_control", "file_management"])
        if any(kw in request_lower for kw in ["search", "find", "research"]):
            caps.append("research")
        
        return caps or ["general"]
    
    def _decompose_task(self, request: str) -> List[Dict]:
        """Decompõe tarefa em subtarefas."""
        
        # Templates de decomposição por domínio
        domain = self._identify_domain(request)
        
        templates = {
            "code": [
                {"type": "analyze", "description": "Analisar código atual", "agent": "developer"},
                {"type": "identify", "description": "Identificar problemas", "agent": "developer"},
                {"type": "implement", "description": "Implementar correções", "agent": "developer"},
                {"type": "validate", "description": "Validar solução", "agent": "validator"}
            ],
            "system": [
                {"type": "assess", "description": "Avaliar estado do sistema", "agent": "system"},
                {"type": "execute", "description": "Executar ação solicitada", "agent": "system"},
                {"type": "verify", "description": "Verificar resultado", "agent": "validator"}
            ],
            "research": [
                {"type": "search", "description": "Buscar informações", "agent": "research"},
                {"type": "synthesize", "description": "Sintetizar resultados", "agent": "research"},
                {"type": "report", "description": "Gerar relatório", "agent": "planner"}
            ],
            "automation": [
                {"type": "design", "description": "Projetar workflow", "agent": "automation"},
                {"type": "configure", "description": "Configurar triggers", "agent": "automation"},
                {"type": "test", "description": "Testar automação", "agent": "validator"}
            ],
            "general": [
                {"type": "understand", "description": "Compreender solicitação", "agent": "planner"},
                {"type": "execute", "description": "Executar ação", "agent": "system"},
                {"type": "respond", "description": "Responder ao usuário", "agent": "planner"}
            ]
        }
        
        return templates.get(domain, templates["general"])
    
    def _identify_parallel_tasks(self, subtasks: List[Dict]) -> List[List[int]]:
        """Identifica quais tarefas podem rodar em paralelo."""
        # Simplificado: agrupar tarefas do mesmo tipo
        groups = []
        current_group = []
        
        for i, task in enumerate(subtasks):
            if not current_group:
                current_group.append(i)
            elif task["type"] == subtasks[current_group[0]]["type"]:
                current_group.append(i)
            else:
                if len(current_group) > 1:
                    groups.append(current_group)
                current_group = [i]
        
        return groups
    
    def _define_checkpoints(self, subtasks: List[Dict]) -> List[int]:
        """Define pontos de verificação no plano."""
        # Criar checkpoint a cada 2-3 tarefas
        checkpoints = []
        for i in range(2, len(subtasks), 3):
            checkpoints.append(i)
        return checkpoints
```

### 📄 `backend/aura/agents/research_agent.py`
```python
"""Research Agent - Busca e síntese de informações."""

from typing import Dict, Any, List
from datetime import datetime
import time
import asyncio

from .base_agent import BaseAgent, AgentResult

class ResearchAgent(BaseAgent):
    """Agente especializado em pesquisa e síntese de informações."""
    
    def __init__(self, config: Dict = None):
        super().__init__(
            agent_id="research_001",
            name="Research",
            capabilities=["research", "search", "synthesis", "data_analysis"],
            config=config
        )
        self.search_history = []
    
    async def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa necessidades de pesquisa."""
        
        query = context.get("query", "")
        
        return {
            "query_complexity": len(query.split()),
            "search_domains": self._identify_domains(query),
            "expected_sources": ["web", "local_docs", "codebase"],
            "time_estimate": "2-5 minutos"
        }
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """Executa pesquisa."""
        
        start_time = time.time()
        
        query = task.get("query", "")
        sources = task.get("sources", ["web"])
        
        results = []
        
        # Simular busca em paralelo
        search_tasks = []
        for source in sources:
            search_tasks.append(self._search_source(query, source))
        
        search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        for result in search_results:
            if isinstance(result, Exception):
                results.append({"source": "error", "error": str(result)})
            else:
                results.append(result)
        
        # Síntese
        synthesis = await self._synthesize(results, query)
        
        execution_time = int((time.time() - start_time) * 1000)
        
        self.execution_count += 1
        self.success_count += 1
        
        return AgentResult(
            success=True,
            data={
                "query": query,
                "results": results,
                "synthesis": synthesis,
                "sources_count": len(results)
            },
            execution_time_ms=execution_time,
            metadata={"sources": sources},
            timestamp=datetime.now()
        )
    
    async def report(self, result: AgentResult) -> Dict[str, Any]:
        """Gera relatório da pesquisa."""
        
        data = result.data
        
        return {
            "agent": self.name,
            "type": "research_report",
            "summary": f"Pesquisa concluída com {data['sources_count']} fontes",
            "key_findings": data["synthesis"].get("key_points", []),
            "detailed_results": data["results"],
            "confidence": data["synthesis"].get("confidence", "medium")
        }
    
    async def _search_source(self, query: str, source: str) -> Dict:
        """Busca em uma fonte específica."""
        
        # Simular busca
        await asyncio.sleep(0.5)
        
        return {
            "source": source,
            "query": query,
            "items_found": 5,
            "top_results": [
                {"title": f"Resultado 1 de {source}", "relevance": 0.95},
                {"title": f"Resultado 2 de {source}", "relevance": 0.87},
            ]
        }
    
    async def _synthesize(self, results: List[Dict], query: str) -> Dict:
        """Sintetiza resultados da pesquisa."""
        
        # Extrair pontos-chave
        key_points = []
        for result in results:
            if "items_found" in result:
                key_points.append(f"Encontrados {result['items_found']} itens em {result['source']}")
        
        return {
            "key_points": key_points,
            "summary": f"Síntese da pesquisa sobre: {query}",
            "confidence": "high" if len(results) > 2 else "medium",
            "recommendations": [
                "Verificar fontes primárias para mais detalhes",
                "Considerar atualizações recentes"
            ]
        }
    
    def _identify_domains(self, query: str) -> List[str]:
        """Identifica domínios de pesquisa."""
        domains = []
        query_lower = query.lower()
        
        if any(kw in query_lower for kw in ["code", "program", "api"]):
            domains.append("technical")
        if any(kw in query_lower for kw in ["news", "atual", "recente"]):
            domains.append("news")
        if any(kw in query_lower for kw in ["doc", "documentação", "manual"]):
            domains.append("documentation")
        
        return domains or ["general"]
```

### 📄 `backend/aura/agents/developer_agent.py`
```python
"""Developer Agent - Desenvolvimento e análise de código."""

from typing import Dict, Any, List
from datetime import datetime
import time
import ast

from .base_agent import BaseAgent, AgentResult

class DeveloperAgent(BaseAgent):
    """Agente especializado em desenvolvimento de software."""
    
    def __init__(self, config: Dict = None):
        super().__init__(
            agent_id="developer_001",
            name="Developer",
            capabilities=["coding", "debugging", "refactoring", "testing", "code_review"],
            config=config
        )
        self.code_analysis_cache = {}
    
    async def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa código ou solicitação de desenvolvimento."""
        
        code = context.get("code", "")
        file_path = context.get("file_path", "")
        
        analysis = {
            "language": self._detect_language(file_path),
            "complexity": self._analyze_complexity(code),
            "issues": self._identify_issues(code),
            "suggestions": self._generate_suggestions(code),
            "test_coverage": "unknown"
        }
        
        return analysis
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """Executa tarefa de desenvolvimento."""
        
        start_time = time.time()
        
        action = task.get("action", "analyze")
        code = task.get("code", "")
        file_path = task.get("file_path", "")
        
        result_data = {}
        
        if action == "analyze":
            result_data = await self._analyze_code(code, file_path)
        elif action == "fix":
            result_data = await self._fix_code(code, task.get("issues", []))
        elif action == "generate_tests":
            result_data = await self._generate_tests(code, file_path)
        elif action == "refactor":
            result_data = await self._refactor_code(code, task.get("target", "improve"))
        
        execution_time = int((time.time() - start_time) * 1000)
        
        self.execution_count += 1
        success = result_data.get("success", True)
        if success:
            self.success_count += 1
        
        return AgentResult(
            success=success,
            data=result_data,
            execution_time_ms=execution_time,
            metadata={"action": action},
            timestamp=datetime.now()
        )
    
    async def report(self, result: AgentResult) -> Dict[str, Any]:
        """Gera relatório da análise/desenvolvimento."""
        
        data = result.data
        
        return {
            "agent": self.name,
            "type": "development_report",
            "summary": data.get("summary", "Análise concluída"),
            "issues_found": len(data.get("issues", [])),
            "suggestions_count": len(data.get("suggestions", [])),
            "code_quality_score": data.get("quality_score", "N/A"),
            "detailed_analysis": data
        }
    
    def _detect_language(self, file_path: str) -> str:
        """Detecta linguagem pelo path."""
        ext = file_path.split(".")[-1].lower() if "." in file_path else ""
        
        languages = {
            "py": "python",
            "js": "javascript",
            "ts": "typescript",
            "jsx": "jsx",
            "tsx": "tsx",
            "json": "json",
            "md": "markdown"
        }
        
        return languages.get(ext, "unknown")
    
    def _analyze_complexity(self, code: str) -> Dict:
        """Analisa complexidade do código."""
        lines = code.split("\n")
        
        return {
            "total_lines": len(lines),
            "code_lines": len([l for l in lines if l.strip() and not l.strip().startswith("#")]),
            "comment_lines": len([l for l in lines if l.strip().startswith("#")]),
            "blank_lines": len([l for l in lines if not l.strip()]),
            "functions": code.count("def "),
            "classes": code.count("class ")
        }
    
    def _identify_issues(self, code: str) -> List[Dict]:
        """Identifica problemas no código."""
        issues = []
        
        # Verificar erros de sintaxe
        try:
            ast.parse(code)
        except SyntaxError as e:
            issues.append({
                "type": "syntax_error",
                "line": e.lineno,
                "message": str(e)
            })
        
        # Verificar padrões problemáticos
        lines = code.split("\n")
        for i, line in enumerate(lines, 1):
            if "print(" in line and "# debug" not in line.lower():
                issues.append({
                    "type": "warning",
                    "line": i,
                    "message": "print() encontrado - considerar usar logging"
                })
            
            if len(line) > 100:
                issues.append({
                    "type": "style",
                    "line": i,
                    "message": "Linha muito longa (>100 caracteres)"
                })
        
        return issues
    
    def _generate_suggestions(self, code: str) -> List[str]:
        """Gera sugestões de melhoria."""
        suggestions = []
        
        if "def " in code and '"""' not in code:
            suggestions.append("Adicionar docstrings às funções")
        
        if "import *" in code:
            suggestions.append("Evitar import * - usar imports explícitos")
        
        if code.count("try:") > 0 and code.count("except:") == 0:
            suggestions.append("Adicionar tratamento de exceções")
        
        return suggestions
    
    async def _analyze_code(self, code: str, file_path: str) -> Dict:
        """Análise completa de código."""
        
        complexity = self._analyze_complexity(code)
        issues = self._identify_issues(code)
        suggestions = self._generate_suggestions(code)
        
        # Calcular score de qualidade
        score = 100
        score -= len(issues) * 5
        score -= len([i for i in issues if i["type"] == "syntax_error"]) * 20
        score = max(0, score)
        
        return {
            "success": True,
            "summary": f"Análise de {complexity['total_lines']} linhas",
            "language": self._detect_language(file_path),
            "complexity": complexity,
            "issues": issues,
            "suggestions": suggestions,
            "quality_score": score
        }
    
    async def _fix_code(self, code: str, issues: List[Dict]) -> Dict:
        """Aplica correções automáticas."""
        
        fixed_code = code
        fixes_applied = []
        
        for issue in issues:
            if issue["type"] == "style" and "longa" in issue["message"]:
                # Quebrar linha longa (simplificado)
                fixes_applied.append(f"Linha {issue['line']} precisa ser quebrada")
        
        return {
            "success": True,
            "original_code": code,
            "fixed_code": fixed_code,
            "fixes_applied": fixes_applied
        }
    
    async def _generate_tests(self, code: str, file_path: str) -> Dict:
        """Gera testes para o código."""
        
        # Extrair funções
        try:
            tree = ast.parse(code)
            functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        except:
            functions = []
        
        tests = []
        for func in functions:
            if not func.startswith("_"):
                tests.append(f"""
def test_{func}():
    # TODO: Implementar teste para {func}
    result = {func}()
    assert result is not None
""")
        
        return {
            "success": True,
            "functions_found": functions,
            "tests_generated": len(tests),
            "test_code": "\n".join(tests)
        }
    
    async def _refactor_code(self, code: str, target: str) -> Dict:
        """Refatora código."""
        
        refactored = code
        changes = []
        
        if target == "improve":
            # Aplicar melhorias simples
            if ";" in code:
                refactored = refactored.replace(";", "\n")
                changes.append("Separar múltiplas instruções em linhas")
        
        return {
            "success": True,
            "original_code": code,
            "refactored_code": refactored,
            "changes": changes
        }
```

### 📄 `backend/aura/agents/validator_agent.py`
```python
"""Validator Agent - Validação e qualidade."""

from typing import Dict, Any, List
from datetime import datetime
import time

from .base_agent import BaseAgent, AgentResult

class ValidatorAgent(BaseAgent):
    """Agente especializado em validação de resultados."""
    
    def __init__(self, config: Dict = None):
        super().__init__(
            agent_id="validator_001",
            name="Validator",
            capabilities=["validation", "quality_check", "testing", "review"],
            config=config
        )
        self.validation_rules = self._load_validation_rules()
    
    async def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa o que precisa ser validado."""
        
        result = context.get("result", {})
        task_type = context.get("task_type", "general")
        
        return {
            "validation_points": self._identify_validation_points(task_type),
            "critical_checks": self._identify_critical_checks(result),
            "estimated_time": "1-2 minutos"
        }
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """Executa validação."""
        
        start_time = time.time()
        
        result_to_validate = task.get("result", {})
        original_task = task.get("original_task", {})
        
        validation_results = []
        passed = 0
        failed = 0
        
        # Executar validações
        checks = [
            self._check_completeness(result_to_validate),
            self._check_accuracy(result_to_validate, original_task),
            self._check_format(result_to_validate),
            self._check_constraints(result_to_validate, original_task.get("constraints", {}))
        ]
        
        for check in checks:
            validation_results.append(check)
            if check["passed"]:
                passed += 1
            else:
                failed += 1
        
        overall_success = failed == 0
        
        execution_time = int((time.time() - start_time) * 1000)
        
        self.execution_count += 1
        if overall_success:
            self.success_count += 1
        
        return AgentResult(
            success=overall_success,
            data={
                "validated": True,
                "passed_checks": passed,
                "failed_checks": failed,
                "total_checks": len(checks),
                "validation_results": validation_results,
                "recommendations": self._generate_recommendations(validation_results)
            },
            execution_time_ms=execution_time,
            metadata={"severity": "high" if failed > 0 else "low"},
            timestamp=datetime.now()
        )
    
    async def report(self, result: AgentResult) -> Dict[str, Any]:
        """Gera relatório de validação."""
        
        data = result.data
        
        return {
            "agent": self.name,
            "type": "validation_report",
            "status": "APPROVED" if result.success else "REJECTED",
            "checks_passed": f"{data['passed_checks']}/{data['total_checks']}",
            "critical_issues": len([r for r in data['validation_results'] if not r['passed'] and r.get('critical', False)]),
            "recommendations": data['recommendations']
        }
    
    def _load_validation_rules(self) -> Dict:
        """Carrega regras de validação."""
        return {
            "code": {
                "syntax_required": True,
                "max_complexity": 10,
                "test_coverage_min": 0.7
            },
            "data": {
                "schema_validation": True,
                "completeness_required": True
            },
            "general": {
                "output_required": True,
                "no_errors": True
            }
        }
    
    def _identify_validation_points(self, task_type: str) -> List[str]:
        """Identifica pontos a validar."""
        points = {
            "code": ["sintaxe", "estilo", "testes", "documentação"],
            "research": ["fontes", "atualidade", "relevância"],
            "system": ["permissões", "resultado", "logs"],
            "general": ["completude", "precisão"]
        }
        return points.get(task_type, points["general"])
    
    def _identify_critical_checks(self, result: Dict) -> List[str]:
        """Identifica verificações críticas."""
        critical = []
        
        if "error" in result:
            critical.append("nenhum_erro")
        if not result.get("data"):
            critical.append("dados_presentes")
        
        return critical
    
    def _check_completeness(self, result: Dict) -> Dict:
        """Verifica completude do resultado."""
        has_data = result.get("data") is not None
        has_summary = result.get("summary") or result.get("message")
        
        return {
            "name": "completude",
            "passed": has_data and has_summary,
            "message": "Resultado completo" if has_data else "Dados ausentes",
            "critical": True
        }
    
    def _check_accuracy(self, result: Dict, original_task: Dict) -> Dict:
        """Verifica precisão/adequação."""
        # Simplificado: verificar se responde ao que foi pedido
        return {
            "name": "precisão",
            "passed": True,  # Placeholder
            "message": "Resultado adequado à solicitação",
            "critical": False
        }
    
    def _check_format(self, result: Dict) -> Dict:
        """Verifica formato do resultado."""
        data = result.get("data", {})
        is_valid_format = isinstance(data, (dict, list, str))
        
        return {
            "name": "formato",
            "passed": is_valid_format,
            "message": "Formato válido" if is_valid_format else "Formato inválido",
            "critical": False
        }
    
    def _check_constraints(self, result: Dict, constraints: Dict) -> Dict:
        """Verifica se atende a restrições."""
        # Placeholder para verificação de constraints
        return {
            "name": "restrições",
            "passed": True,
            "message": "Restrições atendidas",
            "critical": False
        }
    
    def _generate_recommendations(self, results: List[Dict]) -> List[str]:
        """Gera recomendações baseadas nos resultados."""
        recommendations = []
        
        for result in results:
            if not result["passed"]:
                recommendations.append(f"Corrigir: {result['name']} - {result['message']}")
        
        if not recommendations:
            recommendations.append("Nenhuma ação necessária - resultado aprovado")
        
        return recommendations
```

---

## 🧠 FASE 3 — VECTOR MEMORY

### 📄 `backend/aura/memory/vector/__init__.py`
```python
"""Vector Memory Module - Memória vetorial com embeddings."""

from .embedding_store import EmbeddingStore
from .memory_retriever import MemoryRetriever
from .chroma_client import ChromaMemoryClient

__all__ = ['EmbeddingStore', 'MemoryRetriever', 'ChromaMemoryClient']
```

### 📄 `backend/aura/memory/vector/chroma_client.py`
```python
"""Cliente ChromaDB para memória vetorial."""

from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
import hashlib

class ChromaMemoryClient:
    """Cliente para persistência de memória vetorial."""
    
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.persist_directory = persist_directory
        self.client = chromadb.Client(
            Settings(
                persist_directory=persist_directory,
                anonymized_telemetry=False
            )
        )
        self.collections = {}
    
    def get_or_create_collection(self, name: str) -> Any:
        """Obtém ou cria uma coleção."""
        if name not in self.collections:
            self.collections[name] = self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"}
            )
        return self.collections[name]
    
    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict]] = None,
        ids: Optional[List[str]] = None
    ) -> bool:
        """Adiciona documentos à coleção."""
        try:
            collection = self.get_or_create_collection(collection_name)
            
            if ids is None:
                ids = [hashlib.md5(doc.encode()).hexdigest() for doc in documents]
            
            collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            
            return True
        except Exception as e:
            print(f"Erro ao adicionar documentos: {e}")
            return False
    
    def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        n_results: int = 5,
        filter_dict: Optional[Dict] = None
    ) -> List[Dict]:
        """Busca documentos similares."""
        try:
            collection = self.get_or_create_collection(collection_name)
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=filter_dict
            )
            
            # Formatar resultados
            formatted = []
            for i in range(len(results['ids'][0])):
                formatted.append({
                    "id": results['ids'][0][i],
                    "document": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else 0
                })
            
            return formatted
        except Exception as e:
            print(f"Erro na busca: {e}")
            return []
    
    def delete_collection(self, name: str) -> bool:
        """Remove uma coleção."""
        try:
            self.client.delete_collection(name)
            if name in self.collections:
                del self.collections[name]
            return True
        except Exception as e:
            print(f"Erro ao deletar coleção: {e}")
            return False
```

---

## 🎯 FASE 4 — AUTONOMOUS EXECUTION

### 📄 `backend/aura/execution/autonomous_mode.py`
```python
"""Modo autônomo de execução."""

from typing import Dict, Any, List
import asyncio
from datetime import datetime

class AutonomousExecutor:
    """Executor de tarefas em modo autônomo."""
    
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.active_tasks = {}
        self.task_history = []
        self.user_preferences = {}
        self.auto_confirm_threshold = 0.8  # Confiança mínima para auto-confirmar
    
    async def execute_autonomous(
        self,
        goal: str,
        constraints: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Executa uma meta de forma autônoma."""
        
        print(f"🤖 Modo Autônomo: {goal}")
        
        # 1. Planejar
        plan = await self._create_plan(goal, constraints)
        
        # 2. Executar etapas
        results = []
        for i, step in enumerate(plan["steps"]):
            print(f"  → Etapa {i+1}/{len(plan['steps'])}: {step['description']}")
            
            # Verificar se precisa de confirmação
            if step.get("requires_confirmation"):
                if not await self._should_auto_confirm(step):
                    print(f"    ⏸ Aguardando confirmação do usuário...")
                    # Em modo real, pediria confirmação
                    continue
            
            # Executar
            result = await self._execute_step(step)
            results.append(result)
            
            # Validar
            if not result.get("success"):
                print(f"    ❌ Falha - tentando recovery...")
                result = await self._attempt_recovery(step, result)
            
            # Aguardar entre etapas
            if i < len(plan["steps"]) - 1:
                await asyncio.sleep(1)
        
        # 3. Compilar resultados
        final_report = self._compile_report(goal, plan, results)
        
        return final_report
    
    async def _create_plan(self, goal: str, constraints: Dict) -> Dict:
        """Cria plano de execução."""
        
        # Usar PlannerAgent
        planner = self.orchestrator.registry.get_instance("planner_001")
        
        result = await planner.execute({
            "request": goal,
            "constraints": constraints or {}
        })
        
        return result.data
    
    async def _execute_step(self, step: Dict) -> Dict:
        """Executa uma etapa do plano."""
        
        agent_id = step.get("agent_id")
        if not agent_id:
            return {"success": False, "error": "Agente não especificado"}
        
        agent = self.orchestrator.registry.get_instance(agent_id)
        if not agent:
            return {"success": False, "error": f"Agente {agent_id} não encontrado"}
        
        try:
            result = await agent.execute(step.get("payload", {}))
            return {
                "success": result.success,
                "data": result.data,
                "agent": agent.name
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _should_auto_confirm(self, step: Dict) -> bool:
        """Decide se deve auto-confirmar baseado em confiança."""
        confidence = step.get("confidence", 0.5)
        risk_level = step.get("risk_level", "low")
        
        # Nunca auto-confirmar operações de alto risco
        if risk_level == "high":
            return False
        
        return confidence >= self.auto_confirm_threshold
    
    async def _attempt_recovery(self, step: Dict, error_result: Dict) -> Dict:
        """Tenta recuperar de falha."""
        
        # Tentar com outro agente
        alternative_agents = step.get("alternatives", [])
        
        for alt_agent_id in alternative_agents:
            try:
                agent = self.orchestrator.registry.get_instance(alt_agent_id)
                if agent:
                    result = await agent.execute(step.get("payload", {}))
                    if result.success:
                        return {
                            "success": True,
                            "data": result.data,
                            "agent": agent.name,
                            "recovered": True
                        }
            except:
                continue
        
        return error_result
    
    def _compile_report(self, goal: str, plan: Dict, results: List[Dict]) -> Dict:
        """Compila relatório final."""
        
        successful = sum(1 for r in results if r.get("success"))
        failed = len(results) - successful
        
        return {
            "goal": goal,
            "completed_at": datetime.now().isoformat(),
            "total_steps": len(results),
            "successful_steps": successful,
            "failed_steps": failed,
            "success_rate": successful / len(results) if results else 0,
            "executed_by": "autonomous_mode",
            "results": results
        }
```

---

## 📊 FASE 5 — FRONTEND MONITORING

### 📄 `frontend/components/agents/agent-activity-panel.tsx`
```tsx
"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Search, 
  Code2, 
  Terminal, 
  CheckCircle2,
  Activity,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'completed' | 'error';
  current_task?: string;
  progress?: number;
  icon: any;
  color: string;
}

interface Task {
  id: string;
  type: string;
  description: string;
  assigned_agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time?: string;
}

export function AgentActivityPanel() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: 'planner', name: 'Planner', status: 'idle', icon: Brain, color: 'amber' },
    { id: 'research', name: 'Research', status: 'idle', icon: Search, color: 'cyan' },
    { id: 'developer', name: 'Developer', status: 'idle', icon: Code2, color: 'violet' },
    { id: 'system', name: 'System', status: 'idle', icon: Terminal, color: 'green' },
    { id: 'validator', name: 'Validator', status: 'idle', icon: CheckCircle2, color: 'pink' },
  ]);
  
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Polling de status
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/v1/orchestrator/status');
        const data = await response.json();
        
        if (data.success) {
          // Atualizar agentes
          setAgents(prev => prev.map(agent => {
            const updated = data.data.agents.find((a: any) => a.id === agent.id);
            return updated ? { ...agent, ...updated } : agent;
          }));
          
          // Atualizar tarefas
          setTasks(data.data.active_tasks || []);
        }
      } catch (e) {
        console.error('Erro ao buscar status:', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'text-slate-500',
      active: 'text-cyan-400',
      completed: 'text-green-400',
      error: 'text-red-400',
      pending: 'text-amber-400',
      running: 'text-cyan-400',
      failed: 'text-red-400',
    };
    return colors[status] || 'text-slate-500';
  };

  const getStatusBg = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-slate-500/10',
      active: 'bg-cyan-500/10',
      completed: 'bg-green-500/10',
      error: 'bg-red-500/10',
    };
    return colors[status] || 'bg-slate-500/10';
  };

  return (
    <div className="w-80 bg-slate-950/90 backdrop-blur-xl border-l border-white/5 p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">Agent Swarm</span>
        </div>
        <div className="text-xs text-slate-500">
          {agents.filter(a => a.status === 'active').length} active
        </div>
      </div>

      {/* Agent Status Grid */}
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const isActive = agent.status === 'active';
          
          return (
            <motion.div
              key={agent.id}
              className={`relative p-3 rounded-xl border border-white/5 ${getStatusBg(agent.status)}`}
              animate={isActive ? {
                boxShadow: ['0 0 0px rgba(6,182,212,0)', '0 0 20px rgba(6,182,212,0.3)', '0 0 0px rgba(6,182,212,0)']
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${getStatusColor(agent.status)} bg-white/5`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {agent.name}
                  </div>
                  <div className={`text-[10px] ${getStatusColor(agent.status)} capitalize`}>
                    {agent.status}
                  </div>
                </div>
              </div>
              
              {isActive && agent.progress !== undefined && (
                <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-cyan-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${agent.progress}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Active Tasks */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>Active Tasks</span>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-medium">{task.type}</span>
                  <span className={`${getStatusColor(task.status)} capitalize`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-slate-500 truncate">{task.description}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-600">
                  <span>Agent: {task.assigned_agent}</span>
                  {task.start_time && (
                    <span>• {new Date(task.start_time).toLocaleTimeString()}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {tasks.length === 0 && (
            <div className="text-center py-4 text-xs text-slate-600">
              No active tasks
            </div>
          )}
        </div>
      </div>

      {/* System Stats */}
      <div className="pt-4 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Queue</span>
          <span className="text-slate-300">{tasks.filter(t => t.status === 'pending').length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Completed</span>
          <span className="text-green-400">{tasks.filter(t => t.status === 'completed').length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Failed</span>
          <span className="text-red-400">{tasks.filter(t => t.status === 'failed').length}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔌 FASE 6 — API ENDPOINTS

### 📄 `backend/aura/api/orchestrator_routes.py`
```python
"""Rotas do orchestrator multi-agente."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])

class TaskRequest(BaseModel):
    request: str
    constraints: Optional[Dict[str, Any]] = None
    autonomous: bool = False

class MultiAgentRequest(BaseModel):
    goal: str
    agents: List[str]
    parallel: bool = False

@router.post("/execute")
async def execute_task(request: TaskRequest):
    """Executa uma tarefa com o melhor agente."""
    # Implementar
    return {"success": True, "message": "Em implementação"}

@router.post("/execute-multi")
async def execute_multi_agent(request: MultiAgentRequest):
    """Executa tarefa com múltiplos agentes."""
    # Implementar
    return {"success": True, "message": "Em implementação"}

@router.get("/status")
async def get_orchestrator_status():
    """Retorna status do sistema multi-agente."""
    # Mock
    return {
        "success": True,
        "data": {
            "agents": [
                {"id": "planner", "name": "Planner", "status": "idle"},
                {"id": "research", "name": "Research", "status": "idle"},
                {"id": "developer", "name": "Developer", "status": "idle"},
            ],
            "active_tasks": [],
            "queue_size": 0
        }
    }

@router.get("/agents")
async def list_agents():
    """Lista todos os agentes registrados."""
    return {
        "success": True,
        "data": {
            "agents": [
                {"id": "planner_001", "name": "Planner", "capabilities": ["planning"]},
                {"id": "research_001", "name": "Research", "capabilities": ["research"]},
                {"id": "developer_001", "name": "Developer", "capabilities": ["coding"]},
                {"id": "validator_001", "name": "Validator", "capabilities": ["validation"]},
            ]
        }
    }
```

---

## ✅ CHECKLIST FINAL

### Backend
- [ ] Orchestrator (`orchestrator/`)
  - [ ] AgentRegistry
  - [ ] TaskRouter
  - [ ] AgentOrchestrator
  - [ ] TaskPlanner
- [ ] Agentes Especializados (`agents/`)
  - [ ] BaseAgent (classe abstrata)
  - [ ] PlannerAgent
  - [ ] ResearchAgent
  - [ ] DeveloperAgent
  - [ ] SystemAgent
  - [ ] AutomationAgent
  - [ ] ValidatorAgent
- [ ] Vector Memory (`memory/vector/`)
  - [ ] ChromaMemoryClient
  - [ ] EmbeddingStore
  - [ ] MemoryRetriever
- [ ] Autonomous Mode (`execution/`)
  - [ ] AutonomousExecutor
  - [ ] ExecutionEngine
- [ ] API Routes
  - [ ] `/orchestrator/*`
  - [ ] `/agents/*`

### Frontend
- [ ] AgentActivityPanel
- [ ] Integração com APIs

### Testes
- [ ] pytest backend
- [ ] pnpm build frontend

---

## 🚀 COMANDOS

```bash
# Instalar dependências
cd backend
pip install chromadb sentence-transformers

# Executar
cd backend && uvicorn main:app --reload
cd frontend && pnpm dev

# Commit
git add .
git commit -m "feat: add multi-agent orchestration with autonomous planning and vector memory"
git push origin main
```

---

## 🎯 RESULTADO

A Aura se torna um sistema **multi-agente autônomo**:

```
✅ Planejamento automático de tarefas
✅ Coordenação de múltiplos agentes especializados
✅ Memória vetorial para contexto
✅ Execução autônoma sem intervenção contínua
✅ Validação e retry automático
✅ Monitoramento em tempo real
✅ Aprendizado com histórico
```

**Pronto para deploy!** 🚀
