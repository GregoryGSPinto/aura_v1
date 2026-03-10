from datetime import datetime, timezone
from uuid import uuid4


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_log_id() -> str:
    return f"log_{uuid4().hex[:10]}"

