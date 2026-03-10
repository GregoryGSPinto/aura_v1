from app.agents.models import AgentExecutionResult, AgentGoalRequest
from app.agents.planner import AgentPlanner
from app.models.job_models import JobRecord
from app.services.job_service import JobService
from app.services.project_service import ProjectService


class AgentJobManager:
    def __init__(self, planner: AgentPlanner, job_service: JobService, project_service: ProjectService):
        self.planner = planner
        self.job_service = job_service
        self.project_service = project_service

    def create_job_from_goal(self, request: AgentGoalRequest) -> AgentExecutionResult:
        plan = self.planner.create_plan(request.goal, self.project_service.list_projects(), request.title)
        job = self.job_service.create_planned_job(
            title=plan.title,
            goal=plan.goal,
            steps=[step.to_job_step(index) for index, step in enumerate(plan.steps)],
            blocked=plan.status == "blocked",
            notes=plan.notes,
        )
        started = False
        if request.auto_start and job.status != "blocked":
            self.job_service.start_job(job.id)
            started = True
        return AgentExecutionResult(job_id=job.id, plan_status=plan.status, started=started, notes=plan.notes)

    def list_jobs(self):
        return self.job_service.list_jobs()

    def get_job(self, job_id: str) -> JobRecord:
        return self.job_service.get_job(job_id)

    def start_job(self, job_id: str) -> JobRecord:
        return self.job_service.start_job(job_id)

    def cancel_job(self, job_id: str) -> JobRecord:
        return self.job_service.cancel_job(job_id)

    def get_steps(self, job_id: str):
        return self.job_service.get_job(job_id).steps

    def get_logs(self, job_id: str):
        return self.job_service.get_job(job_id).logs

    def create_plan(self, request: AgentGoalRequest):
        return self.planner.create_plan(request.goal, self.project_service.list_projects(), request.title)
