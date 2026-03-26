"""
Voice API:
- GET  /api/v1/voice/status        — estado do pipeline (STT + TTS)
- GET  /api/v1/voice/voices        — lista vozes pt-BR disponíveis
- GET  /api/v1/voice/capabilities  — detecta whisper/ffmpeg/say/edge-tts
- POST /api/v1/voice/transcribe    — áudio → texto (Whisper local ou fallback)
- POST /api/v1/voice/synthesize    — texto → áudio mp3 via edge-tts (pt-BR)
- POST /api/v1/voice/speak         — texto → áudio via macOS say (legado)
- POST /api/v1/chat/voice          — pipeline unificado: áudio → STT → LLM → TTS → áudio
"""

import asyncio
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")

router = APIRouter(prefix="/voice", dependencies=[Depends(require_bearer_token)])
chat_voice_router = APIRouter(dependencies=[Depends(require_bearer_token)])


def _has_command(cmd: str) -> bool:
    return shutil.which(cmd) is not None


# ---------------------------------------------------------------------------
# GET /voice/status
# ---------------------------------------------------------------------------

@router.get("/status")
async def voice_status(request: Request):
    """Status do pipeline de voz: STT + TTS."""
    stt = getattr(request.app.state, "stt_service", None)
    tts = getattr(request.app.state, "tts_service", None)

    stt_status = stt.status() if stt else {"available": False, "engine": "none"}
    tts_status = tts.status() if tts else {"available": False}

    return {
        "success": True,
        "data": {
            "stt": {**stt_status, "whisper_cli": _has_command("whisper-cpp") or _has_command("whisper")},
            "tts": {**tts_status, "macos_say": _has_command("say"), "edge_tts": tts.available if tts else False},
            "pipeline_ready": (tts.available if tts else False),
        },
    }


# ---------------------------------------------------------------------------
# GET /voice/voices
# ---------------------------------------------------------------------------

@router.get("/voices")
async def list_voices(request: Request):
    """Lista vozes pt-BR disponíveis no edge-tts."""
    tts = getattr(request.app.state, "tts_service", None)
    if not tts or not tts.available:
        return {"success": False, "error": "edge-tts não disponível", "data": {"voices": []}}

    voices = await tts.list_voices()
    return {"success": True, "data": {"voices": voices, "default": tts.DEFAULT_VOICE}}


# ---------------------------------------------------------------------------
# GET /voice/capabilities  (mantém compat)
# ---------------------------------------------------------------------------

@router.get("/capabilities")
async def voice_capabilities(request: Request):
    """Detecta o que está disponível no servidor."""
    has_whisper = _has_command("whisper-cpp") or _has_command("whisper")
    has_ffmpeg = _has_command("ffmpeg")
    has_say = _has_command("say")
    tts = getattr(request.app.state, "tts_service", None)
    has_edge_tts = tts.available if tts else False

    return {"success": True, "data": {
        "stt": {
            "whisper": has_whisper,
            "web_speech_api": True,
            "recommended": "web_speech_api",  # always prefer browser STT
        },
        "tts": {
            "edge_tts": has_edge_tts,
            "macos_say": has_say,
            "web_speech_api": True,
            "recommended": "edge_tts" if has_edge_tts else ("macos_say" if has_say else "web_speech_api"),
        },
        "ffmpeg": has_ffmpeg,
    }}


# ---------------------------------------------------------------------------
# POST /voice/transcribe  — Whisper (backend STT, fallback when no Web Speech)
# ---------------------------------------------------------------------------

