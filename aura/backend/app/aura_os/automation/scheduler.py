import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from croniter import croniter


class ScheduledTask:
    """Represents a scheduled task with a cron expression."""
    
    def __init__(self, task_id: str, name: str, cron_expression: str, callback: callable, enabled: bool = True):
        self.task_id = task_id
        self.name = name
        self.cron_expression = cron_expression
        self.callback = callback
        self.enabled = enabled
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.run_count = 0
        self._calculate_next_run()
    
    def _calculate_next_run(self) -> None:
        """Calculate the next run time based on the cron expression."""
        try:
            itr = croniter(self.cron_expression, datetime.now())
            self.next_run = itr.get_next(datetime)
        except Exception:
            self.next_run = None
    
    def should_run(self) -> bool:
        """Check if the task should run now."""
        if not self.enabled or not self.next_run:
            return False
        return datetime.now() >= self.next_run
    
    def execute(self) -> Dict[str, Any]:
        """Execute the task and update run times."""
        if not self.enabled:
            return {"success": False, "error": "Task is disabled"}
        
        self.last_run = datetime.now()
        self.run_count += 1
        
        try:
            result = self.callback()
            self._calculate_next_run()
            return {
                "success": True,
                "task_id": self.task_id,
                "result": result,
                "executed_at": self.last_run.isoformat(),
                "next_run": self.next_run.isoformat() if self.next_run else None,
            }
        except Exception as exc:
            self._calculate_next_run()
            return {
                "success": False,
                "task_id": self.task_id,
                "error": str(exc),
                "executed_at": self.last_run.isoformat(),
                "next_run": self.next_run.isoformat() if self.next_run else None,
            }


class WorkflowScheduler:
    """Advanced workflow scheduler with cron support and background execution."""
    
    def __init__(self, check_interval: int = 60):
        self.check_interval = check_interval  # Seconds between checks
        self._tasks: Dict[str, ScheduledTask] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None
        self._execution_history: List[Dict[str, Any]] = []
        self._max_history = 1000
    
    def start(self) -> None:
        """Start the scheduler background thread."""
        if self._worker_thread and self._worker_thread.is_alive():
            return
        
        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._run_loop, daemon=True, name="aura-workflow-scheduler"
        )
        self._worker_thread.start()
    
    def stop(self) -> None:
        """Stop the scheduler background thread."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5)
    
    def _run_loop(self) -> None:
        """Main scheduler loop."""
        while not self._stop_event.is_set():
            self._check_and_execute_tasks()
            
            # Sleep in short intervals to respond to stop signal quickly
            for _ in range(self.check_interval):
                if self._stop_event.is_set():
                    break
                time.sleep(1)
    
    def _check_and_execute_tasks(self) -> None:
        """Check all tasks and execute due ones."""
        with self._lock:
            tasks_to_run = [
                task for task in self._tasks.values()
                if task.should_run()
            ]
        
        for task in tasks_to_run:
            result = task.execute()
            self._add_to_history(result)
    
    def _add_to_history(self, result: Dict[str, Any]) -> None:
        """Add execution result to history."""
        with self._lock:
            self._execution_history.append({
                **result,
                "recorded_at": datetime.now().isoformat(),
            })
            # Trim history if too large
            if len(self._execution_history) > self._max_history:
                self._execution_history = self._execution_history[-self._max_history:]
    
    def add_task(self, task_id: str, name: str, cron_expression: str, callback: callable, enabled: bool = True) -> ScheduledTask:
        """Add a new scheduled task."""
        with self._lock:
            task = ScheduledTask(task_id, name, cron_expression, callback, enabled)
            self._tasks[task_id] = task
            return task
    
    def remove_task(self, task_id: str) -> bool:
        """Remove a scheduled task."""
        with self._lock:
            if task_id in self._tasks:
                del self._tasks[task_id]
                return True
            return False
    
    def enable_task(self, task_id: str) -> bool:
        """Enable a scheduled task."""
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].enabled = True
                self._tasks[task_id]._calculate_next_run()
                return True
            return False
    
    def disable_task(self, task_id: str) -> bool:
        """Disable a scheduled task."""
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].enabled = False
                self._tasks[task_id].next_run = None
                return True
            return False
    
    def get_task(self, task_id: str) -> Optional[ScheduledTask]:
        """Get a specific task by ID."""
        with self._lock:
            return self._tasks.get(task_id)
    
    def list_tasks(self) -> List[Dict[str, Any]]:
        """List all scheduled tasks."""
        with self._lock:
            return [
                {
                    "task_id": task.task_id,
                    "name": task.name,
                    "cron_expression": task.cron_expression,
                    "enabled": task.enabled,
                    "last_run": task.last_run.isoformat() if task.last_run else None,
                    "next_run": task.next_run.isoformat() if task.next_run else None,
                    "run_count": task.run_count,
                }
                for task in self._tasks.values()
            ]
    
    def get_execution_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent execution history."""
        with self._lock:
            return self._execution_history[-limit:]
    
    def execute_task_now(self, task_id: str) -> Dict[str, Any]:
        """Manually execute a task immediately."""
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return {"success": False, "error": f"Task '{task_id}' not found"}
        
        result = task.execute()
        self._add_to_history(result)
        return result
    
    def overview(self) -> Dict[str, object]:
        """Get scheduler overview."""
        return {
            "scheduler_ready": self._worker_thread is not None and self._worker_thread.is_alive(),
            "tasks": self.list_tasks(),
            "total_tasks": len(self._tasks),
            "enabled_tasks": sum(1 for t in self._tasks.values() if t.enabled),
            "recent_executions": self.get_execution_history(10),
            "check_interval_seconds": self.check_interval,
        }
