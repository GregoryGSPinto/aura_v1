"""
Attachment Tool — Processa arquivos que Gregory envia pelo chat.

Suporta:
- Imagens: salva e retorna path (não processa visão)
- PDFs: extrai texto
- Documentos: extrai texto (txt, md, csv, json, py, js, ts, etc)
- Áudio: transcreve via STT (se disponível)
- Zip: lista conteúdo

O Gregory pode arrastar arquivo no chat ou enviar por voz "analisa esse arquivo".
O frontend faz upload pro backend, que usa este tool para processar.
"""

import asyncio
import json
import mimetypes
import os
from pathlib import Path

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel


UPLOAD_DIR = os.path.expanduser("~/Projetos/aura_v1/aura/data/uploads")
TEXT_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json", ".py", ".js", ".ts", ".tsx",
    ".jsx", ".html", ".css", ".yaml", ".yml", ".toml", ".sh",
    ".bash", ".sql", ".xml", ".ini", ".conf", ".log", ".env.example",
}


class AttachmentTool(BaseTool):
    name = "attachment"
    description = "Processa arquivos enviados pelo Gregory: extrai texto de PDFs, lê documentos, lista ZIPs, etc."
    category = "filesystem"
    autonomy_level = AutonomyLevel.L1_AUTONOMOUS
    parameters = {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Caminho do arquivo enviado"
            },
            "action": {
                "type": "string",
                "enum": ["read", "info", "extract_text"],
                "description": "Ação: read (conteúdo), info (metadata), extract_text (PDF/doc)"
            }
        },
        "required": ["file_path"]
    }

    async def execute(self, params: dict) -> ToolResult:
        file_path = params["file_path"]
        action = params.get("action", "read")

        if not os.path.exists(file_path):
            return ToolResult(success=False, output=None,
                              error=f"Arquivo não encontrado: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        size = os.path.getsize(file_path)
        mime = mimetypes.guess_type(file_path)[0] or "unknown"

        if action == "info":
            return ToolResult(success=True, output=json.dumps({
                "path": file_path,
                "name": os.path.basename(file_path),
                "extension": ext,
                "size_bytes": size,
                "size_human": f"{size // 1024}KB" if size > 1024 else f"{size}B",
                "mime_type": mime,
            }))

        # Ler conteúdo baseado no tipo
        try:
            if ext in TEXT_EXTENSIONS:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                if len(content) > 100000:
                    content = content[:100000] + "\n\n[...TRUNCADO]"
                return ToolResult(success=True,
                                  output=f"Arquivo: {os.path.basename(file_path)} ({len(content)} chars)\n\n{content}")

            elif ext == ".pdf":
                # Tentar extrair texto com pdftotext
                proc = await asyncio.create_subprocess_shell(
                    f'pdftotext "{file_path}" -',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                text = stdout.decode("utf-8", errors="replace")
                if text.strip():
                    return ToolResult(success=True,
                                      output=f"PDF: {os.path.basename(file_path)}\n\n{text[:100000]}")
                return ToolResult(success=True,
                                  output="PDF sem texto extraível (pode ser scan/imagem)")

            elif ext == ".zip":
                import zipfile
                with zipfile.ZipFile(file_path, 'r') as z:
                    files = z.namelist()
                return ToolResult(success=True,
                                  output=f"ZIP com {len(files)} arquivos:\n" + "\n".join(files[:50]))

            elif ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
                return ToolResult(success=True,
                                  output=f"Imagem: {os.path.basename(file_path)} ({size // 1024}KB, {mime}). "
                                         f"Salva em: {file_path}. "
                                         f"Nota: Qwen local não processa imagens. Use Claude API para análise visual.")

            else:
                return ToolResult(success=True,
                                  output=f"Arquivo: {os.path.basename(file_path)} ({ext}, {size // 1024}KB). "
                                         f"Tipo não suportado para leitura direta.")

        except Exception as e:
            return ToolResult(success=False, output=None, error=str(e))