@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(...),
    language: str = "pt",
):
    """Transcreve áudio → texto via Whisper local. Use Web Speech API no browser quando possível."""
    # Try STTService first (faster-whisper)
    stt = getattr(request.app.state, "stt_service", None)
    if stt and stt.available:
        content = await file.read()
        result = await stt.transcribe(content, language=language)
        if result.get("text"):
            return {"success": True, "data": {"transcript": result["text"], "language": language, "engine": result.get("engine", "whisper")}}

    # Fallback: whisper CLI
    whisper_cmd = "whisper-cpp" if _has_command("whisper-cpp") else ("whisper" if _has_command("whisper") else None)
    if not whisper_cmd:
        return {
            "success": False,
            "error": "Nenhum motor de STT disponível no servidor. Use Web Speech API no navegador.",
            "data": {"fallback": "web_speech_api"},
        }

    tmp_dir = tempfile.mkdtemp()
    try:
        suffix = Path(file.filename or "audio.webm").suffix or ".webm"
        input_path = os.path.join(tmp_dir, f"input{suffix}")
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)

        wav_path = os.path.join(tmp_dir, "audio.wav")
        if not input_path.endswith(".wav"):
            if not _has_command("ffmpeg"):
                return {"success": False, "error": "ffmpeg necessário para converter áudio. Instale: brew install ffmpeg"}
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=15.0)
            if proc.returncode != 0:
                return {"success": False, "error": "Conversão ffmpeg falhou"}
        else:
            wav_path = input_path

        proc = await asyncio.create_subprocess_exec(
            whisper_cmd, "--model", "base", "--language", language, "--file", wav_path,
            "--output-txt", "--no-timestamps",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        text = stdout.decode(errors="replace").strip()

        txt_path = wav_path.replace(".wav", ".txt")
        if not text and os.path.exists(txt_path):
            text = open(txt_path).read().strip()

        return {"success": True, "data": {"transcript": text, "language": language, "engine": whisper_cmd}}
    except asyncio.TimeoutError:
        return {"success": False, "error": "Transcrição timeout"}
    except Exception as exc:
        logger.error("[VoiceAPI] Transcribe error: %s", exc)
        return {"success": False, "error": str(exc)}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# POST /voice/synthesize  — edge-tts (TTS principal)
# ---------------------------------------------------------------------------

class SynthesizeBody(BaseModel):
    text: str
    voice: Optional[str] = None
    rate: Optional[str] = "+0%"   # e.g. "+10%", "-5%"
    pitch: Optional[str] = "+0Hz"


@router.post("/synthesize")
async def synthesize_speech(body: SynthesizeBody, request: Request):
    """Converte texto → áudio mp3 via edge-tts (pt-BR-FranciscaNeural)."""
    tts = getattr(request.app.state, "tts_service", None)
    if not tts or not tts.available:
        return Response(
            content='{"error":"edge-tts não disponível. Instale: pip install edge-tts"}',
            status_code=503,
            media_type="application/json",
        )

    text = body.text.strip()
    if not text:
        return Response(content='{"error":"texto vazio"}', status_code=400, media_type="application/json")

    # Truncate long text to avoid timeouts
    if len(text) > 2000:
        text = text[:2000] + "..."

    try:
        import edge_tts
        voice = body.voice or tts.DEFAULT_VOICE
        communicate = edge_tts.Communicate(text, voice, rate=body.rate or "+0%", pitch=body.pitch or "+0Hz")

        audio_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        audio_bytes = b"".join(audio_chunks)
        if not audio_bytes:
            return Response(content='{"error":"TTS produziu 0 bytes"}', status_code=500, media_type="application/json")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="speech.mp3"',
                "Cache-Control": "no-store",
                "X-Voice": voice,
            },
        )
    except Exception as exc:
        logger.error("[VoiceAPI] Synthesize error: %s", exc)
        return Response(
            content=f'{{"error":"{str(exc)}"}}',
            status_code=500,
            media_type="application/json",
        )


# ---------------------------------------------------------------------------
# POST /voice/speak  — macOS say (legado, mantém compat)
# ---------------------------------------------------------------------------

class SpeakBody(BaseModel):
    text: str
    voice: Optional[str] = "Luciana"
    rate: Optional[int] = 200


