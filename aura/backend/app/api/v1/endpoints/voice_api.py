"""
Voice API:
- POST /api/v1/voice/transcribe — recebe áudio, retorna texto (Whisper)
- POST /api/v1/voice/speak — recebe texto, retorna áudio (TTS via macOS say)
- GET  /api/v1/voice/capabilities — what's available
"""

import asyncio
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core.security import require_bearer_token

logger = logging.getLogger("aura")
router = APIRouter(prefix="/voice", dependencies=[Depends(require_bearer_token)])


def _has_command(cmd: str) -> bool:
    return shutil.which(cmd) is not None


@router.get("/capabilities")
async def voice_capabilities(request: Request):
    """Report what voice features are available."""
    has_whisper = _has_command("whisper-cpp") or _has_command("whisper")
    has_ffmpeg = _has_command("ffmpeg")
    has_say = _has_command("say")

    return {"success": True, "data": {
        "stt": {
            "whisper": has_whisper,
            "web_speech_api": True,  # Always available in browser
            "recommended": "whisper" if has_whisper else "web_speech_api",
        },
        "tts": {
            "macos_say": has_say,
            "web_speech_api": True,
            "recommended": "macos_say" if has_say else "web_speech_api",
        },
        "ffmpeg": has_ffmpeg,
    }}


@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(...),
    language: str = "pt",
):
    """Transcribe audio to text using Whisper or ffmpeg+whisper."""
    whisper_cmd = "whisper-cpp" if _has_command("whisper-cpp") else ("whisper" if _has_command("whisper") else None)

    if not whisper_cmd:
        return {"success": False, "error": "whisper-cpp not installed. Use Web Speech API in browser instead.",
                "data": {"fallback": "web_speech_api"}}

    tmp_dir = tempfile.mkdtemp()
    try:
        # Save uploaded file
        input_path = os.path.join(tmp_dir, f"input{Path(file.filename or 'audio.webm').suffix}")
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Convert to wav if not already
        wav_path = os.path.join(tmp_dir, "audio.wav")
        if not input_path.endswith(".wav"):
            if not _has_command("ffmpeg"):
                return {"success": False, "error": "ffmpeg needed to convert audio. Install: brew install ffmpeg"}
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=15.0)
            if proc.returncode != 0:
                return {"success": False, "error": "ffmpeg conversion failed"}
        else:
            wav_path = input_path

        # Run whisper
        proc = await asyncio.create_subprocess_exec(
            whisper_cmd, "--model", "base", "--language", language, "--file", wav_path,
            "--output-txt", "--no-timestamps",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        text = stdout.decode(errors="replace").strip()

        # Try to read output txt file if stdout is empty
        txt_path = wav_path.replace(".wav", ".txt")
        if not text and os.path.exists(txt_path):
            text = open(txt_path).read().strip()

        if not text:
            text = stderr.decode(errors="replace").strip()

        return {"success": True, "data": {"text": text, "language": language}}
    except asyncio.TimeoutError:
        return {"success": False, "error": "Transcription timed out"}
    except Exception as exc:
        logger.error("[VoiceAPI] Transcribe error: %s", exc)
        return {"success": False, "error": str(exc)}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


class SpeakBody(BaseModel):
    text: str
    voice: Optional[str] = "Luciana"
    rate: Optional[int] = 200


@router.post("/speak")
async def text_to_speech(body: SpeakBody, request: Request):
    """Convert text to speech using macOS say command."""
    if not _has_command("say"):
        return {"success": False, "error": "macOS say not available. Use Web Speech API in browser.",
                "data": {"fallback": "web_speech_api"}}

    tmp_dir = tempfile.mkdtemp()
    try:
        output_path = os.path.join(tmp_dir, "speech.aiff")

        proc = await asyncio.create_subprocess_exec(
            "say", "-v", body.voice or "Luciana",
            "-r", str(body.rate or 200),
            "-o", output_path,
            body.text,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30.0)

        if not os.path.exists(output_path):
            return {"success": False, "error": "TTS failed to produce output"}

        # Convert to wav if ffmpeg available for broader compatibility
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
