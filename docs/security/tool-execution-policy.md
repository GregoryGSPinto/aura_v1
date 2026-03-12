# Tool Execution Policy

## Principios

- nenhuma tool recebe poder irrestrito
- toda execucao exige allowlist explicita
- parametros devem ser validados
- efeitos colaterais precisam de auditoria
- defaults devem negar

## Regras atuais

- terminal: apenas acoes mapeadas e `cwd` dentro de roots permitidas
- projects: apenas scripts `dev`, `lint`, `build`, `test`, `typecheck`
- filesystem: leitura e busca apenas em roots autorizadas
- browser: apenas URLs `http/https`
- command service: whitelist de comandos do produto

## Evolucao recomendada

- policy engine por contexto e papel
- quotas por tool
- confirmacao humana para acoes destrutivas
- dry-run para fluxos de maior impacto
- sandbox forte para execucoes externas
