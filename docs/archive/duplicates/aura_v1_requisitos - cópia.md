# 2. Objetivos e Requisitos

## 2.1 Objetivos do Sistema

| ID | Objetivo | Métrica de Sucesso |
|:---|:---------|:-------------------|
| OBJ-001 | Permitir comunicação conversacional entre usuário (iPhone) e assistente (Mac) via navegador | 100% das mensagens enviadas pelo iPhone devem ser recebidas e processadas pelo Mac em menos de 3 segundos |
| OBJ-002 | Interpretar intenções do usuário via LLM local e traduzir em ações executáveis | Taxa de acerto na interpretação de comandos ≥ 85% em cenários de teste pré-definidos |
| OBJ-003 | Executar comandos operacionais no Mac de forma controlada e auditável | 100% dos comandos executados devem ser registrados em logs com timestamp e contexto |
| OBJ-004 | Garantir segurança na execução de comandos através de lista de permissões e bloqueios | Zero execução de comandos não autorizados ou classificados como perigosos |
| OBJ-005 | Fornecer respostas em português natural com contexto das ações executadas | Tempo médio de resposta do sistema ≤ 5 segundos para comandos simples |

---

## 2.2 Requisitos Funcionais

### 2.2.1 Chat/Conversa

| ID | Descrição | Prioridade |
|:---|:----------|:-----------|
| RF-001 | O sistema deve permitir que o usuário envie mensagens de texto via navegador do iPhone | Alta |
| RF-002 | O sistema deve permitir que o usuário envie mensagens de texto via navegador do Mac | Alta |
| RF-003 | O sistema deve processar mensagens do usuário através de LLM local (Ollama + Qwen) | Alta |
| RF-004 | O sistema deve interpretar a intenção do usuário e classificar o tipo de ação solicitada | Alta |
| RF-005 | O sistema deve responder ao usuário em português, confirmando ações executadas ou solicitando esclarecimentos | Alta |
| RF-006 | O sistema deve manter histórico de conversas da sessão atual (memória curta) | Média |
| RF-007 | O sistema deve exibir indicador visual de "pensando" durante processamento do LLM | Média |

### 2.2.2 Execução de Comandos

| ID | Descrição | Prioridade |
|:---|:----------|:-----------|
| RF-008 | O sistema deve validar comandos solicitados contra lista de comandos pré-aprovados | Alta |
| RF-009 | O sistema deve bloquear automaticamente comandos classificados como perigosos (rm -rf, format, etc.) | Alta |
| RF-010 | O sistema deve executar comandos aprovados via subprocess Python no Mac | Alta |
| RF-011 | O sistema deve capturar e retornar output (stdout/stderr) dos comandos executados | Alta |
| RF-012 | O sistema deve permitir execução de comandos com timeout configurável (padrão: 30s) | Média |
| RF-013 | O sistema deve suportar execução de comandos em diretórios de trabalho específicos | Média |
| RF-014 | O sistema deve permitir ao administrador adicionar/remover comandos da lista de permissões | Média |

### 2.2.3 Gerenciamento de Projetos

| ID | Descrição | Prioridade |
|:---|:----------|:-----------|
| RF-015 | O sistema deve permitir abrir o VS Code com comando "abrir VS Code" ou similar | Alta |
| RF-016 | O sistema deve permitir abrir pasta/projeto específico no VS Code | Alta |
| RF-017 | O sistema deve listar projetos disponíveis no diretório de trabalho configurado | Média |
| RF-018 | O sistema deve permitir navegação entre pastas do sistema de arquivos | Média |
| RF-019 | O sistema deve permitir checar status de repositórios Git (branch, status, último commit) | Média |
| RF-020 | O sistema deve permitir abrir projetos por nome ou palavra-chave | Baixa |

### 2.2.4 Segurança e Autenticação

| ID | Descrição | Prioridade |
|:---|:----------|:-----------|
| RF-021 | O sistema deve exigir autenticação simples (token ou senha) para acesso ao chat | Alta |
| RF-022 | O sistema deve registrar todos os comandos executados em arquivo de log | Alta |
| RF-023 | O sistema deve registrar timestamp, usuário, comando e resultado de cada ação | Alta |
| RF-024 | O sistema deve requerer confirmação explícita para comandos destrutivos (quando implementados em versões futuras) | Média |
| RF-025 | O sistema deve limitar taxa de requisições (rate limiting) para prevenir abuso | Média |
| RF-026 | O sistema deve permitir visualização de logs de auditoria pelo administrador | Baixa |

---

## 2.3 Requisitos Não-Funcionais

### 2.3.1 Performance

| ID | Descrição | Critério Mensurável |
|:---|:----------|:--------------------|
| RNF-001 | Tempo de resposta do LLM para interpretação | ≤ 3 segundos para prompts de até 100 tokens |
| RNF-002 | Tempo total de processamento (recepção à resposta) | ≤ 5 segundos para comandos simples |
| RNF-003 | Tempo de execução de comandos no Mac | ≤ 10 segundos para comandos não interativos |
| RNF-004 | Capacidade de conexões simultâneas | Suportar até 5 conexões WebSocket simultâneas |
| RNF-005 | Uso de memória RAM pelo backend | ≤ 512 MB em operação normal |

