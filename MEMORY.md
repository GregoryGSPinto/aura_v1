# AURA Memory

## Memory layers

Aura agora possui uma base de memória em camadas, mantida sem quebrar o modo local-first:

- `short_term`
  - interações recentes
  - contexto imediato do agent loop
- `episodic`
  - eventos, jobs e execuções relevantes
- `semantic`
  - preferências do usuário e conhecimento persistido
- `vector_memory`
  - índice inicial em memória preparado para Chroma ou pgvector

## Current implementation

Current runtime files:

- [`aura/backend/app/aura_os/memory/short_term.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/memory/short_term.py)
- [`aura/backend/app/aura_os/memory/long_term.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/memory/long_term.py)
- [`aura/backend/app/aura_os/memory/vector_store.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/memory/vector_store.py)
- [`aura/backend/app/aura_os/memory/manager.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/memory/manager.py)

## Production evolution path

1. keep local JSON as source of truth for local-first mode
2. move episodic and semantic memory to Postgres / Supabase
3. attach pgvector or Chroma for semantic recall
4. add embedding providers and retrieval ranking
