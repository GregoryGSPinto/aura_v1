# Experimento: Qwen 3.5:9b como Agente com Tool Calling

**Data:** 2026-03-26 21:14:37  
**Modelo:** `qwen3.5:9b`  
**Ollama:** `http://localhost:11434`  
**Método:** `/api/chat` com campo `tools` (native Ollama function calling)  
**Think mode:** desativado (`think: false`)  
**Temperature:** 0 (determinístico)  
**Repo root:** `/Users/user_pc/Projetos/aura_v1`  

---

## Tabela Resumo

| # | Descrição | Tool Esperada | Tool Chamada | Correta? | Latência |
|---|-----------|---------------|--------------|----------|----------|
| 1 | Simples: listar arquivos | `file_list` | `file_list` | ✅ | 164.01s |
| 2 | Simples: ler arquivo | `file_read` | `file_read` | ✅ | 235.36s |
| 3 | Médio: contar linhas | `shell_exec` | `shell_exec` | ✅ | 78.91s |
| 4 | Complexo: listar + contar .py | `file_list` | `file_list` | ✅ ⚠️ | 469.64s |
| 5 | Agente: criar arquivo | `shell_exec` | `shell_exec` | ✅ | 92.68s |

**Score: 5/5 tools corretas | Latência média: 208.1s**

---

## Detalhamento por Teste

### TEST 1: Simples: listar arquivos

| Campo | Valor |
|-------|-------|
| Input | `liste os arquivos da pasta aura/backend` |
| Tool esperada | `file_list` |
| Tool chamada | `file_list` |
| Resultado | ✅ CORRETO |
| Latência | 164.01s |

#### Step 1

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_r99nhjae",
    "function": {
      "index": 0,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend"
      }
    }
  }
]
```

**Resultados das tools:**

- **`file_list({"directory": "aura/backend"})`**
  ```
  .env
  .env.example
  .next/
  .pytest_cache/
  .venv/
  _croniter_standalone.py
  app/
  data/
  requirements.txt
  tests/
  ```

#### Step 2

**Output bruto do Qwen:**
```
Aqui estão os arquivos e subdiretórios da pasta `aura/backend`:

- `.env`
- `.env.example`
- `.next/`
- `.pytest_cache/`
- `.venv/`
- `_croniter_standalone.py`
- `app/`
- `data/`
- `requirements.txt`
- `tests/`
```


**Resposta final do Qwen:**
```
Aqui estão os arquivos e subdiretórios da pasta `aura/backend`:

- `.env`
- `.env.example`
- `.next/`
- `.pytest_cache/`
- `.venv/`
- `_croniter_standalone.py`
- `app/`
- `data/`
- `requirements.txt`
- `tests/`
```

### TEST 2: Simples: ler arquivo

| Campo | Valor |
|-------|-------|
| Input | `qual o conteúdo do arquivo aura/backend/app/main.py?` |
| Tool esperada | `file_read` |
| Tool chamada | `file_read` |
| Resultado | ✅ CORRETO |
| Latência | 235.36s |

#### Step 1

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_sjlqnft8",
    "function": {
      "index": 0,
      "name": "file_read",
      "arguments": {
        "path": "aura/backend/app/main.py"
      }
    }
  }
]
```

**Resultados das tools:**

- **`file_read({"path": "aura/backend/app/main.py"})`**
  ```
  import os
  from contextlib import asynccontextmanager
  from datetime import datetime, timezone
  from typing import Any, Optional
  
  from fastapi import FastAPI, Request, Response
  from fastapi.middleware.cors import CORSMiddleware
  from fastapi.responses import JSONResponse
  
  from app.agents.job_manager import AgentJobManager
  from app.agents.planner import AgentPlanner
  from app.agents.step_executor import AgentStepExecutor
  from app.api.v1.router import api_router
  from app.aura_os.agents.router import Ag
  ```

#### Step 2

**Output bruto do Qwen:**
```
O conteúdo do arquivo `aura/backend/app/main.py` foi lido. Ele contém o código principal da aplicação FastAPI, importando diversos módulos e serviços do sistema Aura OS. O arquivo parece ser um ponto de entrada complexo que inicializa rotas, serviços e componentes do sistema.

Se você quiser ver o conteúdo completo ou analisar alguma parte específica, posso ajudar!
```


**Resposta final do Qwen:**
```
O conteúdo do arquivo `aura/backend/app/main.py` foi lido. Ele contém o código principal da aplicação FastAPI, importando diversos módulos e serviços do sistema Aura OS. O arquivo parece ser um ponto de entrada complexo que inicializa rotas, serviços e componentes do sistema.

Se você quiser ver o conteúdo completo ou analisar alguma parte específica, posso ajudar!
```

