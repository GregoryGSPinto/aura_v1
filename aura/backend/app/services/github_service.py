"""
Sprint 6 — GitHub Service.

Wraps GitHub REST API for repo management, branches, issues, PRs.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("aura")


class GitHubService:
    BASE_URL = "https://api.github.com"

    def __init__(self, token: str = "", username: str = ""):
        self.token = token
        self.username = username
        self.available = bool(token and username)

    def _headers(self) -> Dict[str, str]:
        h = {"Accept": "application/vnd.github+json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    async def _request(self, method: str, path: str, json_body: Optional[dict] = None) -> Dict[str, Any]:
        url = f"{self.BASE_URL}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=self._headers(), json=json_body)
            if resp.status_code >= 400:
                return {"error": resp.text, "status_code": resp.status_code}
            if resp.status_code == 204:
                return {"status": "success"}
            return resp.json()

    async def list_repos(self, limit: int = 20) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "GitHub not configured"}]
        result = await self._request("GET", f"/user/repos?sort=updated&per_page={limit}")
        if isinstance(result, list):
            return [{"name": r.get("name"), "full_name": r.get("full_name"), "private": r.get("private"),
                      "url": r.get("html_url"), "language": r.get("language"), "updated_at": r.get("updated_at")}
                     for r in result]
        return [result]

    async def get_repo(self, name: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        return await self._request("GET", f"/repos/{self.username}/{name}")

    async def create_repo(self, name: str, description: str = "", private: bool = True) -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        return await self._request("POST", "/user/repos", {"name": name, "description": description, "private": private, "auto_init": True})

    async def list_branches(self, repo: str) -> List[Dict[str, Any]]:
        if not self.available:
            return [{"error": "GitHub not configured"}]
        result = await self._request("GET", f"/repos/{self.username}/{repo}/branches")
        if isinstance(result, list):
            return [{"name": b.get("name"), "protected": b.get("protected", False)} for b in result]
        return [result]

    async def create_branch(self, repo: str, branch: str, from_branch: str = "main") -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        ref_data = await self._request("GET", f"/repos/{self.username}/{repo}/git/refs/heads/{from_branch}")
        if "error" in ref_data:
            return ref_data
        sha = ref_data.get("object", {}).get("sha", "")
        if not sha:
            return {"error": "Could not get SHA for base branch"}
        return await self._request("POST", f"/repos/{self.username}/{repo}/git/refs", {"ref": f"refs/heads/{branch}", "sha": sha})

    async def create_issue(self, repo: str, title: str, body: str = "", labels: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        payload: Dict[str, Any] = {"title": title, "body": body}
        if labels:
            payload["labels"] = labels
        return await self._request("POST", f"/repos/{self.username}/{repo}/issues", payload)

    async def create_pull_request(self, repo: str, title: str, head: str, base: str = "main", body: str = "") -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        return await self._request("POST", f"/repos/{self.username}/{repo}/pulls", {"title": title, "head": head, "base": base, "body": body})

    async def get_repo_status(self, repo: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        info = await self.get_repo(repo)
        if "error" in info:
            return info
        return {
            "name": info.get("name"),
            "full_name": info.get("full_name"),
            "default_branch": info.get("default_branch"),
            "language": info.get("language"),
            "private": info.get("private"),
            "open_issues_count": info.get("open_issues_count", 0),
            "url": info.get("html_url"),
            "updated_at": info.get("updated_at"),
        }

    async def setup_remote(self, local_dir: str, repo_name: str) -> Dict[str, Any]:
        if not self.available:
            return {"error": "GitHub not configured"}
        remote_url = f"https://github.com/{self.username}/{repo_name}.git"
        try:
            # Check existing remote
            proc = await asyncio.create_subprocess_exec(
                "git", "remote", "-v", cwd=local_dir,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            out, _ = await proc.communicate()
            output = out.decode()
            if "origin" in output:
                return {"status": "already_configured", "remote_url": remote_url}
            # Add remote
            proc = await asyncio.create_subprocess_exec(
                "git", "remote", "add", "origin", remote_url, cwd=local_dir,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            _, err = await proc.communicate()
            if proc.returncode != 0:
                return {"error": err.decode(), "status": "failed"}
            return {"status": "configured", "remote_url": remote_url}
        except Exception as exc:
            return {"error": str(exc), "status": "failed"}
