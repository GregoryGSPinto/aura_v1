"""
GitHub Connector — Acesso aos repos do Gregory.
"""

import logging
from typing import Optional
import httpx

logger = logging.getLogger("aura")


class GitHubConnector:
    name = "github"

    def __init__(self, token: str = "", username: str = ""):
        self.token = token
        self.username = username
        self.base_url = "https://api.github.com"
        self._headers = {}
        if token:
            self._headers["Authorization"] = f"Bearer {token}"
        self._headers["Accept"] = "application/vnd.github.v3+json"

    async def is_configured(self) -> bool:
        return bool(self.token)

    async def test_connection(self) -> bool:
        if not self.token:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/user", headers=self._headers)
                return resp.status_code == 200
        except Exception:
            return False

    async def get_repos(self, limit: int = 10) -> list:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/user/repos",
                    headers=self._headers,
                    params={"sort": "updated", "per_page": limit, "type": "owner"},
                )
                if resp.status_code == 200:
                    return [
                        {"name": r["name"], "full_name": r["full_name"], "description": r.get("description", ""),
                         "url": r["html_url"], "language": r.get("language"), "updated_at": r["updated_at"],
                         "open_issues": r["open_issues_count"], "private": r["private"]}
                        for r in resp.json()
                    ]
        except Exception as exc:
            logger.error("[GitHub] Failed to list repos: %s", exc)
        return []

    async def get_issues(self, repo: str, state: str = "open", limit: int = 10) -> list:
        owner = self.username
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/issues",
                    headers=self._headers,
                    params={"state": state, "per_page": limit},
                )
                if resp.status_code == 200:
                    return [
                        {"number": i["number"], "title": i["title"], "state": i["state"],
                         "labels": [l["name"] for l in i.get("labels", [])],
                         "created_at": i["created_at"], "url": i["html_url"]}
                        for i in resp.json() if "pull_request" not in i
                    ]
        except Exception as exc:
            logger.error("[GitHub] Failed to list issues: %s", exc)
        return []

    async def get_pull_requests(self, repo: str, state: str = "open", limit: int = 10) -> list:
        owner = self.username
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls",
                    headers=self._headers,
                    params={"state": state, "per_page": limit},
                )
                if resp.status_code == 200:
                    return [
                        {"number": p["number"], "title": p["title"], "state": p["state"],
                         "draft": p.get("draft", False), "created_at": p["created_at"],
                         "url": p["html_url"], "user": p["user"]["login"]}
                        for p in resp.json()
                    ]
        except Exception as exc:
            logger.error("[GitHub] Failed to list PRs: %s", exc)
        return []

    async def get_notifications(self, limit: int = 10) -> list:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/notifications", headers=self._headers, params={"per_page": limit})
                if resp.status_code == 200:
                    return [
                        {"id": n["id"], "reason": n["reason"], "subject": n["subject"]["title"],
                         "type": n["subject"]["type"], "repo": n["repository"]["full_name"],
                         "updated_at": n["updated_at"], "unread": n["unread"]}
                        for n in resp.json()
                    ]
        except Exception as exc:
            logger.error("[GitHub] Failed to list notifications: %s", exc)
        return []

    async def sync(self) -> dict:
        repos = await self.get_repos(5)
        notifications = await self.get_notifications(10)
        all_issues = []
        for repo in repos[:3]:
            issues = await self.get_issues(repo["name"], limit=5)
            all_issues.extend(issues)
        return {
            "connector": self.name,
            "success": True,
            "data": {"repos": repos, "notifications": notifications, "open_issues": all_issues},
            "summary": f"{len(repos)} repos, {len(notifications)} notificações, {len(all_issues)} issues abertas",
        }
