from fastapi import APIRouter

from app.api.v1.endpoints import agent, auth, chat, chat_stream, command, companion, connectors, dataset, filesystem_api, jobs, os_runtime, preview_proxy, projects, push_api, routines, status, system, terminal_ws, tools


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
api_router.include_router(chat_stream.router, tags=["chat-stream"])
api_router.include_router(connectors.router)
api_router.include_router(terminal_ws.router)
api_router.include_router(filesystem_api.router, tags=["files"])
api_router.include_router(preview_proxy.router, tags=["preview"])
api_router.include_router(push_api.router, tags=["push"])
