"""Local Calendar Connector - JSON-based calendar storage.

Provides simple calendar event management with local JSON persistence.
Ideal for offline-first operation and privacy-conscious users.
"""

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.connector_models import (
    AuthType,
    ConfigSchemaProperty,
    ConnectorCredentials,
    ConnectorPermission,
    ConnectorStatus,
    ConnectorTestResult,
    ConnectorType,
    SyncStatus,
)
from app.aura_os.connectors.base import BaseConnector, ConnectorContext, SyncResult


class CalendarConnector(BaseConnector):
    """Local JSON-based calendar connector.
    
    Features:
    - Store and retrieve calendar events
    - Simple reminder support
    - Recurring event patterns
    - Export to iCal format
    """
    
    # Connector metadata (class attributes for registry)
    definition_id = "local_calendar"
    name = "Local Calendar"
    connector_type = ConnectorType.CALENDAR
    description = "Local JSON-based calendar with event management and reminders"
    version = "1.0.0"
    auth_type = AuthType.NONE
    scopes: List[str] = []
    icon = "calendar"
    features = [
        "create_events",
        "read_events",
        "update_events",
        "delete_events",
        "recurring_events",
        "reminders",
        "ical_export",
    ]
    config_schema = {
        "calendar_name": ConfigSchemaProperty(
            type="string",
            title="Calendar Name",
            description="Name of the calendar",
            default="My Calendar",
        ),
        "default_reminder_minutes": ConfigSchemaProperty(
            type="number",
            title="Default Reminder",
            description="Default reminder time in minutes before events",
            default=15,
        ),
        "storage_path": ConfigSchemaProperty(
            type="string",
            title="Storage Path",
            description="Custom path for calendar data (optional)",
            default="",
        ),
    }
    
    def __init__(self, context: ConnectorContext):
        super().__init__(context)
        self._events: List[Dict[str, Any]] = []
        self._storage_path = self._get_storage_path()
    
    def _get_storage_path(self) -> Path:
        """Determine the storage path for calendar data."""
        custom_path = self.context.settings.get("storage_path", "")
        if custom_path:
            return Path(custom_path).expanduser()
        return Path(self.context.data_dir) / "calendars" / f"{self.context.instance_id}.json"
    
    def _load_events(self) -> None:
        """Load events from storage."""
        if self._storage_path.exists():
            try:
                data = json.loads(self._storage_path.read_text(encoding="utf-8"))
                self._events = data.get("events", [])
            except (json.JSONDecodeError, IOError):
                self._events = []
        else:
            self._events = []
    
    def _save_events(self) -> None:
        """Save events to storage."""
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "calendar_name": self.context.settings.get("calendar_name", "My Calendar"),
            "updated_at": datetime.utcnow().isoformat(),
            "events": self._events,
        }
        self._storage_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
    
    async def connect(self, credentials: Optional[ConnectorCredentials] = None) -> bool:
        """Initialize the calendar storage."""
        try:
            self._set_status(ConnectorStatus.CONNECTING)
            self._load_events()
            self._set_status(ConnectorStatus.CONNECTED)
            return True
        except Exception as e:
            self._set_status(ConnectorStatus.ERROR, str(e))
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from calendar (save any pending changes)."""
        try:
            self._save_events()
            self._set_status(ConnectorStatus.DISCONNECTED)
            return True
        except Exception as e:
            self._last_error = str(e)
            return False
    
    async def test_connection(self) -> ConnectorTestResult:
        """Test that the calendar storage is accessible."""
        try:
            self._storage_path.parent.mkdir(parents=True, exist_ok=True)
            # Try write test
            test_file = self._storage_path.parent / ".write_test"
            test_file.write_text("test")
            test_file.unlink()
            
            return ConnectorTestResult(
                success=True,
                message=f"Calendar storage accessible at {self._storage_path}",
                details={"event_count": len(self._events)},
            )
        except Exception as e:
            return ConnectorTestResult(
                success=False,
                message=f"Calendar storage not accessible: {str(e)}",
            )
    
    async def sync(self, sync_type: str = "incremental") -> SyncResult:
        """Sync is a no-op for local calendar - data is always local."""
        self.validate_permissions("read", "events")
        return SyncResult(
            status=SyncStatus.SUCCESS,
            records_synced=len(self._events),
            metadata={"sync_type": sync_type, "source": "local"},
        )
    
    # Calendar-specific methods
    
    async def create_event(
        self,
        title: str,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        description: str = "",
        location: str = "",
        recurrence: Optional[str] = None,
        reminder_minutes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create a new calendar event."""
        self.validate_permissions("write", "events")
        
        if end_time is None:
            end_time = start_time + timedelta(hours=1)
        
        if reminder_minutes is None:
            reminder_minutes = self.context.settings.get("default_reminder_minutes", 15)
        
        event = {
            "id": str(uuid.uuid4()),
            "title": title,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "description": description,
            "location": location,
            "recurrence": recurrence,
            "reminder_minutes": reminder_minutes,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        self._events.append(event)
        self._save_events()
        
        return event
    
    async def get_events(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get events within a date range."""
        self.validate_permissions("read", "events")
        
        events = self._events
        
        if start_date:
            events = [
                e for e in events
                if datetime.fromisoformat(e["start_time"]) >= start_date
            ]
        
        if end_date:
            events = [
                e for e in events
                if datetime.fromisoformat(e["start_time"]) <= end_date
            ]
        
        # Sort by start time
        events.sort(key=lambda e: e["start_time"])
        
        return events[:limit]
    
    async def update_event(
        self,
        event_id: str,
        **updates: Any,
    ) -> Optional[Dict[str, Any]]:
        """Update an existing event."""
        self.validate_permissions("write", "events")
        
        for event in self._events:
            if event["id"] == event_id:
                event.update(updates)
                event["updated_at"] = datetime.utcnow().isoformat()
                self._save_events()
                return event
        
        return None
    
    async def delete_event(self, event_id: str) -> bool:
        """Delete an event by ID."""
        self.validate_permissions("delete", "events")
        
        for i, event in enumerate(self._events):
            if event["id"] == event_id:
                del self._events[i]
                self._save_events()
                return True
        
        return False
    
    async def get_upcoming_events(
        self,
        days: int = 7,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get upcoming events for the next N days."""
        now = datetime.utcnow()
        end = now + timedelta(days=days)
        return await self.get_events(start_date=now, end_date=end, limit=limit)
    
    async def export_to_ical(self) -> str:
        """Export events to iCal format."""
        self.validate_permissions("read", "events")
        
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aura//Local Calendar//EN"]
        
        for event in self._events:
            lines.append("BEGIN:VEVENT")
            lines.append(f"UID:{event['id']}@aura.local")
            lines.append(f"SUMMARY:{event['title']}")
            lines.append(f"DTSTART:{event['start_time'].replace('-', '').replace(':', '')}")
            lines.append(f"DTEND:{event['end_time'].replace('-', '').replace(':', '')}")
            if event.get("description"):
                lines.append(f"DESCRIPTION:{event['description']}")
            if event.get("location"):
                lines.append(f"LOCATION:{event['location']}")
            lines.append("END:VEVENT")
        
        lines.append("END:VCALENDAR")
        return "\r\n".join(lines)
