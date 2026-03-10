import threading
import time
from typing import Any, Dict, List, Optional

from app.core.config import Settings
from app.core.exceptions import AuraError
from app.models.job_models import JobCreateRequest, JobListResponse, JobLogEntry, JobRecord, JobStats, JobSummary
from app.services.command_service import CommandService
from app.services.memory_service import MemoryService
from app.utils.helpers import iso_now


class JobService:
    def __init__(self, settings: Settings, memory_service: MemoryService, command_service: CommandService, logger):
        self.settings = settings
        self.memory_service = memory_service
        self.command_service = command_service
        self.logger = logger
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None
        self._recover_jobs()

    def start(self) -> None:
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._run_loop, daemon=True, name="aura-job-runner")
        self._worker_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2)

    def create_job(self, request: JobCreateRequest) -> JobRecord:
        now = iso_now()
        job = JobRecord(
            id=f"job_{int(time.time() * 1000)}",
            description=request.description,
            status="queued",
            created_at=now,
            updated_at=now,
            steps=request.steps,
            progress=0,
            current_step=0,
            result=None,
            error=None,
            logs=[],
        )
        with self._lock:
            self.memory_service.upsert_job(job)
        self._log(job.id, -1, "info", "Job enfileirado.", {"steps": len(request.steps)})
        return self.get_job(job.id)

    def list_jobs(self) -> JobListResponse:
        jobs = [JobRecord(**item) for item in self.memory_service.list_jobs()]
        summaries = [
            JobSummary(
                id=job.id,
                description=job.description,
                status=job.status,
                progress=job.progress,
                current_step=job.current_step,
                created_at=job.created_at,
                updated_at=job.updated_at,
            )
            for job in sorted(jobs, key=lambda item: item.created_at, reverse=True)
        ]
        return JobListResponse(jobs=summaries, total=len(summaries))

    def get_job(self, job_id: str) -> JobRecord:
        for item in self.memory_service.list_jobs():
            if item.get("id") == job_id:
                job = JobRecord(**item)
                job.logs = [JobLogEntry(**log) for log in self.memory_service.list_job_logs(job_id)]
                return job
        raise AuraError("job_not_found", f"Job '{job_id}' não encontrado.", status_code=404)

    def cancel_job(self, job_id: str) -> JobRecord:
        with self._lock:
            job = self.get_job(job_id)
            if job.status in {"completed", "failed", "cancelled"}:
                return job
            job.status = "cancelled"
            job.updated_at = iso_now()
            job.error = "Cancelado pelo usuário."
            self.memory_service.upsert_job(job)
            self._log(job.id, job.current_step, "warning", "Job cancelado.")
            return self.get_job(job_id)

    def get_stats(self) -> JobStats:
        jobs = [JobRecord(**item) for item in self.memory_service.list_jobs()]
        counts = {status: 0 for status in ["queued", "running", "completed", "failed", "cancelled"]}
        for job in jobs:
            counts[job.status] += 1
        return JobStats(total=len(jobs), **counts)

    def _recover_jobs(self) -> None:
        recovered: List[JobRecord] = []
        for item in self.memory_service.list_jobs():
            job = JobRecord(**item)
            if job.status == "running":
                job.status = "queued"
                job.updated_at = iso_now()
                self.memory_service.upsert_job(job)
                self._log(job.id, job.current_step, "warning", "Job recuperado após reinício e reenfileirado.")
            recovered.append(job)
        if recovered:
            self.logger.info("Aura job runner recuperou %s job(s).", len(recovered))

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            job = self._next_job()
            if not job:
                time.sleep(self.settings.job_poll_interval)
                continue
            self._execute_job(job)

    def _next_job(self) -> Optional[JobRecord]:
        with self._lock:
            for item in self.memory_service.list_jobs():
                job = JobRecord(**item)
                if job.status == "queued":
                    job.status = "running"
                    job.updated_at = iso_now()
                    self.memory_service.upsert_job(job)
                    return job
        return None

    def _execute_job(self, job: JobRecord) -> None:
        total_steps = len(job.steps)
        results: List[Dict[str, Any]] = []
        self._log(job.id, job.current_step, "info", "Execução do job iniciada.")

        for index, step in enumerate(job.steps):
            current = self.get_job(job.id)
            if current.status == "cancelled":
                return
            self._log(job.id, index, "info", f"Executando comando '{step.command}'.", {"params": step.params})
            try:
                result = self.command_service.execute(
                    step.command,
                    step.params,
                    actor={"user_id": "aura-agent", "provider": "job-runner"},
                )
                results.append(result.model_dump())
                progress = int(((index + 1) / total_steps) * 100)
                self._update_job(job.id, current_step=index + 1, progress=progress)
                self._log(job.id, index, "info", f"Comando '{step.command}' concluído.", {"status": result.status})
            except Exception as exc:
                self._update_job(
                    job.id,
                    status="failed",
                    error=str(exc),
                    result={"results": results},
                    current_step=index + 1,
                )
                self._log(job.id, index, "error", f"Falha no comando '{step.command}'.", {"error": str(exc)})
                return

        self._update_job(job.id, status="completed", progress=100, result={"results": results}, current_step=total_steps)
        self._log(job.id, total_steps, "info", "Job concluído com sucesso.")

    def _update_job(self, job_id: str, **updates) -> None:
        with self._lock:
            job = self.get_job(job_id)
            payload = job.model_dump()
            payload.update(updates)
            payload["updated_at"] = iso_now()
            self.memory_service.upsert_job(JobRecord(**payload))

    def _log(self, job_id: str, step_index: int, level: str, message: str, metadata: Optional[Dict[str, Any]] = None):
        entry = JobLogEntry(
            job_id=job_id,
            step_index=step_index,
            timestamp=iso_now(),
            level=level,
            message=message,
            metadata=metadata or {},
        )
        self.memory_service.append_job_log(entry)
        self.logger.info("job=%s step=%s level=%s %s", job_id, step_index, level, message)