@router.post("/speak")
async def text_to_speech_legacy(body: SpeakBody, request: Request):
    """TTS via macOS say (legado). Prefira /voice/synthesize."""
    if not _has_command("say"):
        return {"success": False, "error": "macOS say não disponível.", "data": {"fallback": "synthesize"}}

    tmp_dir = tempfile.mkdtemp()
    try:
        output_path = os.path.join(tmp_dir, "speech.aiff")
        proc = await asyncio.create_subprocess_exec(
            "say", "-v", body.voice or "Luciana", "-r", str(body.rate or 200),
            "-o", output_path, body.text,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30.0)

        if not os.path.exists(output_path):
            return {"success": False, "error": "TTS falhou ao gerar saída"}

        wav_path = os.path.join(tmp_dir, "speech.wav")
        if _has_command("ffmpeg"):
            proc2 = await asyncio.create_subprocess_exec(
                "ffmpeg", "-i", output_path, "-ar", "22050", "-ac", "1", wav_path,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc2.communicate()
            if os.path.exists(wav_path):
                return FileResponse(wav_path, media_type="audio/wav", filename="speech.wav")

        return FileResponse(output_path, media_type="audio/aiff", filename="speech.aiff")
    except Exception as exc:
        logger.error("[VoiceAPI] Speak error: %s", exc)
        return Response(content=str(exc), status_code=500)


# ---------------------------------------------------------------------------
# POST /chat/voice  — pipeline unificado: áudio → STT → LLM → TTS → áudio
# ---------------------------------------------------------------------------

@chat_voice_router.post("/chat/voice", dependencies=[Depends(require_bearer_token)])
async def voice_chat_pipeline(
    request: Request,
    file: UploadFile = File(...),
    session_id: Optional[str] = None,
    voice: Optional[str] = None,
    language: str = "pt",
):
    """
    Pipeline unificado de voz:
    1. Áudio → transcrição (STT: Web Speech API no front, Whisper se enviado pelo back)
    2. Texto → BrainRouter → resposta da Aura
    3. Resposta → edge-tts → áudio mp3
    Retorna JSON: {transcript, response, audio_url} + X-Transcript header
    """
    # 1. STT — transcrever o áudio enviado
    transcript = ""
    stt = getattr(request.app.state, "stt_service", None)

    content = await file.read()
    if stt and stt.available and content:
        result = await stt.transcribe(content, language=language)
        transcript = result.get("text", "").strip()

    if not transcript:
        # Fallback: try whisper CLI
        whisper_cmd = "whisper-cpp" if _has_command("whisper-cpp") else ("whisper" if _has_command("whisper") else None)
        if whisper_cmd and content:
            tmp_dir = tempfile.mkdtemp()
            try:
                suffix = Path(file.filename or "audio.webm").suffix or ".webm"
                input_path = os.path.join(tmp_dir, f"input{suffix}")
                with open(input_path, "wb") as f:
                    f.write(content)
                wav_path = os.path.join(tmp_dir, "audio.wav")
                if _has_command("ffmpeg"):
                    proc = await asyncio.create_subprocess_exec(
                        "ffmpeg", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                    )
                    await asyncio.wait_for(proc.communicate(), timeout=15.0)
                else:
                    wav_path = input_path
                proc = await asyncio.create_subprocess_exec(
                    whisper_cmd, "--model", "base", "--language", language, "--file", wav_path,
                    "--output-txt", "--no-timestamps",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30.0)
                transcript = stdout.decode(errors="replace").strip()
                txt_path = wav_path.replace(".wav", ".txt")
                if not transcript and os.path.exists(txt_path):
                    transcript = open(txt_path).read().strip()
            except Exception as exc:
                logger.warning("[VoicePipeline] STT fallback failed: %s", exc)
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)

    if not transcript:
        return {"success": False, "error": "Não foi possível transcrever o áudio. Use Web Speech API no navegador."}

    # 2. LLM — processar via chat router (BrainRouter + resposta)
    response_text = ""
    try:
        brain_router = getattr(request.app.state, "brain_router", None)
        ollama_service = getattr(request.app.state, "ollama_service", None)
        claude_client = getattr(request.app.state, "claude_client", None)
        behavior_service = getattr(request.app.state, "behavior_service", None)
        context_service = getattr(request.app.state, "context_service", None)

        runtime_context = {}
        if context_service:
            runtime_context = context_service.build_chat_runtime_context(
                session_id=session_id or "voice-session",
                message=transcript,
                project_id=None,
            )

        system_prompt = ""
        if behavior_service:
            system_prompt = behavior_service.build_chat_prompt(
                runtime_context.get("context_summary", ""),
                runtime_context.get("memory_prompt_points", []),
                "companion",
            )

        use_cloud = False
        if brain_router:
            route = brain_router.classify(transcript)
            brain_router.track_classification(route["complexity"])
            use_cloud = route["target"].value == "cloud" and claude_client and claude_client.available

        if use_cloud:
            result = await claude_client.chat(
                messages=[{"role": "user", "content": transcript}],
                system_prompt=system_prompt,
            )
            response_text = result["content"]
            from app.services.brain_router import BrainTarget
            brain_router.track_usage(BrainTarget.CLOUD)
        elif ollama_service:
            response_text = await ollama_service.generate(
                message=transcript,
                system_prompt=system_prompt,
                think=False,
            )
            if brain_router:
                from app.services.brain_router import BrainTarget
                brain_router.track_usage(BrainTarget.LOCAL)
    except Exception as exc:
        logger.error("[VoicePipeline] LLM error: %s", exc)
        response_text = "Desculpe, houve um erro ao processar sua mensagem."

    # 3. TTS — sintetizar resposta
    audio_bytes = b""
    tts = getattr(request.app.state, "tts_service", None)
    if tts and tts.available and response_text:
        try:
            import edge_tts
            selected_voice = voice or tts.DEFAULT_VOICE
            communicate = edge_tts.Communicate(response_text[:1500], selected_voice)
            chunks: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio_bytes = b"".join(chunks)
        except Exception as exc:
            logger.warning("[VoicePipeline] TTS error: %s", exc)

    # Return JSON with audio embedded as base64 if available
    import base64
    return {
        "success": True,
        "data": {
            "transcript": transcript,
            "response": response_text,
            "audio_b64": base64.b64encode(audio_bytes).decode() if audio_bytes else None,
            "audio_mime": "audio/mpeg" if audio_bytes else None,
            "has_audio": bool(audio_bytes),
        },
    }
