"""Connector Registry for managing connector definitions.

The registry maintains the catalog of available connector types
and provides factory methods for creating connector instances.
"""

from typing import Callable, Dict, List, Optional, Type

from app.models.connector_models import (
    AuthType,
    ConfigSchemaProperty,
    ConnectorDefinition,
    ConnectorType,
)
from app.aura_os.connectors.base import BaseConnector, ConnectorContext


class ConnectorRegistry:
    """Registry for connector definitions and factories."""
    
    def __init__(self):
        self._definitions: Dict[str, ConnectorDefinition] = {}
        self._factories: Dict[str, Type[BaseConnector]] = {}
    
    def register(
        self,
        definition: ConnectorDefinition,
        factory: Type[BaseConnector],
    ) -> None:
        """Register a connector definition and its factory class.
        
        Args:
            definition: The connector definition metadata
            factory: The class that implements BaseConnector
        """
        self._definitions[definition.id] = definition
        self._factories[definition.id] = factory
    
    def register_builtin(self, connector_class: Type[BaseConnector]) -> None:
        """Register a built-in connector using its class properties.
        
        This is a convenience method for connectors that define their
        metadata as class attributes.
        """
        # Create definition from class properties
        definition = ConnectorDefinition(
            id=connector_class.definition_id,
            name=connector_class.name,
            type=connector_class.connector_type,
            description=connector_class.description,
            version=connector_class.version,
            auth_type=connector_class.auth_type,
            scopes=connector_class.scopes,
            config_schema=connector_class.config_schema,
            icon=connector_class.icon,
            features=connector_class.features,
        )
        self.register(definition, connector_class)
    
    def get_definition(self, definition_id: str) -> Optional[ConnectorDefinition]:
        """Get a connector definition by ID."""
        return self._definitions.get(definition_id)
    
    def get_factory(self, definition_id: str) -> Optional[Type[BaseConnector]]:
        """Get the factory class for a connector type."""
        return self._factories.get(definition_id)
    
    def list_definitions(
        self,
        connector_type: Optional[ConnectorType] = None,
    ) -> List[ConnectorDefinition]:
        """List all available connector definitions.
        
        Args:
            connector_type: Optional filter by connector type
            
        Returns:
            List of connector definitions
        """
        definitions = list(self._definitions.values())
        if connector_type:
            definitions = [d for d in definitions if d.type == connector_type]
        return definitions
    
    def create_connector(
        self,
        definition_id: str,
        context: ConnectorContext,
    ) -> Optional[BaseConnector]:
        """Create a new connector instance.
        
        Args:
            definition_id: The type of connector to create
            context: The context for the connector instance
            
        Returns:
            Configured connector instance or None if definition not found
        """
        factory = self._factories.get(definition_id)
        if not factory:
            return None
        return factory(context)
    
    def unregister(self, definition_id: str) -> bool:
        """Unregister a connector definition.
        
        Returns:
            True if the definition was found and removed
        """
        if definition_id in self._definitions:
            del self._definitions[definition_id]
            del self._factories[definition_id]
            return True
        return False
    
    def is_registered(self, definition_id: str) -> bool:
        """Check if a connector definition is registered."""
        return definition_id in self._definitions


# Global registry instance
_registry: Optional[ConnectorRegistry] = None


def get_registry() -> ConnectorRegistry:
    """Get the global connector registry, creating it if necessary."""
    global _registry
    if _registry is None:
        _registry = ConnectorRegistry()
        _register_builtin_connectors(_registry)
    return _registry


def _register_builtin_connectors(registry: ConnectorRegistry) -> None:
    """Register all built-in connectors."""
    # Import implementations here to avoid circular imports
    from app.aura_os.connectors.implementations.calendar_connector import CalendarConnector
    from app.aura_os.connectors.implementations.filesystem_connector import FilesystemConnector
    from app.aura_os.connectors.implementations.git_connector import GitConnector
    from app.aura_os.connectors.implementations.vscode_connector import VSCodeConnector
    
    # Register built-in connectors
    registry.register_builtin(CalendarConnector)
    registry.register_builtin(FilesystemConnector)
    registry.register_builtin(GitConnector)
    registry.register_builtin(VSCodeConnector)
