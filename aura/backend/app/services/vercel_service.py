"""
Sprint 6 — Vercel Service.

Wraps Vercel REST API for project management, deployments, and env vars.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("aura")


class VercelService:
    BASE_URL = "https://api.vercel.com"

    def __init__(self, token: str = "", github_username: str = ""):
        self.token = token
        self.github_username = github_username
        self.available = bool(token)

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    async def _request(self, method: str, path: str, json_body: Optional[dict] = None) -> Dict[str, Any]:
        url = f"{self.BASE_URL}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=self._headers(), json=json_body)
            if resp.status_code >= 400:
                return {"error": resp.text, "status_code": resp.status_code}
            if resp.status_code == 204:
                return {"status": "success"}
            return resp.json()

    async def list_projects(self, limit: int = 20) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "Vercel not configured. Set VERCEL_TOKEN in .env"}]
        result = await self._request("GET", f"/v9/projects?limit={limit}")
        projects = result.get("projects", [])
        return [{"name": p.get("name"), "id": p.get("id"), "framework": p.get("framework"),
                  "url": f"https://{p.get('name')}.vercel.app"} for p in projects]

    async def get_project(self, name: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        return await self._request("GET", f"/v9/projects/{name}")

    async def create_project(self, name: str, repo: Optional[str] = None, framework: str = "nextjs") -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        body: Dict[str, Any] = {"name": name, "framework": framework}
        if repo and self.github_username:
            body["gitRepository"] = {"type": "github", "repo": f"{self.github_username}/{repo}"}
        return await self._request("POST", "/v10/projects", body)

    async def set_env_vars(self, project_name: str, env_vars: Dict[str, str], target: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        if target is None:
            target = ["production", "preview"]
        results = []
        for key, value in env_vars.items():
            r = await self._request("POST", f"/v10/projects/{project_name}/env", {"key": key, "value": value, "target": target, "type": "encrypted"})
            results.append({"key": key, "status": "error" if "error" in r else "set"})
        return {"vars_set": results}

    async def trigger_deploy(self, project_name: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        return await self._request("POST", "/v13/deployments", {"name": project_name, "target": "production"})

    async def get_latest_deployment(self, project_name: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        project = await self.get_project(project_name)
        if "error" in project:
            return project
        project_id = project.get("id", "")
        result = await self._request("GET", f"/v6/deployments?projectId={project_id}&limit=1")
        deployments = result.get("deployments", [])
        if not deployments:
            return {"error": "No deployments found"}
        d = deployments[0]
        return {
            "id": d.get("uid"),
            "url": f"https://{d.get('url', '')}",
            "state": d.get("state"),
            "created": d.get("created"),
            "ready": d.get("ready"),
        }

    async def get_deployment_status(self, deployment_id: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        return await self._request("GET", f"/v13/deployments/{deployment_id}")

    async def wait_for_deploy(self, deployment_id: str, timeout: int = 300) -> Dict[str, Any]:
        if not self.available:
            return {"error": "Vercel not configured"}
        start = time.time()
        while time.time() - start < timeout:
            status = await self.get_deployment_status(deployment_id)
            state = status.get("readyState", status.get("state", ""))
            if state == "READY":
                return {"status": "ready", "url": f"https://{status.get('url', '')}", "deployment": status}
            if state in ("ERROR", "CANCELED"):
                return {"status": "failed", "error": status.get("errorMessage", state)}
            await asyncio.sleep(10)
        return {"status": "timeout", "error": f"Deploy did not complete within {timeout}s"}

    async def validate_deployment(self, url: str) -> Dict[str, Any]:
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(url)
                elapsed = int((time.time() - start) * 1000)
                return {"online": resp.status_code < 400, "status_code": resp.status_code, "response_time_ms": elapsed, "url": url}
        except Exception as exc:
            return {"online": False, "error": str(exc), "url": url}
