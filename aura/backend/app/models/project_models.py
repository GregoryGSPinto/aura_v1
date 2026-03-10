from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Project(BaseModel):
    id: Optional[str] = None
    name: str
    path: str
    description: Optional[str] = None
    commands: Dict[str, str] = Field(default_factory=dict)
    source: Optional[str] = None


class ProjectListResponse(BaseModel):
    projects: List[Project]
    total: int


class OpenProjectRequest(BaseModel):
    name: str


class ProjectOpenResult(BaseModel):
    name: str
    path: str
    opened_in: str
    message: str
