# Tools Architecture

## Registro canônico

O registro principal de ferramentas está em:

- `app/aura_os/tools/registry.py`
- `app/aura_os/tools/permissions.py`

## Grupos atuais

- `system_tool`: métricas, saúde e telemetria básica
- `browser_tool`: abertura controlada de URLs e hosts locais
- `filesystem_tool`: leitura, listagem e busca em escopo permitido
- `project_tool`: navegação, inspeção e operações ligadas a projetos
- `terminal_tool`: comandos aprovados para fluxos de desenvolvimento
- `vscode_tool`: abertura de app, paths e arquivos
- `llm_tool`: chat, síntese e análise assistida

## Regras de segurança

- nenhuma execução arbitrária de shell a partir de prompts
- padrões destrutivos continuam bloqueados
- ações operacionais precisam ser auditáveis
- escopos de acesso devem permanecer explícitos

## Direção futura

- ferramentas orientadas a calendário, e-mail e pesquisa enriquecida
- maior separação entre tools de leitura, decisão e ação
- políticas mais granulares por perfil de runtime
