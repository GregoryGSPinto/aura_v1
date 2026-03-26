"""
AURA Tool Base — Standardized result types, status enums, and risk levels.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


class ToolStatus(Enum):
    INITIATED = "initiated"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CORRECTED = "corrected"
    BLOCKED = "blocked"
    NEEDS_APPROVAL = "needs_approval"


class RiskLevel(Enum):
    FREE = "free"
    NOTICE = "notice"
    CONFIRM = "confirm"
    CRITICAL = "critical"


@dataclass
class ToolResult:
    tool_name: str
    status: ToolStatus
    started_at: float
    finished_at: Optional[float] = None
    output: Any = None
    error: Optional[str] = None
    correction: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.FREE
    metadata: Optional[Dict[str, Any]] = field(default_factory=dict)

    @property
    def duration_ms(self) -> Optional[int]:
        if self.finished_at is not None:
            return round((self.finished_at - self.started_at) * 1000)
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool": self.tool_name,
            "status": self.status.value,
            "duration_ms": self.duration_ms,
            "output": self.output,
            "error": self.error,
            "correction": self.correction,
            "risk_level": self.risk_level.value,
            "metadata": self.metadata,
        }

    @staticmethod
    def quick(
        tool_name: str,
        output: Any,
        risk: RiskLevel = RiskLevel.FREE,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ToolResult:
        """Create a successful ToolResult in one call."""
        now = time.time()
        return ToolResult(
            tool_name=tool_name,
            status=ToolStatus.SUCCESS,
            started_at=now,
            finished_at=now,
            output=output,
            risk_level=risk,
            metadata=metadata or {},
        )

    @staticmethod
    def fail(
        tool_name: str,
        error: str,
        risk: RiskLevel = RiskLevel.FREE,
    ) -> ToolResult:
        """Create a failed ToolResult in one call."""
        now = time.time()
        return ToolResult(
            tool_name=tool_name,
            status=ToolStatus.FAILED,
            started_at=now,
            finished_at=now,
            error=error,
            risk_level=risk,
        )

    @staticmethod
    def blocked(tool_name: str, reason: str) -> ToolResult:
        """Create a blocked ToolResult."""
        now = time.time()
        return ToolResult(
            tool_name=tool_name,
            status=ToolStatus.BLOCKED,
            started_at=now,
            finished_at=now,
            error=reason,
            risk_level=RiskLevel.CRITICAL,
        )
