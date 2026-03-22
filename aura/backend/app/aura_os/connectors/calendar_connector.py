"""
Google Calendar Connector — Agenda do Gregory.
"""

import logging
from datetime import datetime, timedelta, timezone
import httpx

logger = logging.getLogger("aura")


class GoogleCalendarConnector:
    name = "google_calendar"

    def __init__(self, api_key: str = "", calendar_id: str = "primary"):
        self.api_key = api_key
        self.calendar_id = calendar_id
        self.base_url = "https://www.googleapis.com/calendar/v3"

    async def is_configured(self) -> bool:
        return bool(self.api_key)

    async def test_connection(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/calendars/{self.calendar_id}/events",
                    params={"key": self.api_key, "maxResults": 1},
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def get_today_events(self) -> list:
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        return await self._fetch_events(start, end)

    async def get_week_events(self) -> list:
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=7)
        return await self._fetch_events(start, end)

    async def get_next_event(self) -> dict:
        now = datetime.now(timezone.utc)
        events = await self._fetch_events(now, now + timedelta(days=1), max_results=1)
        return events[0] if events else {}

    async def _fetch_events(self, time_min: datetime, time_max: datetime, max_results: int = 20) -> list:
        if not self.api_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/calendars/{self.calendar_id}/events",
                    params={
                        "key": self.api_key,
                        "timeMin": time_min.isoformat(),
                        "timeMax": time_max.isoformat(),
                        "maxResults": max_results,
                        "singleEvents": "true",
                        "orderBy": "startTime",
                    },
                )
                if resp.status_code == 200:
                    items = resp.json().get("items", [])
                    return [
                        {
                            "summary": e.get("summary", "Sem título"),
                            "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
                            "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
                            "location": e.get("location", ""),
                            "status": e.get("status", ""),
                        }
                        for e in items
                    ]
        except Exception as exc:
            logger.error("[Calendar] Failed: %s", exc)
        return []

    async def sync(self) -> dict:
        today = await self.get_today_events()
        next_event = await self.get_next_event()
        return {
            "connector": self.name,
            "success": True,
            "data": {"today": today, "next": next_event},
            "summary": f"{len(today)} eventos hoje",
        }
