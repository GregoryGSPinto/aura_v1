"""
Push Notification Service — Envia notificações pro celular do Gregory.

Tipos de notificação:
- morning_briefing: resumo matinal
- health_alert: CPU/RAM/disco alto
- task_complete: Claude Code terminou uma task
- reminder: lembrete agendado
"""

import json
import logging
from pathlib import Path
from typing import Optional

from pywebpush import webpush, WebPushException

logger = logging.getLogger("aura")

SUBSCRIPTIONS_FILE = Path(__file__).parent.parent.parent / "data" / "json" / "push_subscriptions.json"


class PushService:
    def __init__(self, vapid_public_key: str, vapid_private_key: str, vapid_email: str):
        self.vapid_public_key = vapid_public_key
        self.vapid_private_key = vapid_private_key
        self.vapid_email = vapid_email
        self._subscriptions: list[dict] = []
        self._load()

    def _load(self):
        try:
            if SUBSCRIPTIONS_FILE.exists():
                self._subscriptions = json.loads(SUBSCRIPTIONS_FILE.read_text())
        except Exception as exc:
            logger.warning("[PushService] Failed to load subscriptions: %s", exc)
            self._subscriptions = []

    def _save(self):
        try:
            SUBSCRIPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
            SUBSCRIPTIONS_FILE.write_text(json.dumps(self._subscriptions, indent=2))
        except Exception as exc:
            logger.error("[PushService] Failed to save subscriptions: %s", exc)

    def subscribe(self, subscription_info: dict) -> bool:
        endpoint = subscription_info.get("endpoint", "")
        if any(s.get("endpoint") == endpoint for s in self._subscriptions):
            return False  # already subscribed
        self._subscriptions.append(subscription_info)
        self._save()
        logger.info("[PushService] New subscription added (%d total)", len(self._subscriptions))
        return True

    def unsubscribe(self, endpoint: str) -> bool:
        before = len(self._subscriptions)
        self._subscriptions = [s for s in self._subscriptions if s.get("endpoint") != endpoint]
        if len(self._subscriptions) < before:
            self._save()
            return True
        return False

    def send_notification(
        self,
        title: str,
        body: str,
        url: Optional[str] = "/chat",
        tag: Optional[str] = "aura-default",
        urgent: bool = False,
    ) -> int:
        """Send push notification to all subscriptions. Returns count of successful sends."""
        if not self.vapid_private_key:
            logger.warning("[PushService] No VAPID key configured, skipping push")
            return 0

        from app.aura_os.config.settings import AuraOSSettings
        settings = AuraOSSettings()
        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
            "urgent": urgent,
            "apiUrl": settings.api_url if hasattr(settings, "api_url") else "",
            "token": settings.auth_token,
        })
        sent = 0
        dead: list[str] = []

        for sub in self._subscriptions:
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims={"sub": self.vapid_email},
                )
                sent += 1
            except WebPushException as exc:
                if exc.response and exc.response.status_code in (404, 410):
                    dead.append(sub.get("endpoint", ""))
                    logger.info("[PushService] Removing dead subscription")
                else:
                    logger.warning("[PushService] Push failed: %s", exc)
            except Exception as exc:
                logger.warning("[PushService] Push error: %s", exc)

        # Cleanup dead subscriptions
        if dead:
            self._subscriptions = [s for s in self._subscriptions if s.get("endpoint") not in dead]
            self._save()

        return sent

    def send_to_all(self, title: str, body: str) -> int:
        return self.send_notification(title, body)

    @property
    def subscription_count(self) -> int:
        return len(self._subscriptions)
