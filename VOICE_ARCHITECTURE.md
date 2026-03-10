# Voice Runtime v1

## Pipeline

`microphone -> wake word -> STT -> agent loop -> TTS`

## Modules

- [`aura/backend/app/aura_os/voice/audio_engine/microphone_stream.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/voice/audio_engine/microphone_stream.py)
- [`aura/backend/app/aura_os/voice/wakeword/wake_detector.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/voice/wakeword/wake_detector.py)
- [`aura/backend/app/aura_os/voice/stt/whisper_engine.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/voice/stt/whisper_engine.py)
- [`aura/backend/app/aura_os/voice/tts/tts_engine.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/voice/tts/tts_engine.py)
- [`aura/backend/app/aura_os/voice/voice_bridge.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/voice/voice_bridge.py)

## Current behavior

- wake word: `Aura`
- STT: local text/hint fallback interface prepared for Whisper
- TTS: macOS `say` as runtime v1
- voice bridge: dispatches spoken command into the existing agent runtime

## Why this shape

The runtime is already usable locally, but keeps clean interfaces so Whisper, Piper or Coqui can replace the fallback engines without changing the rest of the architecture.
