from fastapi import APIRouter

from app.api.v1.endpoints import auth, chat, command, projects, status


api_router = APIRouter()
api_router.include_router(status.router, tags=["status"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(command.router, tags=["command"])
api_router.include_router(projects.router, tags=["projects"])

