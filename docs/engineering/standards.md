# Engineering Standards

## Arquitetura modular

- separe experiência, API, serviços de aplicação e Aura OS
- mantenha Aura OS como orquestrador, não como substituto indiscriminado dos serviços existentes
- introduza novas capacidades como módulos coesos e observáveis

## Separação de responsabilidades

- endpoints recebem e validam requisições
- services implementam regras operacionais
- Aura OS compõe raciocínio, roteamento e execução
- tools encapsulam superfícies de ação

## Naming conventions

- use nomes descritivos e consistentes com o domínio
- preserve a taxonomia oficial: `Aura`, `Aura OS`, `runtime`, `tool`, `job`, `planner`
- evite arquivos ambíguos, duplicados ou com sufixos como `cópia`

## Logging

- logs devem ser estruturados e úteis para diagnóstico
- ações operacionais relevantes devem ser auditadas
- evite mensagens vagas ou não acionáveis

## Tratamento de erros

- exponha erros de API com estrutura consistente
- diferencie falhas de validação, integração, timeout e autorização
- degrade com segurança quando dependências opcionais estiverem indisponíveis

## Configuração e secrets

- toda configuração deve ser orientada por ambiente
- não acople scripts ou docs a caminhos absolutos da máquina do autor
- segredos nunca devem ser versionados

## Testabilidade

- prefira módulos pequenos e injetáveis
- cubra fluxos críticos de comando, jobs, memória, router e endpoints
- valide comportamento, não apenas implementação

## Segurança de execução de comandos

- nenhuma entrada de usuário deve virar shell arbitrário
- comandos devem passar por allowlist, validação e timeout
- mantenha raízes permitidas, limites de leitura e bloqueios destrutivos explícitos
