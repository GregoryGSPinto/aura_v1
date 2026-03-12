# Contribuindo para Aura

Aura é desenvolvido como produto operacional. Toda contribuição deve preservar segurança, clareza arquitetural e compatibilidade com o runtime existente.

## Convenções de branch

- `main`: branch estável
- `feat/<tema>`: novas capacidades
- `fix/<tema>`: correções
- `refactor/<tema>`: refatorações sem mudança funcional intencional
- `docs/<tema>`: documentação
- `chore/<tema>`: manutenção

## Padrão de commit

Adote commits curtos, objetivos e rastreáveis:

- `feat: add safe job retry flow`
- `fix: handle ollama timeout in chat endpoint`
- `refactor: split command validation from execution`
- `docs: update deployment runbook`

## Fluxo de pull request

1. Atualize sua branch a partir de `main`.
2. Implemente uma mudança coesa e limitada por escopo.
3. Execute validações locais aplicáveis.
4. Abra PR com contexto, impacto e riscos.
5. Aguarde revisão antes de merge.

## Revisão de código

Toda PR deve explicitar:

- problema resolvido
- decisão técnica adotada
- impacto em segurança operacional
- impacto em compatibilidade
- evidência de teste ou validação

Mudanças em execução de comandos, autenticação, persistência, roteamento de modelos e memória exigem revisão especialmente cuidadosa.

## Qualidade mínima

- nenhuma mudança deve introduzir caminhos absolutos locais
- nomes devem seguir taxonomia do produto e da arquitetura
- logs e erros devem permanecer úteis para operação
- código novo deve respeitar separação de responsabilidades
- documentação deve ser atualizada quando a arquitetura, operação ou posicionamento mudar

## Validações esperadas

Backend:

- `cd aura/backend && pytest`

Frontend:

- `cd aura/frontend && pnpm lint`
- `cd aura/frontend && pnpm typecheck`
- `cd aura/frontend && pnpm build`

## Segurança operacional

- não introduza execução arbitrária de shell a partir de prompts
- preserve allowlists, bloqueios e trilhas de auditoria
- mantenha segredos fora do repositório
- trate integrações externas como opcionais e degradáveis
