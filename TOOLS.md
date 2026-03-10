# AURA Tools

## Registry

The canonical AI OS registry is implemented in [`aura/backend/app/aura_os/tools/registry.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/registry.py).
The permission model is defined in [`aura/backend/app/aura_os/tools/permissions.py`](/Users/user_pc/Projetos/aura_v1/aura/backend/app/aura_os/tools/permissions.py).

## Current tool groups

- `system_tool`
  - cpu
  - memory
  - disk
  - processes
  - health
- `browser_tool`
  - open_url
  - open_localhost
- `filesystem_tool`
  - list
  - read
  - find
  - grep
- `project_tool`
  - list_projects
  - open_project
  - inspect_project
  - run_script
- `terminal_tool`
  - git_status
  - pnpm_lint
  - pnpm_build
  - pnpm_test
  - pnpm_dev
- `vscode_tool`
  - open_app
  - open_path
  - open_file
- `llm_tool`
  - chat
  - summarize
  - analyze_repo
  - generate_plan
- planned tools
  - screen
  - calendar
  - email
  - internet
  - code

## Safety rules

- no arbitrary shell execution from user prompts
- blocked patterns include destructive commands
- all operational actions remain auditable
- execution stays local-first on the user machine
