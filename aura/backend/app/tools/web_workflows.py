"""
Web Workflows — Templates pré-definidos para sites que o Gregory usa.

Em vez de navegar genericamente (lento, frágil), estes workflows
sabem exatamente os seletores e URLs de cada site.

Pense neles como "macros" — o Gregory diz "cria projeto no Supabase"
e o workflow sabe exatamente quais URLs abrir e o que preencher.
"""

import json
import logging
from typing import Dict

from app.tools.tool_registry import BaseTool, ToolResult, AutonomyLevel

logger = logging.getLogger("aura")


# Templates de workflows por site
SITE_WORKFLOWS: Dict[str, dict] = {
    "github": {
        "base_url": "https://github.com",
        "workflows": {
            "create_repo": {
                "description": "Cria repositório no GitHub",
                "url": "https://github.com/new",
                "steps_description": (
                    "Para criar um repositório no GitHub:\n"
                    "1. Abra https://github.com/new no Chrome\n"
                    "2. Preencha o campo 'Repository name' (seletor: #repository_name ou input[name='repository[name]'])\n"
                    "3. Selecione visibilidade: Private (seletor: #repository_visibility_private)\n"
                    "4. Clique 'Create repository' (seletor: button[type='submit'] com texto 'Create repository')\n"
                    "5. Verifique se a URL mudou para github.com/USER/REPO"
                )
            },
            "create_pr": {
                "description": "Cria Pull Request no GitHub",
                "steps_description": (
                    "Para criar um PR:\n"
                    "1. Navegue até o repositório\n"
                    "2. Clique na tab 'Pull requests'\n"
                    "3. Clique 'New pull request'\n"
                    "4. Selecione as branches\n"
                    "5. Preencha título e descrição\n"
                    "6. Clique 'Create pull request'"
                )
            }
        }
    },
    "vercel": {
        "base_url": "https://vercel.com",
        "workflows": {
            "check_deploy": {
                "description": "Verifica status do último deploy na Vercel",
                "url": "https://vercel.com/dashboard",
                "steps_description": (
                    "Para verificar deploy:\n"
                    "1. Abra https://vercel.com/dashboard\n"
                    "2. Leia a lista de projetos e seus status\n"
                    "3. Procure pelo projeto específico\n"
                    "4. Verifique se o status é 'Ready' (verde) ou 'Error' (vermelho)"
                )
            },
            "new_project": {
                "description": "Importa novo projeto na Vercel",
                "url": "https://vercel.com/new",
                "steps_description": (
                    "Para importar projeto:\n"
                    "1. Abra https://vercel.com/new\n"
                    "2. Selecione repositório do GitHub\n"
                    "3. Configure Root Directory, Build Command, Output Directory\n"
                    "4. Clique Deploy"
                )
            }
        }
    },
    "supabase": {
        "base_url": "https://supabase.com",
        "workflows": {
            "create_project": {
                "description": "Cria novo projeto no Supabase",
                "url": "https://supabase.com/dashboard/new",
                "steps_description": (
                    "Para criar projeto Supabase:\n"
                    "1. Abra https://supabase.com/dashboard/new\n"
                    "2. Preencha 'Project name'\n"
                    "3. Gere database password\n"
                    "4. Selecione região (South America se disponível)\n"
                    "5. Clique 'Create new project'\n"
                    "6. Aguarde provisionamento (~2 minutos)"
                )
            },
            "sql_editor": {
                "description": "Abre o SQL Editor do Supabase",
                "url": "https://supabase.com/dashboard/project/_/sql",
                "steps_description": (
                    "Para usar SQL Editor:\n"
                    "1. Abra o dashboard do projeto\n"
                    "2. Clique em 'SQL Editor' no menu lateral\n"
                    "3. Digite a query SQL\n"
                    "4. Clique 'Run' ou Ctrl+Enter"
                )
            }
        }
    }
}


class WebWorkflowTool(BaseTool):
    name = "web_workflow"
    description = (
        "Executa workflows pré-definidos em sites comuns: GitHub (criar repo, criar PR), "
        "Vercel (verificar deploy, importar projeto), Supabase (criar projeto, SQL editor). "
        "Use este tool quando Gregory pedir algo específico desses sites."
    )
    category = "browser"
    autonomy_level = AutonomyLevel.L2_APPROVAL
    parameters = {
        "type": "object",
        "properties": {
            "site": {
                "type": "string",
                "enum": ["github", "vercel", "supabase"],
                "description": "Site alvo"
            },
            "workflow": {
                "type": "string",
                "description": "Workflow a executar (ex: create_repo, check_deploy, create_project)"
            },
            "params": {
                "type": "object",
                "description": "Parâmetros do workflow (ex: {name: 'meu-repo', private: true})"
            }
        },
        "required": ["site", "workflow"]
    }

    async def execute(self, params: dict) -> ToolResult:
        site = params["site"]
        workflow_name = params["workflow"]
        workflow_params = params.get("params", {})

        site_config = SITE_WORKFLOWS.get(site)
        if not site_config:
            return ToolResult(success=False, output=None,
                              error=f"Site não configurado: {site}")

        workflow = site_config["workflows"].get(workflow_name)
        if not workflow:
            available = list(site_config["workflows"].keys())
            return ToolResult(success=False, output=None,
                              error=f"Workflow '{workflow_name}' não existe para {site}. Disponíveis: {available}")

        # Retornar as instruções de navegação para o LLM executar
        # O LLM vai usar browser tool (open_url, click, fill) para executar cada passo
        output = {
            "site": site,
            "workflow": workflow_name,
            "description": workflow["description"],
            "start_url": workflow.get("url", site_config["base_url"]),
            "navigation_guide": workflow["steps_description"],
            "params": workflow_params,
            "instruction": (
                f"Para completar este workflow no {site}:\n\n"
                f"{workflow['steps_description']}\n\n"
                f"Use as ferramentas 'browser' (open_url, get_page_content, click_element, fill_input) "
                f"para executar cada passo. Comece abrindo a URL: {workflow.get('url', site_config['base_url'])}\n\n"
                f"Parâmetros fornecidos: {json.dumps(workflow_params, ensure_ascii=False)}"
            )
        }

        return ToolResult(
            success=True,
            output=json.dumps(output, ensure_ascii=False, indent=2)
        )