### 2.3.2 Segurança

| ID | Descrição | Critério Mensurável |
|:---|:----------|:--------------------|
| RNF-006 | Bloqueio de comandos perigosos | 100% dos comandos na blacklist devem ser bloqueados |
| RNF-007 | Validação de comandos permitidos | Apenas comandos na whitelist podem ser executados |
| RNF-008 | Proteção de credenciais | Tokens e senhas nunca devem ser expostos em logs ou respostas |
| RNF-009 | Isolamento de execução | Comandos devem executar com privilégios mínimos necessários |
| RNF-010 | Retenção de logs | Logs devem ser mantidos por no mínimo 30 dias |

### 2.3.3 Usabilidade

| ID | Descrição | Critério Mensurável |
|:---|:----------|:--------------------|
| RNF-011 | Interface responsiva | Frontend deve funcionar em telas de 320px a 1920px |
| RNF-012 | Compatibilidade de navegadores | Suporte a Safari (iOS), Chrome e Firefox nas últimas 2 versões |
| RNF-013 | Linguagem das respostas | 100% das respostas do sistema em português do Brasil |
| RNF-014 | Clareza das mensagens de erro | Mensagens de erro devem ser compreensíveis para usuários não-técnicos |
| RNF-015 | Feedback visual de ações | Interface deve indicar status de processamento e conclusão |

### 2.3.4 Confiabilidade

| ID | Descrição | Critério Mensurável |
|:---|:----------|:--------------------|
| RNF-016 | Disponibilidade do serviço | Backend deve estar disponível 99% do tempo quando Mac estiver ligado |
| RNF-017 | Recuperação de falhas | Sistema deve recuperar-se automaticamente de erros de subprocess |
| RNF-018 | Persistência de dados | Configurações e logs devem persistir entre reinicializações |
| RNF-019 | Graceful degradation | Se LLM falhar, sistema deve informar usuário e não travar |
| RNF-020 | Timeout de operações | Operações que excedam timeout devem ser canceladas e notificadas |

---

## 2.4 Restrições e Premissas

### 2.4.1 Restrições Técnicas

- **RT-001**: O LLM deve rodar localmente via Ollama, sem dependência de APIs externas
- **RT-002**: O backend deve ser implementado em Python com FastAPI
- **RT-003**: O sistema operacional do servidor (Mac) deve ser macOS 12.0 ou superior
- **RT-004**: O frontend deve ser acessível via navegador, sem necessidade de app nativo
- **RT-005**: Armazenamento de dados deve utilizar SQLite ou arquivos JSON
- **RT-006**: A comunicação entre iPhone e Mac deve ocorrer via rede local (mesma WiFi) ou VPN

### 2.4.2 Restrições de Escopo (v1)

- **RE-001**: Não haverá suporte a comandos de voz na v1
- **RE-002**: Não haverá integração com WhatsApp ou outras mensageiras
- **RE-003**: Não haverá automação de dispositivos domésticos (IoT)
- **RE-004**: Não haverá app nativo para iOS na v1 (apenas web)
- **RE-005**: Não haverá memória vetorial avançada ou RAG na v1
- **RE-006**: Não haverá persistência de histórico entre sessões na v1
- **RE-007**: Não haverá suporte a múltiplos usuários simultâneos na v1

### 2.4.3 Premissas do Projeto

- **PR-001**: O Mac servidor estará ligado e conectado à rede durante o uso
- **PR-002**: O iPhone e o Mac estarão na mesma rede local ou conectados via VPN
- **PR-003**: O usuário possui permissões administrativas no Mac para instalação
- **PR-004**: Ollama estará previamente instalado e configurado no Mac
- **PR-005**: O modelo Qwen estará disponível e funcional no Ollama
- **PR-006**: O usuário possui conhecimento básico de comandos de terminal
- **PR-007**: O VS Code está instalado no Mac para funcionalidades relacionadas

---

## 2.5 Matriz de Rastreabilidade Resumida

| Objetivo | RFs Relacionados | RNFs Relacionados |
|:---------|:-----------------|:------------------|
| OBJ-001 | RF-001, RF-002, RF-005 | RNF-011, RNF-012 |
| OBJ-002 | RF-003, RF-004 | RNF-001, RNF-013 |
| OBJ-003 | RF-008, RF-009, RF-010, RF-011 | RNF-002, RNF-003, RNF-019 |
| OBJ-004 | RF-021, RF-022, RF-023 | RNF-006, RNF-007, RNF-008, RNF-009, RNF-010 |
| OBJ-005 | RF-005, RF-007 | RNF-001, RNF-013, RNF-014 |
