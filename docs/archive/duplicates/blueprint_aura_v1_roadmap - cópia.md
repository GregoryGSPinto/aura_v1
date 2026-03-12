# Roadmap de Implementação - Aura v1

## 1. Visão Geral do Roadmap

### Timeline de Fases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROADMAP AURA v1 - 16 SEMANAS                        │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│   SPRINT 1  │   SPRINT 2  │   SPRINT 3  │   SPRINT 4  │      FUTURO         │
│  Backend    │   Web UI    │  Executor   │   Remoto    │    (v2+)            │
│  Core       │   Mobile    │  Projetos   │   Público   │                     │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│ Semanas 1-4 │ Semanas 5-8 │ Semanas 9-12│ Semanas13-16│    Pós v1           │
│             │             │             │             │                     │
│ ████████████│ ████████████│ ████████████│ ████████████│  ░░░░░░░░░░░░░░░░   │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
```

### Resumo por Fase

| Fase | Período | Foco Principal | Estado Alvo |
|------|---------|----------------|-------------|
| **Fase 1** | Semanas 1-4 | Fundação técnica | Backend estável, API REST |
| **Fase 2** | Semanas 5-8 | Experiência do usuário | Interface web, mobile, auth |
| **Fase 3** | Semanas 9-12 | Automação operacional | Executor de projetos completo |
| **Fase 4** | Semanas 13-16 | Acesso universal | Deploy remoto, segurança |

### Estimativa Total

| Métrica | Valor |
|---------|-------|
| **Duração Total** | 16 semanas (4 meses) |
| **Sprints** | 4 sprints de 4 semanas |
| **Horas Estimadas** | 320-400h (20-25h/semana) |
| **MVP Funcional** | Semana 8 |
| **v1.0 Completa** | Semana 16 |

---

## 2. Sprints Detalhados

---

### Sprint 1: Fundação Backend

| Atributo | Valor |
|----------|-------|
| **Duração** | 4 semanas |
| **Objetivo** | Estabilizar arquitetura backend, estruturar APIs e estabelecer base de dados |
| **Squad** | 1 desenvolvedor backend |
| **Stack Principal** | FastAPI, SQLite, Ollama |

#### Entregáveis

- [ ] **Estruturação de Rotas**: Separar endpoints em módulos (`/chat`, `/command`, `/projects`, `/system`)
- [ ] **Endpoint `/command`**: Implementar processamento de comandos pré-aprovados
- [ ] **Cadastro de Projetos**: CRUD completo de projetos com metadados
- [ ] **Integração Ollama**: Cliente robusto para comunicação com Qwen2.5
- [ ] **Modelo de Dados**: Esquema SQLite para projetos, comandos e logs
- [ ] **Configuração Centralizada**: Sistema de settings e variáveis de ambiente
- [ ] **Logging Estruturado**: Sistema de logs com níveis e rotação
- [ ] **Testes Unitários**: Cobertura mínima de 70% para serviços críticos

#### Critérios de Aceitação

1. Todas as rotas respondem com status HTTP adequados e JSON estruturado
2. Endpoint `/command` processa e persiste comandos com validação de segurança
3. CRUD de projetos permite cadastrar, listar, editar e remover projetos
4. Integração com Ollama responde em < 3s para prompts simples
5. Logs são gravados em arquivo com rotação diária
6. Suite de testes passa com `pytest` sem falhas
7. Documentação OpenAPI (Swagger) disponível em `/docs`

#### Dependências de Entrada
- Nenhuma (sprint inicial)

---

### Sprint 2: Interface Web e Acesso Mobile

| Atributo | Valor |
|----------|-------|
| **Duração** | 4 semanas |
| **Objetivo** | Criar interface web funcional, habilitar acesso mobile e implementar autenticação |
| **Squad** | 1 desenvolvedor fullstack |
| **Stack Principal** | Next.js, Tailwind CSS, JWT |

#### Entregáveis

- [ ] **Interface de Chat**: Componente de chat com histórico visual
- [ ] **Design Responsivo**: Layout adaptável para desktop e mobile
- [ ] **PWA Básico**: Manifest e service worker para "instalar" no iPhone
- [ ] **Autenticação Simples**: Login com JWT, proteção de rotas sensíveis
- [ ] **Histórico de Conversas**: Persistência e visualização de threads
- [ ] **Dashboard de Projetos**: Listagem visual de projetos cadastrados
- [ ] **Tema Claro/Escuro**: Toggle de tema com persistência
- [ ] **Feedback Visual**: Loading states, toasts de notificação

#### Critérios de Aceitação

1. Interface abre corretamente no Safari do iPhone sem zoom forçado
2. Usuário consegue "Adicionar à Tela de Início" e acessar como app
3. Login funciona com usuário/senha configurados em variáveis de ambiente
4. Rotas `/admin/*` requerem autenticação válida
5. Histórico de conversas persiste entre sessões
6. Chat responde a comandos do backend em tempo < 2s (UI)
7. Layout não quebra em telas de 320px a 1920px

#### Dependências de Entrada
- Sprint 1 concluída (APIs estáveis)

---

### Sprint 3: Executor de Projetos

| Atributo | Valor |
|----------|-------|
| **Duração** | 4 semanas |
| **Objetivo** | Implementar automação completa de projetos: abrir, executar e monitorar |
| **Squad** | 1 desenvolvedor backend + 1 frontend (parcial) |
| **Stack Principal** | Python subprocess, VS Code CLI, WebSocket |

#### Entregáveis

- [ ] **Abertura de VS Code**: Comando para abrir workspace de projeto
- [ ] **Abertura de Pastas**: Navegação e abertura de diretórios de projeto
- [ ] **Execução de Comandos**: Rodar scripts pré-aprovados (`npm run dev`, etc.)
- [ ] **Lista de Projetos**: Endpoint e UI para listar projetos disponíveis
- [ ] **Status de Execução**: Monitoramento de processos em execução
- [ ] **Terminal Web**: Visualização de saída de comandos em tempo real
- [ ] **Comandos Pré-aprovados**: Whitelist de comandos seguros
- [ ] **Cancelamento de Tarefas**: Interrupção de processos longos

#### Critérios de Aceitação

1. Comando "abrir projeto X" abre VS Code com o workspace correto em < 5s
2. Comandos da whitelist executam sem confirmação adicional
3. Comandos fora da whitelist requerem aprovação explícita
4. Saída de comandos é exibida em tempo real na interface
5. Processos são rastreados e podem ser terminados via UI
6. Falhas de execução são capturadas e exibidas com contexto
7. Sistema não bloqueia em comandos longos (async)

#### Dependências de Entrada
- Sprint 1 (backend) e Sprint 2 (UI) concluídas

---

### Sprint 4: Acesso Remoto e Deploy Público

| Atributo | Valor |
|----------|-------|
| **Duração** | 4 semanas |
| **Objetivo** | Publicar frontend, habilitar acesso seguro fora da rede local |
| **Squad** | 1 desenvolvedor DevOps + 1 backend (parcial) |
| **Stack Principal** | VPS/Cloud, Nginx, SSL, Tailscale/Cloudflare |

#### Entregáveis

- [ ] **Frontend Publicado**: Deploy em Vercel/Netlify ou VPS próprio
- [ ] **HTTPS Obrigatório**: Certificado SSL válido para todas as comunicações
- [ ] **Acesso Remoto Seguro**: Tunnel ou VPN para backend local
- [ ] **Rate Limiting**: Proteção contra abuso de APIs
- [ ] **Autenticação Reforçada**: Opção de 2FA ou tokens de acesso
- [ ] **Health Check**: Endpoint de monitoramento de saúde do sistema
- [ ] **Documentação de Deploy**: Guia passo-a-passo de instalação
- [ ] **Script de Setup**: Automação de instalação para novos usuários

#### Critérios de Aceitação

1. Frontend acessível via HTTPS de qualquer localização
2. Backend local acessível remotamente através de tunnel seguro
3. Comunicação frontend-backend criptografada end-to-end
4. Rate limiting bloqueia requisições excessivas (429)
5. Health check retorna status de todos os componentes
6. Usuário consegue instalar e configurar seguindo documentação
7. Sistema funciona fora de casa sem configuração adicional do usuário

#### Dependências de Entrada
- Sprints 1, 2 e 3 concluídas

---

## 3. Priorização MoSCoW

| Funcionalidade | Categoria | Justificativa |
|----------------|-----------|---------------|
| **Chat em linguagem natural** | **Must Have** | Core da experiência Aura, diferencial principal |
| **Integração Ollama/Qwen** | **Must Have** | Motor de IA, essencial para processamento de linguagem |
| **API REST estruturada** | **Must Have** | Base técnica para todas as funcionalidades |
| **Cadastro de projetos** | **Must Have** | Pré-requisito para automação de projetos |
| **Autenticação básica** | **Must Have** | Segurança mínima para acesso remoto |
| **Execução de comandos pré-aprovados** | **Must Have** | Funcionalidade central de automação |
| **Abrir VS Code** | **Should Have** | Alto valor operacional, mas pode ser manual inicialmente |
| **Abrir pasta de projeto** | **Should Have** | Facilita workflow, mas não bloqueia uso |
| **Interface web responsiva** | **Should Have** | Essencial para UX, mas MVP pode ser básico |
| **Histórico de conversas** | **Should Have** | Melhora UX significativamente |
| **Acesso mobile (PWA)** | **Should Have** | Expande casos de uso, mas desktop é prioridade |
| **Terminal web em tempo real** | **Should Have** | Melhor visibilidade, mas logs assíncronos funcionam |
| **HTTPS/SSL** | **Should Have** | Importante para segurança, mas local funciona sem |
| **Lista de projetos visual** | **Could Have** | Facilita descoberta, mas busca textual funciona |
| **Tema claro/escuro** | **Could Have** | UX refinada, não essencial para MVP |
| **2FA/Autenticação avançada** | **Could Have** | Segurança extra, JWT básico é suficiente v1 |
| **Rate limiting avançado** | **Could Have** | Proteção adicional, básico cobre necessidade |
| **Notificações push** | **Won't Have (v1)**** | Fora do escopo inicial, complexidade alta |
| **Suporte a múltiplos usuários** | **Won't Have (v1)**** | Aura é pessoal, single-user por design |
| **Integração com GitHub/Git** | **Won't Have (v1)**** | Pode ser adicionado via comandos customizados |
| **Plugins/extensões** | **Won't Have (v1)**** | Arquitetura complexa, avaliar para v2 |
| **Sincronização cloud** | **Won't Have (v1)**** | Dados locais são prioridade, cloud é v2 |
| **Reconhecimento de voz** | **Won't Have (v1)**** | Feature avançada, texto é suficiente v1 |
| **Dashboard analítico** | **Won't Have (v1)**** | Logs atendem necessidade de monitoramento |

### Resumo MoSCoW

| Categoria | Quantidade | % do Escopo |
|-----------|------------|-------------|
| Must Have | 6 | 25% |
| Should Have | 8 | 33% |
| Could Have | 4 | 17% |
| Won't Have (v1) | 6 | 25% |

---

## 4. Estimativas de Esforço (T-Shirt Sizing)

### Legenda

| Tamanho | Esforço | Tempo Estimado | Complexidade |
|---------|---------|----------------|--------------|
| **S** | Pequeno | 4-8h | Trivial, bem definido |
| **M** | Médio | 1-2 dias | Alguma complexidade, requisitos claros |
| **L** | Grande | 3-5 dias | Complexo, múltiplos componentes |
| **XL** | Extra Grande | 1-2 semanas | Muito complexo, alto risco |

### Estimativas por Funcionalidade

| Funcionalidade | Tamanho | Sprint | Notas |
|----------------|---------|--------|-------|
| Estruturação de rotas API | M | 1 | Refatoração de código existente |
| Endpoint `/command` | L | 1 | Validação de segurança é crítica |
| CRUD de projetos | M | 1 | Modelagem de dados + endpoints |
| Integração Ollama | M | 1 | Cliente HTTP com retry logic |
| Modelo de dados SQLite | S | 1 | Esquema simples, bem definido |
| Configuração centralizada | S | 1 | Pydantic Settings |
| Logging estruturado | S | 1 | Python logging + rotação |
| Testes unitários | M | 1 | Cobertura de serviços críticos |
| Interface de chat | L | 2 | Componente React, state management |
| Design responsivo | M | 2 | Tailwind CSS, breakpoints |
| PWA (manifest + SW) | M | 2 | Configuração específica iOS |
| Autenticação JWT | L | 2 | Login, proteção de rotas, refresh |
| Histórico de conversas | M | 2 | Persistência + UI de threads |
| Dashboard de projetos | M | 2 | Listagem visual + ações |
| Tema claro/escuro | S | 2 | Context + CSS variables |
| Abertura de VS Code | M | 3 | Subprocess + path handling |
| Abertura de pastas | M | 3 | File system + permissões |
| Execução de comandos | L | 3 | Subprocess async + streaming |
| Terminal web | L | 3 | WebSocket + output streaming |
| Whitelist de comandos | M | 3 | Configuração + validação |
| Monitoramento de processos | M | 3 | Tracking + cleanup |
| Deploy frontend (Vercel) | S | 4 | Configuração de build |
| Configuração SSL/HTTPS | M | 4 | Certbot ou Cloudflare |
| Tunnel remoto seguro | L | 4 | Tailscale/Cloudflare Tunnel |
| Rate limiting | M | 4 | Middleware de proteção |
| Health check | S | 4 | Endpoint de monitoramento |
| Documentação de deploy | M | 4 | Guia completo passo-a-passo |
| Script de setup | M | 4 | Automação de instalação |

### Resumo por Tamanho

| Tamanho | Quantidade | Esforço Total Estimado |
|---------|------------|------------------------|
| S | 6 | 30-48h |
| M | 14 | 112-224h |
| L | 7 | 105-245h |
| XL | 0 | 0h |
| **Total** | **27** | **247-517h** |

---

## 5. Dependências e Riscos

### Matriz de Dependências

| Tarefa | Dependente de | Tipo | Impacto se Bloqueada |
|--------|---------------|------|---------------------|
| Interface de chat | API `/chat` pronta | Hard | Não pode iniciar |
| Autenticação JWT | Modelo de usuários | Hard | Não pode iniciar |
| Histórico de conversas | Modelo de dados + auth | Hard | Não pode iniciar |
| Execução de comandos | `/command` endpoint | Hard | Não pode iniciar |
| Terminal web | Execução de comandos | Hard | Não pode iniciar |
| Deploy frontend | Frontend funcional | Hard | Não pode iniciar |
| Acesso remoto | HTTPS configurado | Hard | Não pode iniciar |
| PWA | Interface responsiva | Soft | Pode iniciar em paralelo |
| Tema claro/escuro | Interface base | Soft | Pode iniciar em paralelo |
| Rate limiting | APIs públicas | Soft | Pode adiar |
| Health check | Todos os componentes | Soft | Iterativo |

### Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Ollama indisponível/lento** | Média | Alto | Implementar cache de respostas; fallback para respostas locais |
| **Permissões de sistema (subprocess)** | Alta | Alto | Documentar requisitos de permissão; testar em múltiplos SOs |
| **Compatibilidade iOS Safari** | Média | Médio | Testar cedo no Sprint 2; usar polyfills se necessário |
| **Segurança de comandos arbitrários** | Alta | Alto | Whitelist estrita; sandbox de execução; logs de auditoria |
| **Performance com muitos projetos** | Baixa | Médio | Paginação; índices no banco; lazy loading |
| **Configuração complexa de rede** | Média | Médio | Documentação detalhada; script de diagnóstico; Tailscale como padrão |
| **Bloqueio de antivirus/firewall** | Média | Médio | Assinar executáveis; documentar exceções necessárias |
| **Dependência de VS Code instalado** | Baixa | Baixo | Detectar e instruir instalação; fallback para explorer |

### Plano de Contingência

| Cenário | Ação Imediata | Solução de Longo Prazo |
|---------|---------------|------------------------|
| Ollama não responde | Timeout com mensagem amigável | Implementar queue de processamento |
| Comando bloqueado pelo SO | Log detalhado do erro | GUI de configuração de permissões |
| Tunnel remoto falha | Modo offline/local | Múltiplas opções de tunnel |
| Frontend não carrega no iPhone | Testar em desktop | Debug remoto Safari |

---

## 6. Próximos Passos Imediatos

### Ações para Iniciar Hoje

1. **Ambiente de Desenvolvimento**
   - [ ] Clonar repositório do projeto
   - [ ] Configurar Python 3.11+ e ambiente virtual
   - [ ] Instalar dependências do `requirements.txt`
   - [ ] Verificar instalação do Ollama e modelo Qwen2.5

2. **Estrutura Inicial**
   - [ ] Criar estrutura de pastas: `api/`, `models/`, `services/`, `tests/`
   - [ ] Configurar FastAPI com estrutura de rotas modular
   - [ ] Definir modelo Pydantic para Projetos
   - [ ] Criar esquema inicial do SQLite

3. **Primeiros Endpoints**
   - [ ] Implementar `GET /health` para health check
   - [ ] Implementar `POST /chat` com integração Ollama
   - [ ] Implementar `GET /projects` (lista mock inicial)
   - [ ] Adicionar testes básicos com pytest

4. **Documentação**
   - [ ] Criar README com instruções de setup
   - [ ] Documentar variáveis de ambiente necessárias
   - [ ] Criar `.env.example` com valores padrão

5. **Planejamento**
   - [ ] Criar issues no GitHub para cada entregável do Sprint 1
   - [ ] Definir branch strategy (main, develop, feature/*)
   - [ ] Configurar CI básico (lint + testes)

### Checklist de Readiness

| Item | Status | Responsável |
|------|--------|-------------|
| Repositório configurado | ⬜ | Dev |
| Ambiente local funcional | ⬜ | Dev |
| Ollama + Qwen2.5 testado | ⬜ | Dev |
| Estrutura de pastas definida | ⬜ | Dev |
| Issues do Sprint 1 criadas | ⬜ | Dev |
| CI/CD básico configurado | ⬜ | Dev |

---

## Apêndice: Glossário

| Termo | Definição |
|-------|-----------|
| **MVP** | Minimum Viable Product - versão mínima funcional |
| **PWA** | Progressive Web App - app web instalável |
| **JWT** | JSON Web Token - padrão de autenticação |
| **CRUD** | Create, Read, Update, Delete - operações básicas |
| **Whitelist** | Lista de itens permitidos explicitamente |
| **Subprocess** | Execução de comandos do sistema operacional |
| **Tunnel** | Conexão segura através de redes |
| **Rate Limiting** | Limitação de requisições por tempo |

---

*Documento gerado para Blueprint Técnico Aura v1*  
*Versão: 1.0*  
*Data: 2025*
