from typing import Dict, List


class WorkflowLibrary:
    def list_workflows(self) -> List[Dict[str, object]]:
        return [
            {
                "name": "daily_system_check",
                "trigger": "cron:0 9 * * *",
                "steps": ["system_info", "cpu_status", "memory_status", "disk_status"],
            },
            {
                "name": "developer_repo_review",
                "trigger": "manual",
                "steps": ["list_projects", "git_status", "show_logs"],
            },
        ]
