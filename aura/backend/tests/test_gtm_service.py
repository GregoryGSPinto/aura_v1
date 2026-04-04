"""Tests for GTM Strategy Service."""

import os
import pytest
from app.services.gtm_service import GTMService


@pytest.fixture
def svc(tmp_path):
    db_path = os.path.join(str(tmp_path), "test_gtm.db")
    return GTMService(db_path=db_path)


def test_create_and_list_lead(svc):
    lead = svc.create_item("leads", {
        "id": "test-1",
        "name": "Box Alpha",
        "product": "pw",
        "column": "cold",
        "city": "BH",
        "instagram": "boxalpha",
        "phone": "31999999999",
        "email": "alpha@test.com",
        "notes": "",
        "last_contact": "2026-04-01",
        "interactions": "[]",
        "stage_entered_at": "2026-04-01",
    })
    assert lead["name"] == "Box Alpha"
    assert lead["product"] == "pw"

    items = svc.list_items("leads")
    assert len(items) == 1
    assert items[0]["id"] == "test-1"


def test_update_lead(svc):
    svc.create_item("leads", {
        "id": "upd-1", "name": "Old Name", "product": "bb",
        "column": "cold", "last_contact": "2026-04-01",
    })
    updated = svc.update_item("leads", "upd-1", {"name": "New Name"})
    assert updated is not None
    assert updated["name"] == "New Name"


def test_delete_lead(svc):
    svc.create_item("leads", {
        "id": "del-1", "name": "To Delete", "product": "bb",
        "column": "cold", "last_contact": "2026-04-01",
    })
    assert svc.delete_item("leads", "del-1") is True
    assert svc.get_item("leads", "del-1") is None
    assert svc.delete_item("leads", "del-1") is False


def test_pipeline_stats(svc):
    for i, col in enumerate(["cold", "cold", "contato", "demo", "pagante"]):
        svc.create_item("leads", {
            "id": f"stat-{i}", "name": f"Lead {i}", "product": "bb",
            "column": col, "last_contact": "2026-04-01",
        })
    stats = svc.get_pipeline_stats()
    assert stats["total"] == 5
    assert stats["paying"] == 1
    assert stats["conversion_rate"] == 20.0
    assert stats["by_column"]["cold"] == 2


def test_stale_leads(svc):
    svc.create_item("leads", {
        "id": "stale-1", "name": "Old Lead", "product": "pw",
        "column": "contato", "last_contact": "2026-03-01",
    })
    svc.create_item("leads", {
        "id": "fresh-1", "name": "Fresh Lead", "product": "pw",
        "column": "contato", "last_contact": "2026-04-03",
    })
    stale = svc.get_stale_leads(3)
    assert len(stale) == 1
    assert stale[0]["name"] == "Old Lead"


def test_metrics_summary(svc):
    from datetime import date
    today = date.today().isoformat()
    svc.create_item("daily_metrics", {
        "id": "m1", "date": today, "product": "blackbelt",
        "dms_sent": 10, "dms_replied": 3, "demos_scheduled": 1,
        "demos_done": 1, "trials_started": 0, "conversions": 0,
    })
    summary = svc.get_metrics_summary(7)
    assert summary["dms_sent"] == 10
    assert summary["dms_replied"] == 3
    assert summary["reply_rate"] == 30.0


def test_streak(svc):
    from datetime import date, timedelta
    today = date.today()
    for i in range(3):
        d = (today - timedelta(days=i)).isoformat()
        svc.create_item("daily_metrics", {
            "id": f"streak-{i}", "date": d, "product": "blackbelt",
            "dms_sent": 5, "dms_replied": 1, "demos_scheduled": 0,
            "demos_done": 0, "trials_started": 0, "conversions": 0,
        })
    assert svc.get_streak() == 3


def test_daily_briefing(svc):
    briefing = svc.get_daily_briefing()
    assert "pipeline" in briefing
    assert "streak" in briefing
    assert "metrics_7d" in briefing
    assert "goals" in briefing


def test_invalid_collection(svc):
    with pytest.raises(ValueError, match="Unknown collection"):
        svc.list_items("nonexistent")


def test_content_crud(svc):
    item = svc.create_item("content", {
        "id": "c1", "product": "blackbelt", "type": "reel",
        "title": "Test Reel", "caption": "", "status": "idea", "notes": "",
    })
    assert item["title"] == "Test Reel"

    updated = svc.update_item("content", "c1", {"status": "agendado", "scheduled_date": "2026-04-10"})
    assert updated["status"] == "agendado"


def test_capture_goals(svc):
    svc.create_item("capture_goals", {
        "id": "goals", "dms_per_day": 8, "demos_per_week": 4,
        "trials_per_month": 6, "conversions_per_month": 3,
    })
    goals = svc.get_item("capture_goals", "goals")
    assert goals["dms_per_day"] == 8
