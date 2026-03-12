# Voice Runtime

## Pipeline

`microphone -> wake word -> STT -> agent loop -> TTS`

## Componentes

- `app/aura_os/voice/audio_engine/microphone_stream.py`
- `app/aura_os/voice/wakeword/wake_detector.py`
- `app/aura_os/voice/stt/whisper_engine.py`
- `app/aura_os/voice/tts/tts_engine.py`
- `app/aura_os/voice/voice_bridge.py`
- `app/aura_os/voice/pipeline.py`

## Objetivo

O voice runtime prepara Aura para uma experiência mais contínua e menos dependente de teclado, sem abrir mão de controle local e modularidade.

## Estado atual

- wake word configurado para `Aura`
- STT preparado com interface local e caminho de evolução para Whisper
- TTS com fallback em `say` no macOS
- dispatch para o runtime principal já integrado

## Evolução prevista

- STT local mais robusto
- TTS com vozes configuráveis
- detecção de contexto para ativação de voz
- observabilidade específica do pipeline de áudio
