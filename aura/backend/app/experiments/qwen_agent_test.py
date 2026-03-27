#!/usr/bin/env python3
"""
Experimento: Qwen 3.5:9b como Agente com Tool Calling
======================================================
Testa se o qwen3.5:9b via Ollama consegue funcionar como agente
usando native function calling da API /api/chat do Ollama.

Roda 5 testes e salva relatório honesto em EXPERIMENT-qwen-agent.md
"""

import json
import os
import subprocess
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# ─────────────────────────────────────────────────────────────────
# Configuração
# ─────────────────────────────────────────────────────────────────

OLLAMA_BASE = "http://localhost:11434"
MODEL = "qwen3.5:9b"
REPO_ROOT = Path(__file__).parent.parent.parent.parent.parent  # aura_v1/
REPORT_PATH = REPO_ROOT / "EXPERIMENT-qwen-agent.md"

# ─────────────────────────────────────────────────────────────────
# Implementação das tools
# ─────────────────────────────────────────────────────────────────

def shell_exec(command: str) -> str:
    """Executa comando bash, retorna stdout+stderr."""
    try:
        r = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=15, cwd=str(REPO_ROOT)
        )
        out = r.stdout
        if r.returncode != 0 and r.stderr:
            out += f"\nSTDERR: {r.stderr}"
        return out.strip() or "(sem output)"
    except subprocess.TimeoutExpired:
        return "ERROR: command timed out after 15s"
    except Exception as e:
        return f"ERROR: {e}"


def file_read(path: str) -> str:
    """Lê arquivo, retorna conteúdo (truncado em 4000 chars)."""
    try:
        full = REPO_ROOT / path
        content = full.read_text(encoding="utf-8")
        if len(content) > 4000:
            content = content[:4000] + "\n... [truncado]"
        return content
    except Exception as e:
        return f"ERROR: {e}"


def file_list(directory: str) -> str:
    """Lista arquivos de um diretório."""
    try:
        full = REPO_ROOT / directory
        if not full.exists():
            return f"ERROR: diretório não encontrado: {directory}"
        entries = sorted(full.iterdir())
        return "\n".join(
            e.name + ("/" if e.is_dir() else "") for e in entries
        )
    except Exception as e:
        return f"ERROR: {e}"


TOOL_IMPLS = {
    "shell_exec": shell_exec,
    "file_read":  file_read,
    "file_list":  file_list,
}

# ─────────────────────────────────────────────────────────────────
# Definição das tools no formato Ollama (OpenAI-compatible)
# ─────────────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "shell_exec",
            "description": "Executa um comando bash e retorna o stdout. Use para contar linhas, criar arquivos, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Comando bash a executar"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "file_read",
            "description": "Lê o conteúdo completo de um arquivo. Use caminhos relativos ao repositório.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Caminho relativo do arquivo (ex: aura/backend/app/main.py)"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "file_list",
            "description": "Lista todos os arquivos e subdiretórios de um diretório. Use caminhos relativos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Caminho relativo do diretório (ex: aura/backend)"
                    }
                },
                "required": ["directory"]
            }
        }
    }
]

# ─────────────────────────────────────────────────────────────────
# Cliente Ollama
# ─────────────────────────────────────────────────────────────────

def ollama_chat(messages: List[Dict], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """Chama Ollama /api/chat e retorna a resposta completa."""
    payload: dict = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0,
            "think": False,
        }
    }
    if tools:
        payload["tools"] = tools

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))

# ─────────────────────────────────────────────────────────────────
# Executor de um teste
# ─────────────────────────────────────────────────────────────────

