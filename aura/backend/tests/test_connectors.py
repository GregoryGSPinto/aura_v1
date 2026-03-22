"""Tests for Connectors."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestGitHubConnector:
    @pytest.mark.asyncio
    async def test_is_configured_with_token(self):
        from app.aura_os.connectors.github_connector import GitHubConnector
        conn = GitHubConnector(token="ghp_test123", username="gregory")
        assert await conn.is_configured() is True

    @pytest.mark.asyncio
    async def test_not_configured_without_token(self):
        from app.aura_os.connectors.github_connector import GitHubConnector
        conn = GitHubConnector()
        assert await conn.is_configured() is False

    @pytest.mark.asyncio
    async def test_sync_returns_dict(self):
        from app.aura_os.connectors.github_connector import GitHubConnector
        conn = GitHubConnector(token="fake", username="test")
        with patch.object(conn, "get_repos", new_callable=AsyncMock, return_value=[{"name": "repo1"}]):
            with patch.object(conn, "get_notifications", new_callable=AsyncMock, return_value=[]):
                with patch.object(conn, "get_issues", new_callable=AsyncMock, return_value=[]):
                    result = await conn.sync()
                    assert result["connector"] == "github"
                    assert result["success"] is True


class TestGmailConnector:
    @pytest.mark.asyncio
    async def test_configured_with_credentials(self):
        from app.aura_os.connectors.gmail_connector import GmailConnector
        conn = GmailConnector(address="test@gmail.com", app_password="pass")
        assert await conn.is_configured() is True

    @pytest.mark.asyncio
    async def test_not_configured_without_credentials(self):
        from app.aura_os.connectors.gmail_connector import GmailConnector
        conn = GmailConnector()
        assert await conn.is_configured() is False


class TestCalendarConnector:
    @pytest.mark.asyncio
    async def test_configured_with_api_key(self):
        from app.aura_os.connectors.calendar_connector import GoogleCalendarConnector
        conn = GoogleCalendarConnector(api_key="test-key")
        assert await conn.is_configured() is True

    @pytest.mark.asyncio
    async def test_not_configured_without_api_key(self):
        from app.aura_os.connectors.calendar_connector import GoogleCalendarConnector
        conn = GoogleCalendarConnector()
        assert await conn.is_configured() is False
