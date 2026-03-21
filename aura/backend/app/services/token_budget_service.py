"""
Token Budget — Controle de gasto com APIs pagas.

O Qwen local e gratis. Claude e GPT custam dinheiro.
Sem controle, um loop de raciocinio pode queimar R$500 em uma tarde.

Tiers:
- GREEN (< 70%): opera normal, usa o provider que o router escolheu
- YELLOW (70-90%): loga warning, sugere downgrade pra modelo mais barato
- RED (90-100%): so Ollama local, notifica Gregory
- BLOCKED (> 100%): recusa chamadas pagas, so Ollama
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("aura.providers")

TIER_GREEN = "GREEN"
TIER_YELLOW = "YELLOW"
TIER_RED = "RED"
TIER_BLOCKED = "BLOCKED"


class TokenBudgetService:
    def __init__(
        self,
        daily_limit_usd: float = 5.0,
        monthly_limit_usd: float = 100.0,
        budget_file: str = "./data/json/token_budget.json",
    ):
        self.daily_limit_usd = daily_limit_usd
        self.monthly_limit_usd = monthly_limit_usd
        self._budget_path = Path(budget_file)
        self._ensure_file()

    def _ensure_file(self):
        if not self._budget_path.exists():
            self._budget_path.parent.mkdir(parents=True, exist_ok=True)
            self._write({"records": [], "daily_totals": {}, "monthly_totals": {}})

    def _read(self) -> Dict[str, Any]:
        try:
            return json.loads(self._budget_path.read_text(encoding="utf-8"))
        except Exception:
            return {"records": [], "daily_totals": {}, "monthly_totals": {}}

    def _write(self, data: Dict[str, Any]) -> None:
        self._budget_path.parent.mkdir(parents=True, exist_ok=True)
        self._budget_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def _today_key(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _month_key(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m")

    def _daily_spent(self) -> float:
        data = self._read()
        return data.get("daily_totals", {}).get(self._today_key(), 0.0)

    def _monthly_spent(self) -> float:
        data = self._read()
        return data.get("monthly_totals", {}).get(self._month_key(), 0.0)

    def _compute_tier(self, daily_spent: float, monthly_spent: float) -> str:
        daily_pct = (daily_spent / self.daily_limit_usd * 100) if self.daily_limit_usd > 0 else 0
        monthly_pct = (monthly_spent / self.monthly_limit_usd * 100) if self.monthly_limit_usd > 0 else 0
        max_pct = max(daily_pct, monthly_pct)
        if max_pct > 100:
            return TIER_BLOCKED
        if max_pct >= 90:
            return TIER_RED
        if max_pct >= 70:
            return TIER_YELLOW
        return TIER_GREEN

    def can_spend(self, estimated_cost_usd: float) -> dict:
        daily = self._daily_spent()
        monthly = self._monthly_spent()
        tier = self._compute_tier(daily, monthly)

        if tier == TIER_BLOCKED:
            return {"allowed": False, "tier": tier, "reason": "Budget excedido. Apenas Ollama local permitido."}
        if tier == TIER_RED:
            return {"allowed": False, "tier": tier, "reason": "Budget critico (>90%). Apenas Ollama local."}
        if tier == TIER_YELLOW:
            new_daily = daily + estimated_cost_usd
            if new_daily > self.daily_limit_usd:
                return {"allowed": False, "tier": tier, "reason": "Gasto estimado excederia limite diario."}
            return {"allowed": True, "tier": tier, "reason": "Budget em alerta (70-90%). Considere modelo mais barato."}
        return {"allowed": True, "tier": tier, "reason": "Budget saudavel."}

    def record_spend(self, provider: str, model: str, input_tokens: int,
                     output_tokens: int, cost_usd: float) -> None:
        data = self._read()
        today = self._today_key()
        month = self._month_key()

        record = {
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost_usd, 6),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        records: List[Dict] = data.get("records", [])
        records.append(record)
        if len(records) > 10000:
            records = records[-5000:]
        data["records"] = records

        daily_totals = data.get("daily_totals", {})
        daily_totals[today] = round(daily_totals.get(today, 0.0) + cost_usd, 6)
        data["daily_totals"] = daily_totals

        monthly_totals = data.get("monthly_totals", {})
        monthly_totals[month] = round(monthly_totals.get(month, 0.0) + cost_usd, 6)
        data["monthly_totals"] = monthly_totals

        self._write(data)

        tier = self._compute_tier(daily_totals[today], monthly_totals[month])
        if tier == TIER_YELLOW:
            logger.warning("[TokenBudget] YELLOW tier — daily=$%.4f monthly=$%.4f", daily_totals[today], monthly_totals[month])
        elif tier in {TIER_RED, TIER_BLOCKED}:
            logger.error("[TokenBudget] %s tier — daily=$%.4f monthly=$%.4f", tier, daily_totals[today], monthly_totals[month])

    def get_budget_status(self) -> dict:
        daily = self._daily_spent()
        monthly = self._monthly_spent()
        tier = self._compute_tier(daily, monthly)
        return {
            "tier": tier,
            "daily_spent_usd": round(daily, 4),
            "daily_limit_usd": self.daily_limit_usd,
            "daily_remaining_usd": round(max(self.daily_limit_usd - daily, 0), 4),
            "monthly_spent_usd": round(monthly, 4),
            "monthly_limit_usd": self.monthly_limit_usd,
            "monthly_remaining_usd": round(max(self.monthly_limit_usd - monthly, 0), 4),
        }

    def suggest_provider(self, preferred: str) -> str:
        daily = self._daily_spent()
        monthly = self._monthly_spent()
        tier = self._compute_tier(daily, monthly)
        if tier in {TIER_RED, TIER_BLOCKED}:
            return "ollama"
        if tier == TIER_YELLOW and preferred in {"anthropic", "openai"}:
            return preferred
        return preferred
