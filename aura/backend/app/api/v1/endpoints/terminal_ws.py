"""
Terminal WebSocket — Sessão de terminal real via WebSocket.

Flow:
1. Frontend conecta via WebSocket em /api/v1/terminal/ws
2. Cada mensagem do frontend é um comando
3. Backend executa via subprocess e retorna output em tempo real
4. Output é streamed de volta via WebSocket

Segurança:
- Requer token de auth no query string ou header
- BLOCKED_PATTERNS do security.py são verificados antes de executar
- Timeout por comando: 60 segundos
- Logs de auditoria de cada comando
"""

import asyncio
import json
import logging
import os
import signal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import BLOCKED_PATTERNS

logger = logging.getLogger("aura")
router = APIRouter()


@router.websocket("/terminal/ws")
async def terminal_websocket(websocket: WebSocket, token: str = Query("")):
    """WebSocket para terminal interativo."""

    # 1. Autenticar
    auth_token = websocket.app.state.settings.auth_token
    if token != auth_token:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    # 2. Estado do terminal
    cwd = os.path.expanduser("~")
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    history = []
    active_process = None

    # Enviar prompt inicial
    await websocket.send_text(json.dumps({
        "type": "connected",
        "cwd": cwd,
    }))

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            msg_type = msg.get("type", "command")

            if msg_type == "command":
                command = msg.get("command", "").strip()
                if not command:
                    continue

                # Histórico
                history.append(command)
                logger.info("[TerminalWS] Executing: %s (cwd=%s)", command, cwd)

                # Verificar blocked patterns
                if _is_blocked(command):
                    await websocket.send_text(json.dumps({
                        "type": "output",
                        "content": "\033[31mComando bloqueado por política de segurança.\033[0m\n",
                    }))
                    await websocket.send_text(json.dumps({
                        "type": "prompt",
                        "cwd": cwd,
                    }))
                    continue

                # cd é tratado especialmente (muda o cwd)
                if command == "cd" or command.startswith("cd "):
                    target = command[3:].strip() if command.startswith("cd ") else os.path.expanduser("~")
                    target = os.path.expanduser(target)
                    if not os.path.isabs(target):
                        target = os.path.join(cwd, target)
                    target = os.path.normpath(target)
                    if os.path.isdir(target):
                        cwd = target
                        await websocket.send_text(json.dumps({
                            "type": "prompt",
                            "cwd": cwd,
                        }))
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "output",
                            "content": f"cd: no such file or directory: {target}\n",
                        }))
                        await websocket.send_text(json.dumps({
                            "type": "prompt",
                            "cwd": cwd,
                        }))
                    continue

                # Executa comando
                try:
                    active_process = await asyncio.create_subprocess_shell(
                        command,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                        cwd=cwd,
                        env=env,
                    )

                    # Stream output
                    while True:
                        try:
                            line = await asyncio.wait_for(
                                active_process.stdout.readline(),
                                timeout=60.0,
                            )
                            if not line:
                                break
                            await websocket.send_text(json.dumps({
                                "type": "output",
                                "content": line.decode("utf-8", errors="replace"),
                            }))
                        except asyncio.TimeoutError:
                            active_process.kill()
                            await websocket.send_text(json.dumps({
                                "type": "output",
                                "content": "\n\033[33mTimeout: comando cancelado após 60s.\033[0m\n",
                            }))
                            break

                    await active_process.wait()
                    exit_code = active_process.returncode

                    # Envia exit code se não for 0
                    if exit_code and exit_code != 0:
                        await websocket.send_text(json.dumps({
                            "type": "exit_code",
                            "code": exit_code,
                        }))

                except Exception as exc:
                    await websocket.send_text(json.dumps({
                        "type": "output",
                        "content": f"\033[31mErro: {exc}\033[0m\n",
                    }))

                finally:
                    active_process = None
                    # Envia novo prompt
                    await websocket.send_text(json.dumps({
                        "type": "prompt",
                        "cwd": cwd,
                    }))

            elif msg_type == "signal":
                # Ctrl+C
                sig = msg.get("signal", "SIGINT")
                if active_process and active_process.returncode is None:
                    if sig == "SIGINT":
                        active_process.send_signal(signal.SIGINT)
                    elif sig == "SIGTERM":
                        active_process.terminate()

            elif msg_type == "resize":
                # Terminal resize (futuro: pty support)
                pass

    except WebSocketDisconnect:
        if active_process and active_process.returncode is None:
            active_process.kill()
        logger.info("[TerminalWS] Client disconnected")
    except Exception as exc:
        logger.error("[TerminalWS] Error: %s", exc)
        if active_process and active_process.returncode is None:
            active_process.kill()


def _is_blocked(command: str) -> bool:
    """Verifica se o comando está na blocklist."""
    cmd_lower = command.lower().strip()
    for pattern in BLOCKED_PATTERNS:
        if pattern in cmd_lower:
            return True
    # Extras de segurança
    dangerous = ["rm -rf /", "mkfs", "> /dev/sda", "dd if=", ":(){ :|:& };:"]
    for d in dangerous:
        if d in cmd_lower:
            return True
    return False
