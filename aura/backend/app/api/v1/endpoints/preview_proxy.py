"""
Preview Proxy — Proxy reverso pra localhost.

Permite que o frontend (Vercel) acesse qualquer porta localhost
do Mac via backend. O frontend manda:
  GET /api/v1/preview/proxy?url=http://localhost:3000/pagina

O backend faz a request no localhost e retorna o HTML/CSS/JS/imagem.

Seguranca:
- So permite URLs pro localhost (127.0.0.1, localhost, 0.0.0.0)
- Portas permitidas: 3000-9999 (range de dev)
- Timeout: 10 segundos
- Auth token obrigatorio
"""

import asyncio
import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import Response

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")
router = APIRouter(prefix="/preview", dependencies=[Depends(require_bearer_token)])

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}
ALLOWED_PORT_RANGE = range(3000, 10000)


@router.get("/proxy")
async def preview_proxy(
    request: Request,
    url: str = Query(..., description="URL localhost a buscar"),
):
    """Proxy reverso pra localhost."""

    # 1. Validar URL
    parsed = urlparse(url)

    if parsed.hostname not in ALLOWED_HOSTS:
        return Response(
            content=f"Bloqueado: so localhost e permitido (recebido: {parsed.hostname})",
            status_code=403,
        )

    port = parsed.port or 80
    if port not in ALLOWED_PORT_RANGE:
        return Response(
            content=f"Porta {port} fora do range permitido (3000-9999)",
            status_code=403,
        )

    # 2. Fazer request
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "*/*"})

            # 3. Reescrever URLs no HTML pra passar pelo proxy
            content_type = resp.headers.get("content-type", "")
            body = resp.content

            if "text/html" in content_type:
                html = body.decode("utf-8", errors="replace")

                base_url = f"{parsed.scheme}://{parsed.hostname}:{port}"
                proxy_base = f"/api/v1/preview/proxy?url={base_url}"

                html = html.replace('src="/', f'src="{proxy_base}/')
                html = html.replace("src='/", f"src='{proxy_base}/")
                html = html.replace('href="/', f'href="{proxy_base}/')
                html = html.replace("href='/", f"href='{proxy_base}/")

                body = html.encode("utf-8")

            # 4. Retorna com headers originais
            headers = {}
            for key in ["content-type", "cache-control", "etag"]:
                if key in resp.headers:
                    headers[key] = resp.headers[key]

            # Permite iframe
            headers["X-Frame-Options"] = "ALLOWALL"
            headers["Content-Security-Policy"] = ""

            return Response(
                content=body,
                status_code=resp.status_code,
                headers=headers,
                media_type=resp.headers.get("content-type"),
            )

    except httpx.ConnectError:
        return Response(
            content=(
                "<html><body style='background:#18181b;color:#ef4444;font-family:monospace;"
                f"padding:40px;text-align:center'><h2>Nada rodando na porta {port}</h2>"
                "<p>Inicie o servidor: npm run dev / python manage.py runserver</p>"
                "</body></html>"
            ),
            status_code=502,
            media_type="text/html",
        )
    except httpx.TimeoutException:
        return Response(content="Timeout ao conectar no localhost", status_code=504)
    except Exception as exc:
        logger.error("[PreviewProxy] Error: %s", exc)
        return Response(content=f"Erro: {exc}", status_code=500)


@router.get("/ports")
async def list_active_ports(request: Request):
    """Lista portas ativas no localhost (range dev)."""
    active: list[dict] = []

    async def check_port(port: int):
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                resp = await client.get(f"http://localhost:{port}/")
                active.append({
                    "port": port,
                    "status": resp.status_code,
                    "type": _guess_type(port),
                })
        except Exception:
            pass

    common_ports = [3000, 3001, 3002, 3003, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8888, 9000]
    await asyncio.gather(*[check_port(p) for p in common_ports])

    active.sort(key=lambda x: x["port"])
    return {"success": True, "data": {"ports": active}}


def _guess_type(port: int) -> str:
    """Tenta adivinhar o que roda numa porta."""
    guesses = {
        3000: "Next.js / React",
        3001: "Next.js (alt)",
        4200: "Angular",
        5000: "Flask / FastAPI",
        5173: "Vite",
        5174: "Vite (alt)",
        8000: "Aura Backend",
        8080: "HTTP Server",
        8888: "Jupyter",
        9000: "PHP / Other",
    }
    return guesses.get(port, "Unknown")
