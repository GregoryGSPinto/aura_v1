"""Upload API — Recebe arquivos do frontend."""

import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import require_bearer_token

router = APIRouter(prefix="/upload", dependencies=[Depends(require_bearer_token)])

UPLOAD_DIR = os.path.expanduser("~/Projetos/aura_v1/aura/data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    """Recebe arquivo e salva no disco."""
    ext = os.path.splitext(file.filename or "")[1]
    safe_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"
    save_path = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    return {
        "path": save_path,
        "original_name": file.filename,
        "size_bytes": len(content),
        "content_type": file.content_type,
    }
