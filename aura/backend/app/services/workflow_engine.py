"""
Workflow Engine — Custom automations with triggers and actions.

Trigger types: schedule, event, manual
Action types: command, notify, chat
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("aura")

WORKFLOWS_FILE = Path(__file__).parent.parent.parent / "data" / "json" / "workflows.json"
WORKFLOW_HISTORY_FILE = Path(__file__).parent.parent.parent / "data" / "json" / "workflow_history.json"


class WorkflowEngine:
    def __init__(self, push_service=None):
        self.push_service = push_service
        self._workflows: list[dict] = []
        self._history: list[dict] = []
        self._load()

    def _load(self):
        try:
            if WORKFLOWS_FILE.exists():
                self._workflows = json.loads(WORKFLOWS_FILE.read_text())
        except Exception:
            self._workflows = []
        try:
            if WORKFLOW_HISTORY_FILE.exists():
                self._history = json.loads(WORKFLOW_HISTORY_FILE.read_text())
        except Exception:
            self._history = []

    def _save(self):
        WORKFLOWS_FILE.parent.mkdir(parents=True, exist_ok=True)
        WORKFLOWS_FILE.write_text(json.dumps(self._workflows, indent=2, default=str))

    def _save_history(self):
        WORKFLOW_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        # Keep last 500 entries
        self._history = self._history[-500:]
        WORKFLOW_HISTORY_FILE.write_text(json.dumps(self._history, indent=2, default=str))

    def list_workflows(self) -> list[dict]:
        return self._workflows

    def get_workflow(self, workflow_id: str) -> Optional[dict]:
        return next((w for w in self._workflows if w["id"] == workflow_id), None)

    def create_workflow(self, name: str, description: str, trigger: dict, actions: list[dict]) -> dict:
        workflow = {
            "id": str(uuid.uuid4())[:8],
            "name": name,
            "description": description,
            "trigger": trigger,
            "actions": actions,
            "enabled": True,
            "created_at": datetime.now().isoformat(),
            "last_run": None,
            "run_count": 0,
        }
        self._workflows.append(workflow)
        self._save()
        return workflow

    def update_workflow(self, workflow_id: str, updates: dict) -> Optional[dict]:
        for w in self._workflows:
            if w["id"] == workflow_id:
                for k, v in updates.items():
                    if k != "id":
                        w[k] = v
                self._save()
                return w
        return None

    def delete_workflow(self, workflow_id: str) -> bool:
        before = len(self._workflows)
        self._workflows = [w for w in self._workflows if w["id"] != workflow_id]
        if len(self._workflows) < before:
            self._save()
            return True
        return False

    def enable_workflow(self, workflow_id: str) -> bool:
        return self.update_workflow(workflow_id, {"enabled": True}) is not None

    def disable_workflow(self, workflow_id: str) -> bool:
        return self.update_workflow(workflow_id, {"enabled": False}) is not None

    async def execute_workflow(self, workflow_id: str) -> dict:
        workflow = self.get_workflow(workflow_id)
        if not workflow:
            return {"success": False, "error": "Workflow not found"}

        results = []
        for action in workflow.get("actions", []):
            result = await self._execute_action(action)
            results.append(result)

        # Update run count
        workflow["last_run"] = datetime.now().isoformat()
        workflow["run_count"] = workflow.get("run_count", 0) + 1
        self._save()

        # Save history
        execution = {
            "workflow_id": workflow_id,
            "workflow_name": workflow["name"],
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "status": "completed",
        }
        self._history.append(execution)
        self._save_history()

        return {"success": True, "results": results}

    async def _execute_action(self, action: dict) -> dict:
        action_type = action.get("type", "")
        try:
            if action_type == "command":
                return await self._action_command(action)
            elif action_type == "notify":
                return self._action_notify(action)
            elif action_type == "chat":
                return {"type": "chat", "message": action.get("message", ""), "status": "queued"}
            else:
                return {"type": action_type, "status": "unknown_action_type"}
        except Exception as exc:
            return {"type": action_type, "status": "error", "error": str(exc)}

    async def _action_command(self, action: dict) -> dict:
        cmd = action.get("command", "")
        if not cmd:
            return {"type": "command", "status": "error", "error": "empty command"}
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode(errors="replace") + stderr.decode(errors="replace")
        return {
            "type": "command",
            "command": cmd,
            "exit_code": proc.returncode,
            "output": output[:2000],
            "status": "completed" if proc.returncode == 0 else "failed",
        }

    def _action_notify(self, action: dict) -> dict:
        title = action.get("title", "Aura Workflow")
        body = action.get("body", "")
        if self.push_service:
            self.push_service.send_notification(title=title, body=body, tag="workflow")
        return {"type": "notify", "title": title, "body": body, "status": "sent"}

    def check_schedule_triggers(self, now: datetime) -> list[str]:
        """Returns workflow IDs that should be triggered based on schedule."""
        triggered = []
        for w in self._workflows:
            if not w.get("enabled"):
                continue
            trigger = w.get("trigger", {})
            if trigger.get("type") != "schedule":
                continue

            if "interval_minutes" in trigger:
                interval = trigger["interval_minutes"]
                if now.minute % interval == 0:
                    triggered.append(w["id"])
            elif "cron" in trigger:
                # Simple cron: "minute hour * * *"
                parts = trigger["cron"].split()
                if len(parts) >= 2:
                    try:
                        cron_min, cron_hour = int(parts[0]), int(parts[1])
                        if now.hour == cron_hour and now.minute == cron_min:
                            triggered.append(w["id"])
                    except ValueError:
                        pass
        return triggered

    def get_event_workflows(self, event: str) -> list[dict]:
        """Get workflows triggered by a specific event."""
        return [
            w for w in self._workflows
            if w.get("enabled") and w.get("trigger", {}).get("type") == "event"
            and w.get("trigger", {}).get("event") == event
        ]

    def get_history(self, workflow_id: Optional[str] = None, limit: int = 20) -> list[dict]:
        entries = self._history
        if workflow_id:
            entries = [e for e in entries if e.get("workflow_id") == workflow_id]
        return entries[-limit:]