### TEST 3: Médio: contar linhas

| Campo | Valor |
|-------|-------|
| Input | `quantas linhas tem o arquivo aura/backend/app/main.py?` |
| Tool esperada | `shell_exec` |
| Tool chamada | `shell_exec` |
| Resultado | ✅ CORRETO |
| Latência | 78.91s |

#### Step 1

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_eto51kv6",
    "function": {
      "index": 0,
      "name": "shell_exec",
      "arguments": {
        "command": "wc -l aura/backend/app/main.py"
      }
    }
  }
]
```

**Resultados das tools:**

- **`shell_exec({"command": "wc -l aura/backend/app/main.py"})`**
  ```
  698 aura/backend/app/main.py
  ```

#### Step 2

**Output bruto do Qwen:**
```
O arquivo aura/backend/app/main.py tem 698 linhas.
```


**Resposta final do Qwen:**
```
O arquivo aura/backend/app/main.py tem 698 linhas.
```

### TEST 4: Complexo: listar + contar .py

| Campo | Valor |
|-------|-------|
| Input | `liste os arquivos do aura/backend e me diga quantos são arquivos .py` |
| Tool esperada | `file_list` |
| Tool chamada | `file_list` |
| Resultado | ✅ CORRETO |
| Latência | 469.64s |
| Erro | `Exceção inesperada: timeout: timed out` |

#### Step 1

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_v3vdlcv6",
    "function": {
      "index": 0,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend"
      }
    }
  }
]
```

**Resultados das tools:**

- **`file_list({"directory": "aura/backend"})`**
  ```
  .env
  .env.example
  .next/
  .pytest_cache/
  .venv/
  _croniter_standalone.py
  app/
  data/
  requirements.txt
  tests/
  ```

#### Step 2

**Output bruto do Qwen:**
```
Agora vou verificar os arquivos dentro das subpastas para contar todos os arquivos .py:
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_vkli36ys",
    "function": {
      "index": 0,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app"
      }
    }
  },
  {
    "id": "call_mi461f8o",
    "function": {
      "index": 1,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/data"
      }
    }
  },
  {
    "id": "call_oc21x9ao",
    "function": {
      "index": 2,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/tests"
      }
    }
  }
]
```

**Resultados das tools:**

- **`file_list({"directory": "aura/backend/app"})`**
  ```
  __init__.py
  agents/
  api/
  aura_os/
  config/
  core/
  experiments/
  main.py
  models/
  prompts/
  services/
  tools/
  utils/
  ```

- **`file_list({"directory": "aura/backend/data"})`**
  ```
  json/
  logs/
  memory.db
  memory.db-shm
  memory.db-wal
  ```

- **`file_list({"directory": "aura/backend/tests"})`**
  ```
  conftest.py
  test_chat_operational_flow.py
  test_chat_router.py
  test_command_service.py
  test_companion_runtime.py
  test_connectors.py
  test_knowledge_proactive.py
  test_memory_manager.py
  test_model_router.py
  test_mvp_operational.py
  test_os_runtime.py
  test_providers.py
  test_research_tool.py
  test_security_hardening.py
  test_streaming.py
  test_tool_calling.py
  test_tool_registry.py
  test_voice_runtime.py
  ```

