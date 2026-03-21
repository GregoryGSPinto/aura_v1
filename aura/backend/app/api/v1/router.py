from fastapi import APIRouter

from app.api.v1.endpoints import agent, auth, chat, command, companion, dataset, jobs, os_runtime, projects, routines, status, system, tools


api_router = APIRouter()
api_router.include_router(status.router, tags=["status"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(command.router, tags=["command"])
api_router.include_router(companion.router)
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(system.router, tags=["system"])
api_router.include_router(tools.router, tags=["tools"])
api_router.include_router(jobs.router, tags=["jobs"])
api_router.include_router(agent.router, tags=["agent"])
api_router.include_router(os_runtime.router)
api_router.include_router(routines.router, tags=["routines"])
api_router.include_router(dataset.router)
