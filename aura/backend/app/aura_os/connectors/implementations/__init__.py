"""Built-in connector implementations for Aura Ecosystem.
"""

from app.aura_os.connectors.implementations.calendar_connector import CalendarConnector
from app.aura_os.connectors.implementations.filesystem_connector import FilesystemConnector
from app.aura_os.connectors.implementations.git_connector import GitConnector
from app.aura_os.connectors.implementations.vscode_connector import VSCodeConnector

__all__ = [
    "CalendarConnector",
    "FilesystemConnector", 
    "GitConnector",
    "VSCodeConnector",
]