#### Step 3

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_juoqt9lm",
    "function": {
      "index": 0,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/agents"
      }
    }
  },
  {
    "id": "call_4uumhvxc",
    "function": {
      "index": 1,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/api"
      }
    }
  },
  {
    "id": "call_oj863cna",
    "function": {
      "index": 2,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/aura_os"
      }
    }
  },
  {
    "id": "call_8vygx1vw",
    "function": {
      "index": 3,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/config"
      }
    }
  },
  {
    "id": "call_u9har4o4",
    "function": {
      "index": 4,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/core"
      }
    }
  },
  {
    "id": "call_uexhvsap",
    "function": {
      "index": 5,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/experiments"
      }
    }
  },
  {
    "id": "call_q4qae88i",
    "function": {
      "index": 6,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/models"
      }
    }
  },
  {
    "id": "call_294083hq",
    "function": {
      "index": 7,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/prompts"
      }
    }
  },
  {
    "id": "call_04004yaw",
    "function": {
      "index": 8,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/services"
      }
    }
  },
  {
    "id": "call_khu7zriu",
    "function": {
      "index": 9,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/tools"
      }
    }
  },
  {
    "id": "call_wcro8j9v",
    "function": {
      "index": 10,
      "name": "file_list",
      "arguments": {
        "directory": "aura/backend/app/utils"
      }
    }
  }
]
```

**Resultados das tools:**

- **`file_list({"directory": "aura/backend/app/agents"})`**
  ```
  __init__.py
  job_manager.py
  models.py
  planner.py
  step_executor.py
  ```

- **`file_list({"directory": "aura/backend/app/api"})`**
  ```
  __init__.py
  v1/
  ```

- **`file_list({"directory": "aura/backend/app/aura_os"})`**
  ```
  __init__.py
  agents/
  automation/
  config/
  connectors/
  core/
  integrations/
  memory/
  resilience/
  tools/
  voice/
  ```

- **`file_list({"directory": "aura/backend/app/config"})`**
  ```
  __init__.py
  system_prompt.py
  ```

- **`file_list({"directory": "aura/backend/app/core"})`**
  ```
  config.py
  exceptions.py
  http_security.py
  logger.py
  security.py
  security_policies.py
  ```

- **`file_list({"directory": "aura/backend/app/experiments"})`**
  ```
  qwen_agent_test.py
  ```

- **`file_list({"directory": "aura/backend/app/models"})`**
  ```
  auth_models.py
  chat_models.py
  command_models.py
  common_models.py
  companion_models.py
  connector_models.py
  job_models.py
  persistence_models.py
  project_models.py
  routine_models.py
  ```

- **`file_list({"directory": "aura/backend/app/prompts"})`**
  ```
  __init__.py
  aura_absolute.py
  ```

- **`file_list({"directory": "aura/backend/app/services"})`**
  ```
  action_governance_service.py
  auth_service.py
  behavior_service.py
  brain_router.py
  chat_router_service.py
  claude_bridge.py
  claude_client.py
  command_service.py
  connector_service.py
  context_service.py
  daily_briefing.py
  dataset_export_service.py
  deploy_orchestrator.py
  events.py
  github_service.py
  health.py
  integrations_service.py
  job_service.py
  knowledge_extractor.py
  memory_service.py
  mission_engine.py
  mission_engine_v2.py
  ollama_engine_service.py
  ollama_service.py
  operation_log.py
  persistence_service
  ```

- **`file_list({"directory": "aura/backend/app/tools"})`**
  ```
  __init__.py
  aura_dev.py
  base.py
  browser_tool.py
  claude_tool.py
  dev_tool.py
  doc_tool.py
  filesystem_tool.py
  git_tool.py
  llm_tool.py
  project_tool.py
  system_tool.py
  terminal_tool.py
  tool_registry_v2.py
  tool_router.py
  vscode_tool.py
  ```

- **`file_list({"directory": "aura/backend/app/utils"})`**
  ```
  helpers.py
  validators.py
  ```

### TEST 5: Agente: criar arquivo

| Campo | Valor |
|-------|-------|
| Input | `crie um arquivo chamado teste.txt com o conteúdo "Aura funciona" na pasta /tmp` |
| Tool esperada | `shell_exec` |
| Tool chamada | `shell_exec` |
| Resultado | ✅ CORRETO |
| Latência | 92.68s |

#### Step 1

**Output bruto do Qwen:**
```
(sem conteúdo)
```

**Tool calls (formato nativo Ollama):**
```json
[
  {
    "id": "call_l31xg1v9",
    "function": {
      "index": 0,
      "name": "shell_exec",
      "arguments": {
        "command": "echo \"Aura funciona\" > /tmp/teste.txt"
      }
    }
  }
]
```

**Resultados das tools:**

- **`shell_exec({"command": "echo \"Aura funciona\" > /tmp/teste.txt"})`**
  ```
  (sem output)
  ```

#### Step 2

**Output bruto do Qwen:**
```
O arquivo teste.txt foi criado com sucesso na pasta /tmp com o conteúdo "Aura funciona".
```


**Resposta final do Qwen:**
```
O arquivo teste.txt foi criado com sucesso na pasta /tmp com o conteúdo "Aura funciona".
```

---

## Conclusão

**Score: 5/5 testes com tool correta chamada.**

✅ **Qwen 3.5:9b CONSEGUE funcionar como agente com tool calling** via Ollama native function calling.

O modelo acertou 5/5 tools, demonstrando capacidade de:
- Reconhecer quando usar tools vs responder diretamente
- Selecionar a tool correta para cada tipo de tarefa
- Passar argumentos válidos
- Usar o resultado da tool para formular a resposta final

**Recomendação:** É viável usar qwen3.5:9b como agente local para tarefas do cotidiano, reduzindo custo de chamadas à Claude API.

---

## Notas Técnicas

- Tools definidas: `shell_exec`, `file_read`, `file_list`
- Paths relativos ao root: `/Users/user_pc/Projetos/aura_v1`
- Max steps por teste: 5 (para suportar multi-step tool calling)
- Timeout por request: 180s
- `think: false` aplicado via `options` e campo top-level

