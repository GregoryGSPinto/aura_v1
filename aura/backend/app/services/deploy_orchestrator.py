"""
Sprint 6 — Deploy Orchestrator.

Orchestrates the full flow: repo -> deploy -> URL.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("aura")


class DeployOrchestrator:
    """Orchestrates full deploy flow: GitHub repo -> Vercel deploy -> validate."""

    def __init__(self, github_service, vercel_service, sqlite_memory=None):
        self.github = github_service
        self.vercel = vercel_service
        self.memory = sqlite_memory

    async def full_deploy_flow(self, project_name: str, local_dir: str, description: str = "") -> Dict[str, Any]:
        steps: List[Dict[str, Any]] = []
        repo_url = ""
        final_url = ""

        # 1. Create GitHub repo
        try:
            repo_result = await self.github.create_repo(project_name, description=description)
            if "error" in repo_result and "already exists" not in str(repo_result.get("error", "")).lower():
                steps.append({"step": "create_repo", "status": "failed", "detail": str(repo_result.get("error"))})
            else:
                repo_url = repo_result.get("html_url", f"https://github.com/{self.github.username}/{project_name}")
                steps.append({"step": "create_repo", "status": "success", "detail": repo_url})
        except Exception as exc:
            steps.append({"step": "create_repo", "status": "failed", "detail": str(exc)})

        # 2. Setup remote
        try:
            remote = await self.github.setup_remote(local_dir, project_name)
            steps.append({"step": "setup_remote", "status": remote.get("status", "unknown"), "detail": remote.get("remote_url", "")})
        except Exception as exc:
            steps.append({"step": "setup_remote", "status": "failed", "detail": str(exc)})

        # 3. Git push
        try:
            proc = await asyncio.create_subprocess_exec(
                "git", "add", "-A", cwd=local_dir,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            proc = await asyncio.create_subprocess_exec(
                "git", "commit", "-m", f"deploy: {description or project_name}", "--allow-empty",
                cwd=local_dir, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            proc = await asyncio.create_subprocess_exec(
                "git", "push", "-u", "origin", "main", cwd=local_dir,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            out, err = await proc.communicate()
            steps.append({"step": "git_push", "status": "success" if proc.returncode == 0 else "failed", "detail": err.decode()[:500]})
        except Exception as exc:
            steps.append({"step": "git_push", "status": "failed", "detail": str(exc)})

        # 4. Create Vercel project
        try:
            vercel_result = await self.vercel.create_project(project_name, repo=project_name)
            if "error" in vercel_result and "already" not in str(vercel_result.get("error", "")).lower():
                steps.append({"step": "create_vercel_project", "status": "failed", "detail": str(vercel_result.get("error"))})
            else:
                steps.append({"step": "create_vercel_project", "status": "success"})
        except Exception as exc:
            steps.append({"step": "create_vercel_project", "status": "failed", "detail": str(exc)})

        # 5. Wait for deploy
        try:
            deploy = await self.vercel.get_latest_deployment(project_name)
            if deploy.get("id"):
                wait_result = await self.vercel.wait_for_deploy(deploy["id"], timeout=300)
                final_url = wait_result.get("url", "")
                steps.append({"step": "deploy", "status": wait_result.get("status", "unknown"), "url": final_url})
            else:
                steps.append({"step": "deploy", "status": "pending", "detail": "No deployment found yet"})
        except Exception as exc:
            steps.append({"step": "deploy", "status": "failed", "detail": str(exc)})

        # 6. Validate
        if final_url:
            try:
                validation = await self.vercel.validate_deployment(final_url)
                steps.append({"step": "validate", "status": "success" if validation.get("online") else "failed",
                              "response_time_ms": validation.get("response_time_ms")})
            except Exception as exc:
                steps.append({"step": "validate", "status": "failed", "detail": str(exc)})

        # 7. Save to memory
        if self.memory and final_url:
            try:
                self.memory.update_project(project_name, deploy_url=final_url, repo_url=repo_url)
            except Exception:
                pass

        return {
            "steps": steps,
            "final_url": final_url,
            "repo_url": repo_url,
            "summary": f"Deploy de {project_name} {'concluido' if final_url else 'parcial'}.",
        }

    async def redeploy(self, project_name: str) -> Dict[str, Any]:
        steps: List[Dict[str, Any]] = []
        try:
            deploy = await self.vercel.trigger_deploy(project_name)
            deploy_id = deploy.get("id") or deploy.get("uid", "")
            if deploy_id:
                result = await self.vercel.wait_for_deploy(deploy_id)
                url = result.get("url", "")
                steps.append({"step": "deploy", "status": result.get("status", "unknown"), "url": url})
                if url:
                    validation = await self.vercel.validate_deployment(url)
                    steps.append({"step": "validate", "status": "success" if validation.get("online") else "failed"})
            else:
                steps.append({"step": "deploy", "status": "failed", "detail": str(deploy)})
        except Exception as exc:
            steps.append({"step": "redeploy", "status": "failed", "detail": str(exc)})
        return {"steps": steps}

    async def check_project_deploy_status(self, project_name: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {"project": project_name}
        try:
            deploy = await self.vercel.get_latest_deployment(project_name)
            result["latest_deploy"] = deploy
        except Exception as exc:
            result["latest_deploy"] = {"error": str(exc)}
        try:
            repo = await self.github.get_repo_status(project_name)
            result["repo"] = repo
        except Exception as exc:
            result["repo"] = {"error": str(exc)}
        return result
