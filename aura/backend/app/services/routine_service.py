import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from croniter import croniter

from app.core.config import Settings
from app.core.exceptions import AuraError
from app.models.routine_models import (
    Routine,
    RoutineAction,
    RoutineCreateRequest,
    RoutineExecution,
    RoutineUpdateRequest,
)
from app.services.memory_service import MemoryService
from app.utils.helpers import iso_now


class RoutineService:
    """Service for managing routines and their execution."""

    def __init__(self, settings: Settings, memory_service: MemoryService):
        self.settings = settings
        self.memory_service = memory_service
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None
        self._ensure_builtin_routines()

    def start(self) -> None:
        """Start the routine scheduler worker thread."""
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._run_scheduler_loop, daemon=True, name="aura-routine-scheduler"
        )
        self._worker_thread.start()

    def stop(self) -> None:
        """Stop the routine scheduler worker thread."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2)

    def create_routine(self, request: RoutineCreateRequest) -> Routine:
        """Create a new routine."""
        now = iso_now()
        routine_id = f"routine_{int(time.time() * 1000)}"
        
        # Calculate next run time if scheduled
        next_run = None
        if request.trigger_type == "scheduled" and request.schedule:
            next_run = self._calculate_next_run(request.schedule)

        routine = Routine(
            id=routine_id,
            name=request.name,
            description=request.description,
            trigger_type=request.trigger_type,
            schedule=request.schedule,
            actions=request.actions,
            status="active",
            is_builtin=False,
            last_run=None,
            next_run=next_run,
            run_count=0,
            created_at=now,
            updated_at=now,
        )

        with self._lock:
            routines = self.memory_service.get_routines()
            routines.append(routine.model_dump())
            self.memory_service.save_routines(routines)

        return routine

    def get_routine(self, routine_id: str) -> Routine:
        """Get a routine by ID."""
        routines = self.memory_service.get_routines()
        for item in routines:
            if item.get("id") == routine_id:
                return Routine(**item)
        raise AuraError(
            "routine_not_found", f"Routine '{routine_id}' not found.", status_code=404
        )

    def list_routines(
        self, status: Optional[str] = None, trigger_type: Optional[str] = None
    ) -> List[Routine]:
        """List all routines with optional filtering."""
        routines = self.memory_service.get_routines()
        result = []
        for item in routines:
            routine = Routine(**item)
            if status and routine.status != status:
                continue
            if trigger_type and routine.trigger_type != trigger_type:
                continue
            result.append(routine)
        return sorted(result, key=lambda r: r.created_at, reverse=True)

    def update_routine(self, routine_id: str, request: RoutineUpdateRequest) -> Routine:
        """Update an existing routine."""
        with self._lock:
            routine = self.get_routine(routine_id)
            
            # Prevent modification of built-in routines' core properties
            if routine.is_builtin:
                if request.name is not None or request.actions is not None:
                    raise AuraError(
                        "builtin_routine_protected",
                        "Cannot modify name or actions of built-in routines.",
                        status_code=403,
                    )

            updates = request.model_dump(exclude_unset=True)
            for key, value in updates.items():
                setattr(routine, key, value)

            # Recalculate next run if schedule changed
            if "schedule" in updates and routine.trigger_type == "scheduled":
                routine.next_run = self._calculate_next_run(routine.schedule) if routine.schedule else None

            routine.updated_at = iso_now()

            routines = self.memory_service.get_routines()
            for i, item in enumerate(routines):
                if item.get("id") == routine_id:
                    routines[i] = routine.model_dump()
                    break
            self.memory_service.save_routines(routines)

        return routine

    def delete_routine(self, routine_id: str) -> bool:
        """Delete a routine."""
        with self._lock:
            routine = self.get_routine(routine_id)
            if routine.is_builtin:
                raise AuraError(
                    "builtin_routine_protected",
                    "Cannot delete built-in routines.",
                    status_code=403,
                )

            routines = self.memory_service.get_routines()
            routines = [r for r in routines if r.get("id") != routine_id]
            self.memory_service.save_routines(routines)
            return True

    def toggle_routine(self, routine_id: str) -> Routine:
        """Toggle routine between active and paused."""
        with self._lock:
            routine = self.get_routine(routine_id)
            new_status = "paused" if routine.status == "active" else "active"
            
            # Recalculate next run when activating a scheduled routine
            next_run = routine.next_run
            if new_status == "active" and routine.trigger_type == "scheduled" and routine.schedule:
                next_run = self._calculate_next_run(routine.schedule)
            elif new_status == "paused":
                next_run = None

            routine.status = new_status  # type: ignore[assignment]
            routine.next_run = next_run
            routine.updated_at = iso_now()

            routines = self.memory_service.get_routines()
            for i, item in enumerate(routines):
                if item.get("id") == routine_id:
                    routines[i] = routine.model_dump()
                    break
            self.memory_service.save_routines(routines)

        return routine

    def trigger_routine(
        self, routine_id: str, triggered_by: str = "manual"
    ) -> RoutineExecution:
        """Manually trigger a routine execution."""
        routine = self.get_routine(routine_id)
        
        if routine.status != "active":
            raise AuraError(
                "routine_inactive",
                f"Routine '{routine.name}' is {routine.status} and cannot be triggered.",
                status_code=409,
            )

        return self._execute_routine(routine, triggered_by)

    def trigger_app_open_routines(self) -> List[RoutineExecution]:
        """Trigger all app_open routines."""
        routines = self.list_routines(status="active", trigger_type="app_open")
        executions = []
        for routine in routines:
            try:
                execution = self._execute_routine(routine, "app_open")
                executions.append(execution)
            except Exception as exc:
                # Log but don't fail other routines
                execution = self._create_failed_execution(routine.id, routine.name, str(exc), "app_open")
                executions.append(execution)
        return executions

    def get_execution_history(
        self, routine_id: Optional[str] = None, limit: int = 50
    ) -> List[RoutineExecution]:
        """Get execution history, optionally filtered by routine."""
        executions = self.memory_service.get_routine_executions()
        if routine_id:
            executions = [e for e in executions if e.get("routine_id") == routine_id]
        executions = sorted(executions, key=lambda e: e.get("started_at", ""), reverse=True)
        return [RoutineExecution(**e) for e in executions[:limit]]

    def get_execution(self, execution_id: str) -> RoutineExecution:
        """Get a specific execution by ID."""
        executions = self.memory_service.get_routine_executions()
        for item in executions:
            if item.get("id") == execution_id:
                return RoutineExecution(**item)
        raise AuraError(
            "execution_not_found",
            f"Execution '{execution_id}' not found.",
            status_code=404,
        )

    def _run_scheduler_loop(self) -> None:
        """Main scheduler loop that checks for due routines."""
        while not self._stop_event.is_set():
            try:
                self._check_and_run_due_routines()
            except Exception as exc:
                # Log error but continue running
                print(f"Scheduler error: {exc}")
            
            # Check every minute
            for _ in range(60):
                if self._stop_event.is_set():
                    break
                time.sleep(1)

    def _check_and_run_due_routines(self) -> None:
        """Check for due scheduled routines and execute them."""
        now = datetime.now()
        routines = self.list_routines(status="active", trigger_type="scheduled")
        
        for routine in routines:
            if not routine.schedule:
                continue
                
            try:
                # Check if routine is due
                if routine.next_run:
                    next_run = datetime.fromisoformat(routine.next_run.replace("Z", "+00:00"))
                    if now >= next_run.replace(tzinfo=None):
                        self._execute_routine(routine, "scheduler")
            except Exception as exc:
                print(f"Failed to execute scheduled routine {routine.id}: {exc}")

    def _execute_routine(
        self, routine: Routine, triggered_by: str
    ) -> RoutineExecution:
        """Execute a routine and return the execution record."""
        execution_id = f"exec_{int(time.time() * 1000)}_{routine.id[:8]}"
        started_at = iso_now()
        start_time = time.time()

        # Create running execution record
        execution = RoutineExecution(
            id=execution_id,
            routine_id=routine.id,
            routine_name=routine.name,
            status="running",
            started_at=started_at,
            triggered_by=triggered_by,
        )
        self._save_execution(execution)

        # Update routine last_run
        routine.last_run = started_at
        routine.run_count += 1
        
        # Calculate next run for scheduled routines
        if routine.trigger_type == "scheduled" and routine.schedule:
            routine.next_run = self._calculate_next_run(routine.schedule)

        routine.updated_at = iso_now()
        self._update_routine_in_storage(routine)

        # Execute actions
        results = []
        try:
            for action in sorted(routine.actions, key=lambda a: a.order):
                result = self._execute_action(action)
                results.append(result)
                if result.get("error"):
                    raise Exception(result.get("error"))

            execution_time = int((time.time() - start_time) * 1000)
            execution.status = "success"
            execution.completed_at = iso_now()
            execution.results = results
            execution.execution_time_ms = execution_time

        except Exception as exc:
            execution.status = "failed"
            execution.completed_at = iso_now()
            execution.error_message = str(exc)
            execution.results = results
            execution.execution_time_ms = int((time.time() - start_time) * 1000)

        self._save_execution(execution)
        return execution

    def _execute_action(self, action: RoutineAction) -> Dict[str, Any]:
        """Execute a single action."""
        try:
            action_type = action.type
            params = action.params

            if action_type == "notify":
                return {
                    "action": action_type,
                    "success": True,
                    "message": params.get("message", "Notification"),
                }
            elif action_type == "command":
                return {
                    "action": action_type,
                    "success": True,
                    "command": params.get("command"),
                    "message": f"Command '{params.get('command')}' would be executed",
                }
            elif action_type == "open_project":
                return {
                    "action": action_type,
                    "success": True,
                    "project": params.get("project_name"),
                    "message": f"Project '{params.get('project_name')}' would be opened",
                }
            elif action_type == "git_status":
                return {
                    "action": action_type,
                    "success": True,
                    "project": params.get("project_name"),
                    "message": "Git status check",
                }
            elif action_type == "show_logs":
                return {
                    "action": action_type,
                    "success": True,
                    "service": params.get("service", "app"),
                    "message": f"Show logs for {params.get('service', 'app')}",
                }
            elif action_type == "system_info":
                return {
                    "action": action_type,
                    "success": True,
                    "message": "System information gathered",
                }
            elif action_type == "daily_summary":
                return {
                    "action": action_type,
                    "success": True,
                    "message": "Daily summary generated",
                }
            elif action_type == "pending_review":
                return {
                    "action": action_type,
                    "success": True,
                    "message": "Pending reviews checked",
                }
            else:
                return {
                    "action": action_type,
                    "success": True,
                    "message": f"Action {action_type} executed",
                }

        except Exception as exc:
            return {
                "action": action.type,
                "success": False,
                "error": str(exc),
            }

    def _create_failed_execution(
        self, routine_id: str, routine_name: str, error: str, triggered_by: str
    ) -> RoutineExecution:
        """Create a failed execution record."""
        execution = RoutineExecution(
            id=f"exec_{int(time.time() * 1000)}_{routine_id[:8]}",
            routine_id=routine_id,
            routine_name=routine_name,
            status="failed",
            started_at=iso_now(),
            completed_at=iso_now(),
            error_message=error,
            triggered_by=triggered_by,
        )
        self._save_execution(execution)
        return execution

    def _save_execution(self, execution: RoutineExecution) -> None:
        """Save execution to storage."""
        executions = self.memory_service.get_routine_executions()
        
        # Update existing or append new
        for i, item in enumerate(executions):
            if item.get("id") == execution.id:
                executions[i] = execution.model_dump()
                self.memory_service.save_routine_executions(executions)
                return
        
        executions.append(execution.model_dump())
        self.memory_service.save_routine_executions(executions)

    def _update_routine_in_storage(self, routine: Routine) -> None:
        """Update routine in storage."""
        routines = self.memory_service.get_routines()
        for i, item in enumerate(routines):
            if item.get("id") == routine.id:
                routines[i] = routine.model_dump()
                self.memory_service.save_routines(routines)
                return

    def _calculate_next_run(self, cron_expression: Optional[str]) -> Optional[str]:
        """Calculate next run time from cron expression."""
        if not cron_expression:
            return None
        try:
            itr = croniter(cron_expression, datetime.now())
            next_time = itr.get_next(datetime)
            return next_time.isoformat()
        except Exception:
            return None

    def _ensure_builtin_routines(self) -> None:
        """Ensure built-in routines exist."""
        routines = self.memory_service.get_routines()
        existing_builtin = {r.get("builtin_type") for r in routines if r.get("is_builtin")}

        now = iso_now()
        builtin_routines = [
            {
                "id": "builtin_morning_routine",
                "name": "Rotina da Manhã",
                "description": "Resumo diário, clima, prioridades e status do sistema",
                "trigger_type": "app_open",
                "schedule": None,
                "actions": [
                    {"id": "mr_1", "type": "daily_summary", "params": {}, "order": 0},
                    {"id": "mr_2", "type": "system_info", "params": {}, "order": 1},
                    {"id": "mr_3", "type": "notify", "params": {"message": "Bom dia! Resumo da manhã pronto."}, "order": 2},
                ],
                "status": "active",
                "is_builtin": True,
                "builtin_type": "morning_routine",
                "last_run": None,
                "next_run": None,
                "run_count": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "builtin_daily_summary",
                "name": "Resumo Diário",
                "description": "Gera um resumo do dia: projetos ativos, tarefas pendentes e alertas",
                "trigger_type": "manual",
                "schedule": "0 9 * * *",  # Every day at 9 AM
                "actions": [
                    {"id": "ds_1", "type": "daily_summary", "params": {}, "order": 0},
                    {"id": "ds_2", "type": "notify", "params": {"message": "Resumo diário gerado."}, "order": 1},
                ],
                "status": "active",
                "is_builtin": True,
                "builtin_type": "daily_summary",
                "last_run": None,
                "next_run": self._calculate_next_run("0 9 * * *"),
                "run_count": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "builtin_pending_review",
                "name": "Revisão Pendentes",
                "description": "Verifica projetos com mudanças pendentes de commit e PRs abertos",
                "trigger_type": "manual",
                "schedule": "0 18 * * 1-5",  # Weekdays at 6 PM
                "actions": [
                    {"id": "pr_1", "type": "pending_review", "params": {}, "order": 0},
                    {"id": "pr_2", "type": "notify", "params": {"message": "Verificação de pendentes concluída."}, "order": 1},
                ],
                "status": "active",
                "is_builtin": True,
                "builtin_type": "pending_review",
                "last_run": None,
                "next_run": self._calculate_next_run("0 18 * * 1-5"),
                "run_count": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "builtin_project_resume",
                "name": "Retomar Projeto",
                "description": "Abre o último projeto trabalhado e mostra o que estava sendo feito",
                "trigger_type": "app_open",
                "schedule": None,
                "actions": [
                    {"id": "prj_1", "type": "system_info", "params": {}, "order": 0},
                    {"id": "prj_2", "type": "notify", "params": {"message": "Pronto para continuar onde parou."}, "order": 1},
                ],
                "status": "paused",  # Paused by default
                "is_builtin": True,
                "builtin_type": "project_resume",
                "last_run": None,
                "next_run": None,
                "run_count": 0,
                "created_at": now,
                "updated_at": now,
            },
        ]

        for builtin in builtin_routines:
            if builtin["builtin_type"] not in existing_builtin:
                routines.append(builtin)

        self.memory_service.save_routines(routines)