def run_test(
    test_num: int,
    description: str,
    user_message: str,
    expected_tool: str
) -> dict:
    """Executa um único teste com loop de tool calling (máx 5 steps)."""

    print(f"\n{'='*65}")
    print(f"TEST {test_num}: {description}")
    print(f"  Input   : {user_message}")
    print(f"  Esperado: {expected_tool}")
    print(f"{'='*65}")

    result: dict = {
        "test_num":      test_num,
        "description":   description,
        "input":         user_message,
        "expected_tool": expected_tool,
        "steps":         [],
        "final_answer":  None,
        "tool_called":   None,         # primeira tool chamada
        "tool_correct":  False,
        "json_valid":    True,          # N/A em native mode; True por padrão
        "result_correct": False,
        "latency_s":     0.0,
        "error":         None,
    }

    messages = [
        {
            "role": "system",
            "content": (
                "Você é Aura, uma assistente de IA com acesso a tools. "
                "Sempre use uma tool quando precisar de informações do sistema. "
                "Caminhos de arquivo são relativos ao repositório aura_v1/."
            )
        },
        {"role": "user", "content": user_message}
    ]

    t0 = time.perf_counter()

    try:
        for step_idx in range(5):  # max 5 round-trips
            resp = ollama_chat(messages, tools=TOOLS)
            msg  = resp.get("message", {})

            raw_content = msg.get("content") or ""
            tool_calls  = msg.get("tool_calls") or []

            step_info = {
                "step":                step_idx + 1,
                "raw_content":         raw_content,
                "tool_calls_detected": bool(tool_calls),
                "tool_calls":          tool_calls,
                "tool_results":        [],
            }

            print(f"\n  [Step {step_idx+1}] content preview : {raw_content[:200]!r}")
            print(f"  [Step {step_idx+1}] tool_calls count: {len(tool_calls)}")

            if not tool_calls:
                # Resposta final — sem mais tools
                result["final_answer"] = raw_content
                result["steps"].append(step_info)
                break

            # Adiciona resposta do assistente com as tool_calls
            messages.append({
                "role":       "assistant",
                "content":    raw_content,
                "tool_calls": tool_calls,
            })

            # Executa cada tool call
            for tc in tool_calls:
                fn        = tc.get("function", {})
                tool_name = fn.get("name", "")
                tool_args = fn.get("arguments", {})

                # Ollama pode retornar args como string ou dict
                if isinstance(tool_args, str):
                    try:
                        tool_args = json.loads(tool_args)
                    except json.JSONDecodeError:
                        tool_args = {}

                print(f"  → TOOL CALL : {tool_name}({json.dumps(tool_args)})")

                # Registra a primeira tool chamada
                if result["tool_called"] is None:
                    result["tool_called"] = tool_name
                    result["tool_correct"] = (tool_name == expected_tool)

                impl = TOOL_IMPLS.get(tool_name)
                if impl:
                    try:
                        tool_result = impl(**tool_args)
                    except TypeError as te:
                        tool_result = f"ERROR: argumentos inválidos — {te}"
                else:
                    tool_result = f"ERROR: tool desconhecida '{tool_name}'"

                print(f"  ← RESULT    : {tool_result[:300]!r}")

                step_info["tool_results"].append({
                    "tool": tool_name,
                    "args": tool_args,
                    "result_preview": tool_result[:500],
                })

                # Retorna resultado da tool para o modelo
                messages.append({
                    "role":    "tool",
                    "content": tool_result,
                })

            result["steps"].append(step_info)

        else:
            # Excedeu max steps sem resposta final
            result["error"] = "Max steps (5) excedidos sem resposta final"

    except urllib.error.URLError as e:
        result["error"] = f"Ollama não acessível: {e}"
    except Exception as e:
        result["error"] = f"Exceção inesperada: {type(e).__name__}: {e}"

    result["latency_s"] = round(time.perf_counter() - t0, 2)

    # result_correct = tool certa foi chamada E sem erro crítico
    if result["tool_called"] and not result["error"]:
        result["result_correct"] = result["tool_correct"]

    print(f"\n  RESUMO TEST {test_num}: "
          f"tool_called={result['tool_called']}, "
          f"correct={result['tool_correct']}, "
          f"latency={result['latency_s']}s")

    return result

# ─────────────────────────────────────────────────────────────────
# Gerador de relatório Markdown
# ─────────────────────────────────────────────────────────────────

