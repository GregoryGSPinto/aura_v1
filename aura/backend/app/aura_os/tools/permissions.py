from typing import Dict, List


class ToolPermissionPolicy:
    def overview(self) -> Dict[str, List[str]]:
        return {
            "safe_actions": [
                "list_projects",
                "open_project",
                "open_vscode",
                "git_status",
                "show_logs",
                "system_info",
                "cpu_status",
                "memory_status",
                "disk_status",
                "run_project_lint",
                "run_project_build",
                "run_project_test",
                "run_project_dev",
            ],
            "blocked_actions": [
                "rm",
                "rm -rf",
                "sudo rm",
                "mkfs",
                "dd",
                "shutdown",
                "reboot",
                "killall",
            ],
        }
