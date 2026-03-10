from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.job_models import JobStepRequest


PlanStatus = Literal["planned", "blocked"]


class AgentGoalRequest(BaseModel):
    title: Optional[str] = None
    goal: str = Field(min_length=1, max_length=2000)
    auto_start: bool = False


class AgentPlanStep(BaseModel):
    title: str
    description: str
    command: Optional[str] = None
    params: dict = Field(default_factory=dict)
    status: Literal["planned", "blocked"] = "planned"
    reason: Optional[str] = None

    def to_job_step(self, order: int) -> JobStepRequest:
        return JobStepRequest(
            id=f"step_{order + 1}",
            title=self.title,
            description=self.description,
            command=self.command,
            params=self.params,
            order=order,
            status="blocked" if self.status == "blocked" else "planned",
            error=self.reason,
        )


class AgentPlan(BaseModel):
    title: str
    goal: str
    status: PlanStatus
    steps: List[AgentPlanStep] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class AgentExecutionResult(BaseModel):
    job_id: str
    plan_status: PlanStatus
    started: bool
    notes: List[str] = Field(default_factory=list)

