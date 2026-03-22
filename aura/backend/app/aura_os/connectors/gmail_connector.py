"""
Gmail Connector via IMAP.
"""

import asyncio
import imaplib
import email
import logging
from email.header import decode_header
from typing import Optional

logger = logging.getLogger("aura")


class GmailConnector:
    name = "gmail"

    def __init__(self, address: str = "", app_password: str = ""):
        self.address = address
        self.app_password = app_password
        self.imap_server = "imap.gmail.com"

    async def is_configured(self) -> bool:
        return bool(self.address and self.app_password)

    async def test_connection(self) -> bool:
        if not await self.is_configured():
            return False
        try:
            return await asyncio.to_thread(self._test_imap)
        except Exception:
            return False

    def _test_imap(self) -> bool:
        try:
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.address, self.app_password)
            mail.logout()
            return True
        except Exception:
            return False

    async def get_unread_count(self) -> int:
        if not await self.is_configured():
            return 0
        try:
            return await asyncio.to_thread(self._imap_unread_count)
        except Exception as exc:
            logger.error("[Gmail] Failed unread count: %s", exc)
            return 0

    def _imap_unread_count(self) -> int:
        mail = imaplib.IMAP4_SSL(self.imap_server)
        mail.login(self.address, self.app_password)
        mail.select("INBOX")
        _, data = mail.search(None, "UNSEEN")
        count = len(data[0].split()) if data[0] else 0
        mail.logout()
        return count

    async def get_recent_emails(self, limit: int = 10) -> list:
        if not await self.is_configured():
            return []
        try:
            return await asyncio.to_thread(self._imap_recent, limit)
        except Exception as exc:
            logger.error("[Gmail] Failed recent emails: %s", exc)
            return []

    def _imap_recent(self, limit: int) -> list:
        mail = imaplib.IMAP4_SSL(self.imap_server)
        mail.login(self.address, self.app_password)
        mail.select("INBOX")
        _, data = mail.search(None, "ALL")
        ids = data[0].split()
        results = []
        for num in reversed(ids[-limit:]):
            _, msg_data = mail.fetch(num, "(RFC822)")
            if msg_data and msg_data[0]:
                msg = email.message_from_bytes(msg_data[0][1])
                subject = self._decode_header(msg.get("Subject", ""))
                from_addr = self._decode_header(msg.get("From", ""))
                date = msg.get("Date", "")
                results.append({"subject": subject, "from": from_addr, "date": date})
        mail.logout()
        return results

    def _decode_header(self, value: str) -> str:
        try:
            decoded = decode_header(value)
            parts = []
            for part, charset in decoded:
                if isinstance(part, bytes):
                    parts.append(part.decode(charset or "utf-8", errors="replace"))
                else:
                    parts.append(str(part))
            return " ".join(parts)
        except Exception:
            return str(value)

    async def sync(self) -> dict:
        unread = await self.get_unread_count()
        recent = await self.get_recent_emails(5)
        return {
            "connector": self.name,
            "success": True,
            "data": {"unread_count": unread, "recent": recent},
            "summary": f"{unread} emails não lidos",
        }
