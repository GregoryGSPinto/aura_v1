# Memory Architecture

## Camadas de memória

- `short-term`: interações recentes e contexto imediato
- `episodic`: eventos, jobs e execuções relevantes
- `semantic`: preferências, fatos persistidos e contexto durável
- `vector`: base preparada para recuperação semântica futura

## Implementação atual

- `app/aura_os/memory/short_term.py`
- `app/aura_os/memory/long_term.py`
- `app/aura_os/memory/vector_store.py`
- `app/aura_os/memory/manager.py`

O runtime atual preserva o modo local-first e usa os serviços de persistência já existentes para manter compatibilidade com a base funcional.

## Princípios

- memória deve servir à operação, não apenas ao histórico
- contexto precisa ser útil, rastreável e degradável
- evolução para camadas mais sofisticadas não pode quebrar o modo local

## Próximos passos

- fortalecer memória episódica para jobs e decisões
- enriquecer persistência semântica
- conectar store vetorial a provedores de embedding
- expandir recall contextual com critérios explícitos