def generate_report(results: List[Dict]) -> str:
    now    = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines  = []
    a      = lines.append

    a(f"# Experimento: Qwen 3.5:9b como Agente com Tool Calling")
    a(f"")
    a(f"**Data:** {now}  ")
    a(f"**Modelo:** `{MODEL}`  ")
    a(f"**Ollama:** `{OLLAMA_BASE}`  ")
    a(f"**Método:** `/api/chat` com campo `tools` (native Ollama function calling)  ")
    a(f"**Think mode:** desativado (`think: false`)  ")
    a(f"**Temperature:** 0 (determinístico)  ")
    a(f"**Repo root:** `{REPO_ROOT}`  ")
    a(f"")
    a(f"---")
    a(f"")
    a(f"## Tabela Resumo")
    a(f"")
    a(f"| # | Descrição | Tool Esperada | Tool Chamada | Correta? | Latência |")
    a(f"|---|-----------|---------------|--------------|----------|----------|")

    for r in results:
        ok  = "✅" if r["tool_correct"] else "❌"
        tc  = f"`{r['tool_called']}`" if r["tool_called"] else "_nenhuma_"
        err = " ⚠️" if r["error"] else ""
        a(f"| {r['test_num']} | {r['description']} | `{r['expected_tool']}` | {tc} | {ok}{err} | {r['latency_s']}s |")

    correct = sum(1 for r in results if r["tool_correct"])
    total   = len(results)
    avg_lat = round(sum(r["latency_s"] for r in results) / total, 1)

    a(f"")
    a(f"**Score: {correct}/{total} tools corretas | Latência média: {avg_lat}s**")
    a(f"")
    a(f"---")
    a(f"")
    a(f"## Detalhamento por Teste")

    for r in results:
        a(f"")
        a(f"### TEST {r['test_num']}: {r['description']}")
        a(f"")
        a(f"| Campo | Valor |")
        a(f"|-------|-------|")
        a(f"| Input | `{r['input']}` |")
        a(f"| Tool esperada | `{r['expected_tool']}` |")
        a(f"| Tool chamada | `{r['tool_called'] or 'nenhuma'}` |")
        a(f"| Resultado | {'✅ CORRETO' if r['tool_correct'] else '❌ INCORRETO'} |")
        a(f"| Latência | {r['latency_s']}s |")
        if r["error"]:
            a(f"| Erro | `{r['error']}` |")

        for step in r.get("steps", []):
            a(f"")
            a(f"#### Step {step['step']}")
            a(f"")
            a(f"**Output bruto do Qwen:**")
            a(f"```")
            raw = (step.get("raw_content") or "(sem conteúdo)").strip()
            a(raw[:1500] + (" ... [truncado]" if len(raw) > 1500 else ""))
            a(f"```")
            a(f"")

            if step.get("tool_calls"):
                a(f"**Tool calls (formato nativo Ollama):**")
                a(f"```json")
                a(json.dumps(step["tool_calls"], indent=2, ensure_ascii=False)[:2000])
                a(f"```")
                a(f"")

            if step.get("tool_results"):
                a(f"**Resultados das tools:**")
                for tr in step["tool_results"]:
                    a(f"")
                    a(f"- **`{tr['tool']}({json.dumps(tr['args'])})`**")
                    a(f"  ```")
                    a(f"  " + tr["result_preview"][:800].replace("\n", "\n  "))
                    a(f"  ```")

        if r.get("final_answer"):
            a(f"")
            a(f"**Resposta final do Qwen:**")
            a(f"```")
            a((r["final_answer"] or "").strip()[:800])
            a(f"```")

    # ── Conclusão ──────────────────────────────────────────────────
    a(f"")
    a(f"---")
    a(f"")
    a(f"## Conclusão")
    a(f"")
    a(f"**Score: {correct}/{total} testes com tool correta chamada.**")
    a(f"")

    if correct == 5:
        verdict = (
            "✅ **Qwen 3.5:9b CONSEGUE funcionar como agente com tool calling** via "
            "Ollama native function calling.\n\n"
            "O modelo acertou 5/5 tools, demonstrando capacidade de:\n"
            "- Reconhecer quando usar tools vs responder diretamente\n"
            "- Selecionar a tool correta para cada tipo de tarefa\n"
            "- Passar argumentos válidos\n"
            "- Usar o resultado da tool para formular a resposta final\n\n"
            "**Recomendação:** É viável usar qwen3.5:9b como agente local para tarefas "
            "do cotidiano, reduzindo custo de chamadas à Claude API."
        )
    elif correct >= 4:
        verdict = (
            "✅ **Qwen 3.5:9b CONSEGUE tool calling na maioria dos casos** "
            f"({correct}/5 corretos).\n\n"
            "O modelo demonstra boa capacidade de tool calling mas falha em "
            "alguns cenários específicos. Adequado para tarefas simples e médias.\n\n"
            "**Recomendação:** Usar Qwen para tool calling simples; reservar Claude API "
            "para chains complexas ou multi-step críticos."
        )
    elif correct >= 3:
        verdict = (
            f"⚠️ **Qwen 3.5:9b consegue tool calling PARCIALMENTE** ({correct}/5 corretos).\n\n"
            "O modelo acerta em casos simples mas falha em cenários médios/complexos. "
            "Não é confiável para pipelines de agente autônomo.\n\n"
            "**Recomendação:** Limitar uso do Qwen a ferramentas de busca e leitura "
            "simples; usar Claude API para qualquer agentic task real."
        )
    elif correct >= 1:
        verdict = (
            f"❌ **Qwen 3.5:9b NÃO é confiável para tool calling** ({correct}/5 corretos).\n\n"
            "O modelo falha na maioria dos casos. Não adequado como agente autônomo "
            "no estado atual da integração.\n\n"
            "**Recomendação:** Usar exclusivamente Claude API para todos os cenários "
            "que exigem tool calling. Investigar se outra versão do Qwen tem melhor suporte."
        )
    else:
        verdict = (
            "❌ **Qwen 3.5:9b NÃO consegue tool calling** (0/5 corretos).\n\n"
            "O modelo não chamou nenhuma tool corretamente. Pode indicar que:\n"
            "- A versão `qwen3.5:9b` no Ollama não suporta function calling nativo\n"
            "- O formato de `tools` enviado não é compatível\n"
            "- O modelo precisa de um system prompt mais específico\n\n"
            "**Recomendação:** Testar com prompt manual (JSON-in-text) ou usar Claude API."
        )

    a(verdict)
    a(f"")
    a(f"---")
    a(f"")
    a(f"## Notas Técnicas")
    a(f"")
    a(f"- Tools definidas: `shell_exec`, `file_read`, `file_list`")
    a(f"- Paths relativos ao root: `{REPO_ROOT}`")
    a(f"- Max steps por teste: 5 (para suportar multi-step tool calling)")
    a(f"- Timeout por request: 180s")
    a(f"- `think: false` aplicado via `options` e campo top-level")
    a(f"")

    return "\n".join(lines) + "\n"

# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

TESTS = [
    (1, "Simples: listar arquivos",
     "liste os arquivos da pasta aura/backend",
     "file_list"),

    (2, "Simples: ler arquivo",
     "qual o conteúdo do arquivo aura/backend/app/main.py?",
     "file_read"),

    (3, "Médio: contar linhas",
     "quantas linhas tem o arquivo aura/backend/app/main.py?",
     "shell_exec"),

    (4, "Complexo: listar + contar .py",
     "liste os arquivos do aura/backend e me diga quantos são arquivos .py",
     "file_list"),

    (5, "Agente: criar arquivo",
     'crie um arquivo chamado teste.txt com o conteúdo "Aura funciona" na pasta /tmp',
     "shell_exec"),
]


def main() -> None:
    print(f"\n{'#'*65}")
    print(f"  EXPERIMENTO: Qwen 3.5:9b Tool Calling")
    print(f"  Modelo : {MODEL}")
    print(f"  Ollama : {OLLAMA_BASE}")
    print(f"  Repo   : {REPO_ROOT}")
    print(f"{'#'*65}")

    # Verifica Ollama antes de começar
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as r:
            models_data = json.loads(r.read())
            model_names = [m["name"] for m in models_data.get("models", [])]
            print(f"\n✅ Ollama OK — modelos disponíveis: {model_names}")
            if MODEL not in model_names:
                print(f"⚠️  Modelo '{MODEL}' não encontrado! Disponíveis: {model_names}")
    except Exception as e:
        print(f"❌ Ollama não acessível: {e}")
        return

    results = []
    for test_num, desc, msg, expected in TESTS:
        r = run_test(test_num, desc, msg, expected)
        results.append(r)
        if test_num < len(TESTS):
            time.sleep(1)  # pausa breve entre testes

    # Salva relatório
    report = generate_report(results)
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"\n\n{'='*65}")
    print(f"  RELATÓRIO SALVO: {REPORT_PATH}")

    correct = sum(1 for r in results if r["tool_correct"])
    print(f"  SCORE FINAL   : {correct}/{len(results)} tools corretas")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    main()
