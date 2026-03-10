# 🤖 PROMPT MASTER — AURA AI OS
## Controle do Mac + Screen Awareness + Automação + Dev Copilot

---

## 📋 VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                      AURA AI OS                              │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)          │  Backend (FastAPI)           │
│  ├─ AI Orb HUD               │  ├─ System Control Module    │
│  ├─ Screen Preview           │  ├─ Vision Module            │
│  ├─ Agent Activity Panel     │  ├─ Automation Engine        │
│  └─ Dev Copilot UI           │  ├─ Developer Agent          │
│                              │  └─ Tool Registry            │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 🗂️ ESTRUTURA DO PROJETO ATUAL

```
backend/aura/
├── agents/           # Agentes existentes
├── core/             # Core do sistema
├── memory/           # Memória
├── tools/            # Tools existentes
└── api/              # Endpoints FastAPI

frontend/
├── app/              # Páginas Next.js
├── components/       # Componentes React
└── lib/              # APIs e utilidades
```

---

## 🔧 FASE 1 — SYSTEM CONTROL MODULE

### 📁 Criar estrutura:
```
backend/aura/system_control/
├── __init__.py
├── controller.py
├── app_manager.py
├── file_manager.py
└── terminal.py
```

### 📄 `backend/aura/system_control/__init__.py`
```python
"""System Control Module - Controle do sistema operacional."""

from .controller import SystemController
from .app_manager import AppManager
from .file_manager import FileManager
from .terminal import TerminalExecutor

__all__ = ['SystemController', 'AppManager', 'FileManager', 'TerminalExecutor']
```

### 📄 `backend/aura/system_control/controller.py`
```python
"""Controlador principal do sistema."""

import subprocess
import platform
import psutil
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum

class OSPlatform(Enum):
    MACOS = "darwin"
    LINUX = "linux"
    WINDOWS = "windows"

@dataclass
class SystemInfo:
    platform: str
    version: str
    processor: str
    memory_gb: float
    disk_gb: float
    uptime_seconds: int

@dataclass
class ProcessInfo:
    pid: int
    name: str
    status: str
    cpu_percent: float
    memory_mb: float
    
class SystemController:
    """Controlador do sistema operacional."""
    
    def __init__(self):
        self.platform = platform.system().lower()
        self._require_confirmation = True
        
    def get_system_info(self) -> SystemInfo:
        """Retorna informações do sistema."""
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        boot_time = psutil.boot_time()
        uptime = int(__import__('time').time() - boot_time)
        
        return SystemInfo(
            platform=platform.system(),
            version=platform.version(),
            processor=platform.processor(),
            memory_gb=mem.total / (1024**3),
            disk_gb=disk.total / (1024**3),
            uptime_seconds=uptime
        )
    
    def list_processes(self, limit: int = 20) -> List[ProcessInfo]:
        """Lista processos em execução."""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'status', 'cpu_percent', 'memory_info']):
            try:
                processes.append(ProcessInfo(
                    pid=proc.info['pid'],
                    name=proc.info['name'],
                    status=proc.info['status'],
                    cpu_percent=proc.info['cpu_percent'] or 0.0,
                    memory_mb=proc.info['memory_info'].rss / (1024**2) if proc.info['memory_info'] else 0.0
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return sorted(processes, key=lambda p: p.cpu_percent, reverse=True)[:limit]
    
    def kill_process(self, pid: int, confirm: bool = True) -> Dict[str, Any]:
        """Encerra um processo."""
        if confirm and self._require_confirmation:
            return {
                "success": False,
                "requires_confirmation": True,
                "message": f"Confirme para encerrar o processo {pid}"
            }
        
        try:
            process = psutil.Process(pid)
            name = process.name()
            process.terminate()
            return {
                "success": True,
                "message": f"Processo {name} (PID: {pid}) encerrado"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Retorna métricas em tempo real."""
        cpu = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_percent": cpu,
            "memory": {
                "total_gb": mem.total / (1024**3),
                "used_gb": mem.used / (1024**3),
                "percent": mem.percent
            },
            "disk": {
                "total_gb": disk.total / (1024**3),
                "used_gb": disk.used / (1024**3),
                "percent": (disk.used / disk.total) * 100
            },
            "network": self._get_network_stats()
        }
    
    def _get_network_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas de rede."""
        net_io = psutil.net_io_counters()
        return {
            "bytes_sent_mb": net_io.bytes_sent / (1024**2),
            "bytes_recv_mb": net_io.bytes_recv / (1024**2),
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv
        }
```

### 📄 `backend/aura/system_control/app_manager.py`
```python
"""Gerenciador de aplicativos."""

import subprocess
import os
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

@dataclass
class AppInfo:
    name: str
    bundle_id: str
    path: str
    is_running: bool = False

class AppManager:
    """Gerencia aplicativos do macOS."""
    
    COMMON_APPS = {
        "safari": "/Applications/Safari.app",
        "chrome": "/Applications/Google Chrome.app",
        "firefox": "/Applications/Firefox.app",
        "vscode": "/Applications/Visual Studio Code.app",
        "cursor": "/Applications/Cursor.app",
        "terminal": "/System/Applications/Utilities/Terminal.app",
        "iterm": "/Applications/iTerm.app",
        "spotify": "/Applications/Spotify.app",
        "slack": "/Applications/Slack.app",
        "discord": "/Applications/Discord.app",
        "notion": "/Applications/Notion.app",
        "obsidian": "/Applications/Obsidian.app",
        "finder": "/System/Library/CoreServices/Finder.app",
        "system preferences": "/System/Applications/System Preferences.app",
    }
    
    def __init__(self):
        self.platform = __import__('platform').system().lower()
    
    def open_app(self, app_name: str) -> Dict[str, Any]:
        """Abre um aplicativo."""
        app_path = self._resolve_app_path(app_name)
        
        if not app_path:
            return {
                "success": False,
                "error": f"Aplicativo '{app_name}' não encontrado"
            }
        
        try:
            if self.platform == "darwin":  # macOS
                subprocess.run(["open", app_path], check=True)
            elif self.platform == "linux":
                subprocess.run([app_path], check=True)
            else:
                os.startfile(app_path)
            
            return {
                "success": True,
                "message": f"{app_name} aberto",
                "path": app_path
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def close_app(self, app_name: str) -> Dict[str, Any]:
        """Fecha um aplicativo."""
        try:
            if self.platform == "darwin":
                script = f'tell application "{app_name}" to quit'
                subprocess.run(["osascript", "-e", script], check=True)
                return {
                    "success": True,
                    "message": f"{app_name} fechado"
                }
            else:
                # Linux/Windows
                import psutil
                for proc in psutil.process_iter(['name']):
                    if app_name.lower() in proc.info['name'].lower():
                        proc.terminate()
                return {
                    "success": True,
                    "message": f"{app_name} encerrado"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def focus_app(self, app_name: str) -> Dict[str, Any]:
        """Traz aplicativo para frente."""
        try:
            if self.platform == "darwin":
                script = f'tell application "{app_name}" to activate'
                subprocess.run(["osascript", "-e", script], check=True)
                return {
                    "success": True,
                    "message": f"{app_name} em foco"
                }
            return {"success": False, "error": "Não suportado nesta plataforma"}
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def list_running_apps(self) -> List[Dict[str, Any]]:
        """Lista aplicativos em execução."""
        try:
            if self.platform == "darwin":
                result = subprocess.run(
                    ["osascript", "-e", 'tell application "System Events" to get name of every application process whose background only is false'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                apps = [name.strip() for name in result.stdout.split(",")]
                return [{"name": app, "is_running": True} for app in apps]
            else:
                import psutil
                apps = []
                for proc in psutil.process_iter(['name', 'status']):
                    if proc.info['status'] == psutil.STATUS_RUNNING:
                        apps.append({"name": proc.info['name'], "is_running": True})
                return apps
        except Exception as e:
            return [{"error": str(e)}]
    
    def _resolve_app_path(self, app_name: str) -> Optional[str]:
        """Resolve o caminho do aplicativo."""
        app_name_lower = app_name.lower()
        
        # Verificar nome exato
        if app_name_lower in self.COMMON_APPS:
            return self.COMMON_APPS[app_name_lower]
        
        # Procurar variações
        for name, path in self.COMMON_APPS.items():
            if app_name_lower in name or name in app_name_lower:
                if Path(path).exists():
                    return path
        
        # Procurar em /Applications
        for app_dir in Path("/Applications").glob("*.app"):
            if app_name_lower in app_dir.name.lower():
                return str(app_dir)
        
        return None
    
    def get_app_info(self, app_name: str) -> Optional[AppInfo]:
        """Retorna informações do aplicativo."""
        path = self._resolve_app_path(app_name)
        if not path:
            return None
        
        running_apps = [a['name'].lower() for a in self.list_running_apps()]
        
        return AppInfo(
            name=app_name,
            bundle_id="",  # Preencher se necessário
            path=path,
            is_running=app_name.lower() in running_apps
        )
```

### 📄 `backend/aura/system_control/file_manager.py`
```python
"""Gerenciador de arquivos."""

import os
import shutil
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime

@dataclass
class FileInfo:
    name: str
    path: str
    size_bytes: int
    is_directory: bool
    modified_at: datetime
    extension: Optional[str]

class FileManager:
    """Gerencia operações de arquivo."""
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or os.path.expanduser("~"))
        self._allowed_paths = [
            os.path.expanduser("~/Documents"),
            os.path.expanduser("~/Desktop"),
            os.path.expanduser("~/Downloads"),
            os.path.expanduser("~/Projects"),
            os.path.expanduser("~/Projetos"),
        ]
    
    def _is_allowed(self, path: str) -> bool:
        """Verifica se o caminho é permitido."""
        resolved = Path(path).resolve()
        return any(str(resolved).startswith(str(Path(allowed).resolve())) 
                   for allowed in self._allowed_paths)
    
    def list_directory(self, path: Optional[str] = None) -> Dict[str, Any]:
        """Lista conteúdo de um diretório."""
        target_path = Path(path) if path else self.base_path
        
        if not self._is_allowed(target_path):
            return {
                "success": False,
                "error": "Acesso negado a este diretório"
            }
        
        try:
            items = []
            for item in target_path.iterdir():
                stat = item.stat()
                items.append(FileInfo(
                    name=item.name,
                    path=str(item),
                    size_bytes=stat.st_size,
                    is_directory=item.is_dir(),
                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                    extension=item.suffix if not item.is_dir() else None
                ))
            
            return {
                "success": True,
                "path": str(target_path),
                "items": [
                    {
                        "name": item.name,
                        "path": item.path,
                        "size_bytes": item.size_bytes,
                        "is_directory": item.is_directory,
                        "modified_at": item.modified_at.isoformat(),
                        "extension": item.extension
                    }
                    for item in sorted(items, key=lambda x: (not x.is_directory, x.name.lower()))
                ]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def read_file(self, path: str, max_lines: int = 100) -> Dict[str, Any]:
        """Lê conteúdo de um arquivo."""
        if not self._is_allowed(path):
            return {"success": False, "error": "Acesso negado"}
        
        try:
            file_path = Path(path)
            if not file_path.exists():
                return {"success": False, "error": "Arquivo não encontrado"}
            
            if file_path.stat().st_size > 1024 * 1024:  # 1MB
                return {"success": False, "error": "Arquivo muito grande"}
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()[:max_lines]
            
            return {
                "success": True,
                "content": ''.join(lines),
                "total_lines": len(lines),
                "truncated": len(lines) >= max_lines
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def create_file(self, path: str, content: str) -> Dict[str, Any]:
        """Cria um novo arquivo."""
        if not self._is_allowed(path):
            return {"success": False, "error": "Acesso negado"}
        
        try:
            file_path = Path(path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return {
                "success": True,
                "message": f"Arquivo criado: {path}",
                "path": str(file_path)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_file(self, path: str, confirm: bool = True) -> Dict[str, Any]:
        """Remove um arquivo ou diretório."""
        if not self._is_allowed(path):
            return {"success": False, "error": "Acesso negado"}
        
        if confirm:
            return {
                "success": False,
                "requires_confirmation": True,
                "message": f"Confirme para deletar: {path}"
            }
        
        try:
            target = Path(path)
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            
            return {
                "success": True,
                "message": f"Removido: {path}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def search_files(self, query: str, path: Optional[str] = None) -> Dict[str, Any]:
        """Busca arquivos por nome."""
        target_path = Path(path) if path else self.base_path
        
        if not self._is_allowed(target_path):
            return {"success": False, "error": "Acesso negado"}
        
        try:
            results = []
            query_lower = query.lower()
            
            for item in target_path.rglob("*"):
                if query_lower in item.name.lower():
                    results.append({
                        "name": item.name,
                        "path": str(item),
                        "is_directory": item.is_dir()
                    })
                
                if len(results) >= 50:  # Limite de resultados
                    break
            
            return {
                "success": True,
                "query": query,
                "results": results
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
```

### 📄 `backend/aura/system_control/terminal.py`
```python
"""Executor de comandos de terminal."""

import subprocess
import shlex
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re

@dataclass
class CommandResult:
    command: str
    stdout: str
    stderr: str
    return_code: int
    execution_time_ms: int

class TerminalExecutor:
    """Executa comandos de terminal com segurança."""
    
    # Comandos bloqueados por segurança
    BLOCKED_COMMANDS = [
        'rm -rf /',
        'rm -rf /*',
        'dd if=/dev/zero',
        'mkfs',
        'format',
        ':(){ :|:& };:',  # Fork bomb
    ]
    
    # Comandos que requerem confirmação
    DANGEROUS_PATTERNS = [
        r'rm\s+-[rf].*',
        r'chmod\s+-R',
        r'chown\s+-R',
        r'sudo.*',
        r'>.+/dev/',
    ]
    
    def __init__(self, cwd: Optional[str] = None, require_confirmation: bool = True):
        self.cwd = cwd or os.path.expanduser("~")
        self.require_confirmation = require_confirmation
        self.command_history: List[CommandResult] = []
    
    def _is_blocked(self, command: str) -> bool:
        """Verifica se o comando é bloqueado."""
        cmd_lower = command.lower().strip()
        for blocked in self.BLOCKED_COMMANDS:
            if blocked in cmd_lower:
                return True
        return False
    
    def _is_dangerous(self, command: str) -> bool:
        """Verifica se o comando é perigoso."""
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return True
        return False
    
    def execute(
        self, 
        command: str, 
        timeout: int = 30,
        confirm_dangerous: bool = False
    ) -> Dict[str, Any]:
        """Executa um comando de terminal."""
        
        # Verificar comando bloqueado
        if self._is_blocked(command):
            return {
                "success": False,
                "error": "Comando bloqueado por segurança",
                "blocked": True
            }
        
        # Verificar comando perigoso
        if self._is_dangerous(command) and self.require_confirmation and not confirm_dangerous:
            return {
                "success": False,
                "requires_confirmation": True,
                "message": f"Este comando pode ser perigoso. Confirme: {command}",
                "command": command
            }
        
        import time
        start_time = time.time()
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.cwd,
                env={**os.environ, 'LANG': 'en_US.UTF-8'}
            )
            
            execution_time = int((time.time() - start_time) * 1000)
            
            cmd_result = CommandResult(
                command=command,
                stdout=result.stdout,
                stderr=result.stderr,
                return_code=result.returncode,
                execution_time_ms=execution_time
            )
            
            self.command_history.append(cmd_result)
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode,
                "execution_time_ms": execution_time
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Comando excedeu o tempo limite de {timeout}s"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def execute_git(self, subcommand: str, args: str = "") -> Dict[str, Any]:
        """Executa comandos git."""
        command = f"git {subcommand} {args}".strip()
        return self.execute(command)
    
    def navigate(self, path: str) -> Dict[str, Any]:
        """Muda o diretório atual."""
        try:
            new_path = Path(path).expanduser().resolve()
            if new_path.exists() and new_path.is_dir():
                self.cwd = str(new_path)
                return {
                    "success": True,
                    "current_directory": self.cwd
                }
            return {
                "success": False,
                "error": f"Diretório não encontrado: {path}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_current_directory(self) -> str:
        """Retorna diretório atual."""
        return self.cwd
    
    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retorna histórico de comandos."""
        return [
            {
                "command": r.command,
                "return_code": r.return_code,
                "execution_time_ms": r.execution_time_ms
            }
            for r in self.command_history[-limit:]
        ]
```

---

## 👁️ FASE 2 — VISION MODULE (Screen Awareness)

### 📁 Estrutura:
```
backend/aura/vision/
├── __init__.py
├── capture.py
├── analyzer.py
└── ocr.py
```

### 📄 `backend/aura/vision/__init__.py`
```python
"""Vision Module - Captura e análise de tela."""

from .capture import ScreenCapture
from .analyzer import ScreenAnalyzer

__all__ = ['ScreenCapture', 'ScreenAnalyzer']
```

### 📄 `backend/aura/vision/capture.py`
```python
"""Captura de tela."""

import platform
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import tempfile

class ScreenCapture:
    """Captura screenshots do sistema."""
    
    def __init__(self):
        self.platform = platform.system().lower()
        self.temp_dir = Path(tempfile.gettempdir()) / "aura_screenshots"
        self.temp_dir.mkdir(exist_ok=True)
    
    def capture(
        self, 
        filename: Optional[str] = None,
        region: Optional[tuple] = None
    ) -> Dict[str, Any]:
        """Captura a tela."""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = filename or f"screenshot_{timestamp}.png"
        filepath = self.temp_dir / filename
        
        try:
            if self.platform == "darwin":  # macOS
                import subprocess
                
                if region:
                    # Capturar região específica
                    x, y, width, height = region
                    cmd = [
                        "screencapture",
                        "-R", f"{x},{y},{width},{height}",
                        str(filepath)
                    ]
                else:
                    # Capturar tela inteira
                    cmd = ["screencapture", "-x", str(filepath)]
                
                subprocess.run(cmd, check=True, capture_output=True)
                
            elif self.platform == "linux":
                import subprocess
                
                if region:
                    x, y, w, h = region
                    cmd = [
                        "import",
                        "-window", "root",
                        "-crop", f"{w}x{h}+{x}+{y}",
                        str(filepath)
                    ]
                else:
                    cmd = ["import", "-window", "root", str(filepath)]
                
                subprocess.run(cmd, check=True, capture_output=True)
                
            else:  # Windows
                try:
                    import pyautogui
                    screenshot = pyautogui.screenshot(region=region)
                    screenshot.save(filepath)
                except ImportError:
                    return {
                        "success": False,
                        "error": "pyautogui não instalado. Instale com: pip install pyautogui"
                    }
            
            return {
                "success": True,
                "path": str(filepath),
                "filename": filename,
                "timestamp": timestamp
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def capture_window(self, window_name: str) -> Dict[str, Any]:
        """Captura uma janela específica."""
        
        try:
            if self.platform == "darwin":
                import subprocess
                
                # Usar AppleScript para focar a janela
                script = f'''
                    tell application "System Events"
                        tell process "{window_name}"
                            set frontmost to true
                        end tell
                    end tell
                '''
                subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
                
                # Aguardar um pouco e capturar
                import time
                time.sleep(0.5)
                
                return self.capture(filename=f"{window_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
                
            else:
                return {
                    "success": False,
                    "error": "Captura de janela específica não implementada para esta plataforma"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def list_screenshots(self, limit: int = 10) -> Dict[str, Any]:
        """Lista screenshots recentes."""
        try:
            screenshots = sorted(
                self.temp_dir.glob("*.png"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )[:limit]
            
            return {
                "success": True,
                "screenshots": [
                    {
                        "path": str(s),
                        "filename": s.name,
                        "created": datetime.fromtimestamp(s.stat().st_mtime).isoformat()
                    }
                    for s in screenshots
                ]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
```

### 📄 `backend/aura/vision/analyzer.py`
```python
"""Análise de imagens da tela usando modelo multimodal."""

import base64
from typing import Optional, Dict, Any, List
from pathlib import Path
import json

class ScreenAnalyzer:
    """Analisa screenshots usando IA."""
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self.analysis_history: List[Dict] = []
    
    def analyze(
        self, 
        image_path: str,
        question: str = "O que você vê nesta tela?",
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Analiza uma imagem da tela."""
        
        try:
            # Ler imagem e converter para base64
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Construir prompt
            system_prompt = """Você é um assistente de análise de tela. 
Analise a imagem fornecida e responda à pergunta do usuário.
Seja conciso mas informativo."""

            if context:
                system_prompt += f"\n\nContexto adicional: {context}"
            
            # Aqui você integraria com seu modelo multimodal (GPT-4V, Claude, etc.)
            # Por enquanto, retornamos uma estrutura mock
            
            analysis = {
                "success": True,
                "question": question,
                "analysis": self._mock_analysis(question),
                "elements_detected": [
                    "janela de código",
                    "terminal",
                    "navegador"
                ],
                "suggestions": [
                    "Posso ajudar com o código visível",
                    "Há um erro na linha 42"
                ]
            }
            
            self.analysis_history.append({
                "image_path": image_path,
                "question": question,
                "analysis": analysis
            })
            
            return analysis
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _mock_analysis(self, question: str) -> str:
        """Análise simulada para testes."""
        responses = {
            "O que você vê nesta tela?": "Vejo uma IDE (VS Code) aberta com código Python. Há também um terminal na parte inferior mostrando logs de execução.",
            "Há erros?": "Sim, identifiquei um erro de sintaxe na linha 15 - falta um fechamento de parêntese.",
            "Que aplicativos estão abertos?": "VS Code, Terminal, Chrome e Finder estão abertos.",
        }
        return responses.get(question, f"Análise da tela para: {question}")
    
    def compare_screenshots(
        self, 
        image_path1: str, 
        image_path2: str
    ) -> Dict[str, Any]:
        """Compara duas screenshots."""
        
        try:
            # Implementar comparação de imagens
            return {
                "success": True,
                "differences": [
                    "Nova janela aberta no centro",
                    "Texto alterado no terminal"
                ],
                "similarity_score": 0.85
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_text(self, image_path: str) -> Dict[str, Any]:
        """Extrai texto da imagem usando OCR."""
        
        try:
            # Integrar com OCR (Tesseract, EasyOCR, etc.)
            # Mock por enquanto
            return {
                "success": True,
                "text": "def hello_world():\n    print('Hello')",
                "regions": [
                    {"text": "def hello_world():", "bbox": [10, 10, 200, 30]},
                    {"text": "print('Hello')", "bbox": [20, 40, 150, 30]}
                ]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
```

---

## ⚙️ FASE 3 — AUTOMATION ENGINE

### 📁 Estrutura:
```
backend/aura/automation/
├── __init__.py
├── workflow.py
├── scheduler.py
└── triggers.py
```

### 📄 `backend/aura/automation/workflow.py`
```python
"""Workflow Engine - Automação de tarefas."""

import json
import uuid
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import asyncio

class WorkflowStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class TriggerType(Enum):
    SCHEDULE = "schedule"
    EVENT = "event"
    MANUAL = "manual"

@dataclass
class WorkflowStep:
    id: str
    name: str
    action: str
    params: Dict[str, Any]
    depends_on: Optional[List[str]] = None
    
@dataclass
class Workflow:
    id: str
    name: str
    description: str
    trigger_type: TriggerType
    trigger_config: Dict[str, Any]
    steps: List[WorkflowStep]
    status: WorkflowStatus
    created_at: datetime
    last_run: Optional[datetime] = None
    run_count: int = 0

class WorkflowEngine:
    """Motor de execução de workflows."""
    
    def __init__(self):
        self.workflows: Dict[str, Workflow] = {}
        self.action_handlers: Dict[str, Callable] = {}
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Registra handlers de ações padrão."""
        from ..system_control import AppManager, TerminalExecutor
        
        app_manager = AppManager()
        terminal = TerminalExecutor()
        
        self.action_handlers = {
            "open_app": app_manager.open_app,
            "close_app": app_manager.close_app,
            "execute_command": terminal.execute,
            "send_notification": self._send_notification,
            "wait": self._wait,
        }
    
    def _send_notification(self, title: str, message: str) -> Dict[str, Any]:
        """Envia notificação do sistema."""
        try:
            import subprocess
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _wait(self, seconds: int) -> Dict[str, Any]:
        """Aguarda N segundos."""
        import time
        time.sleep(seconds)
        return {"success": True}
    
    def create_workflow(
        self,
        name: str,
        description: str,
        trigger_type: str,
        trigger_config: Dict[str, Any],
        steps: List[Dict[str, Any]]
    ) -> Workflow:
        """Cria um novo workflow."""
        
        workflow = Workflow(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            trigger_type=TriggerType(trigger_type),
            trigger_config=trigger_config,
            steps=[WorkflowStep(**step) for step in steps],
            status=WorkflowStatus.PENDING,
            created_at=datetime.now()
        )
        
        self.workflows[workflow.id] = workflow
        return workflow
    
    def run_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Executa um workflow."""
        
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return {"success": False, "error": "Workflow não encontrado"}
        
        workflow.status = WorkflowStatus.RUNNING
        workflow.last_run = datetime.now()
        
        results = []
        
        for step in workflow.steps:
            try:
                handler = self.action_handlers.get(step.action)
                if handler:
                    result = handler(**step.params)
                    results.append({
                        "step_id": step.id,
                        "success": result.get("success", True),
                        "result": result
                    })
                else:
                    results.append({
                        "step_id": step.id,
                        "success": False,
                        "error": f"Handler não encontrado: {step.action}"
                    })
            except Exception as e:
                results.append({
                    "step_id": step.id,
                    "success": False,
                    "error": str(e)
                })
        
        workflow.run_count += 1
        workflow.status = WorkflowStatus.COMPLETED
        
        return {
            "success": all(r["success"] for r in results),
            "workflow_id": workflow_id,
            "results": results
        }
    
    def list_workflows(self) -> List[Dict[str, Any]]:
        """Lista todos os workflows."""
        return [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description,
                "status": w.status.value,
                "trigger_type": w.trigger_type.value,
                "run_count": w.run_count,
                "last_run": w.last_run.isoformat() if w.last_run else None
            }
            for w in self.workflows.values()
        ]
    
    def delete_workflow(self, workflow_id: str) -> bool:
        """Remove um workflow."""
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            return True
        return False
```

---

## 👨‍💻 FASE 4 — DEVELOPER AGENT

### 📄 `backend/aura/agents/dev_agent.py`
```python
"""Developer Agent - Copiloto de programação."""

import ast
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

@dataclass
class CodeIssue:
    line: int
    column: int
    severity: str  # error, warning, info
    message: str
    code: Optional[str] = None

class DeveloperAgent:
    """Agente especializado em desenvolvimento."""
    
    def __init__(self, workspace_path: Optional[str] = None):
        self.workspace_path = Path(workspace_path or ".")
        self.supported_languages = ["python", "javascript", "typescript", "json"]
    
    def analyze_code(self, file_path: str) -> Dict[str, Any]:
        """Analisa código em busca de problemas."""
        
        try:
            path = Path(file_path)
            if not path.exists():
                return {"success": False, "error": "Arquivo não encontrado"}
            
            content = path.read_text(encoding='utf-8')
            issues = []
            
            # Análise específica por linguagem
            if path.suffix == '.py':
                issues = self._analyze_python(content)
            elif path.suffix in ['.js', '.ts']:
                issues = self._analyze_javascript(content)
            
            return {
                "success": True,
                "file": file_path,
                "language": path.suffix[1:],
                "issues": [self._issue_to_dict(i) for i in issues],
                "issue_count": len(issues),
                "lines": len(content.split('\n'))
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _analyze_python(self, content: str) -> List[CodeIssue]:
        """Analisa código Python."""
        issues = []
        
        try:
            tree = ast.parse(content)
            
            # Verificar funções sem docstrings
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if not ast.get_docstring(node):
                        issues.append(CodeIssue(
                            line=node.lineno,
                            column=node.col_offset,
                            severity="warning",
                            message=f"Função '{node.name}' sem docstring"
                        ))
                
                # Verificar imports não usados (simplificado)
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name not in content.replace(f"import {alias.name}", ""):
                            issues.append(CodeIssue(
                                line=node.lineno,
                                column=node.col_offset,
                                severity="info",
                                message=f"Possível import não usado: {alias.name}"
                            ))
                            
        except SyntaxError as e:
            issues.append(CodeIssue(
                line=e.lineno or 1,
                column=e.offset or 0,
                severity="error",
                message=f"Erro de sintaxe: {e.msg}"
            ))
        
        return issues
    
    def _analyze_javascript(self, content: str) -> List[CodeIssue]:
        """Analisa código JavaScript/TypeScript."""
        issues = []
        
        # Verificações básicas
        lines = content.split('\n')
        for i, line in enumerate(lines, 1):
            # Verificar console.log em produção
            if 'console.log' in line:
                issues.append(CodeIssue(
                    line=i,
                    column=line.find('console.log'),
                    severity="warning",
                    message="console.log encontrado - remover em produção"
                ))
            
            # Verificar debugger
            if 'debugger;' in line:
                issues.append(CodeIssue(
                    line=i,
                    column=line.find('debugger;'),
                    severity="error",
                    message="Statement 'debugger' encontrado"
                ))
        
        return issues
    
    def _issue_to_dict(self, issue: CodeIssue) -> Dict[str, Any]:
        return {
            "line": issue.line,
            "column": issue.column,
            "severity": issue.severity,
            "message": issue.message,
            "code": issue.code
        }
    
    def run_tests(self, test_path: Optional[str] = None) -> Dict[str, Any]:
        """Executa testes do projeto."""
        
        try:
            cmd = ["pytest", "-v"]
            if test_path:
                cmd.append(test_path)
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.workspace_path
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_tests(self, file_path: str) -> Dict[str, Any]:
        """Gera testes para um arquivo."""
        
        try:
            path = Path(file_path)
            content = path.read_text(encoding='utf-8')
            
            # Analisar funções/classes
            tree = ast.parse(content)
            
            test_cases = []
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # Gerar teste básico
                    test_case = f"""
def test_{node.name}():
    # TODO: Implementar teste para {node.name}
    result = {node.name}()
    assert result is not None
"""
                    test_cases.append(test_case)
            
            test_file = path.parent / f"test_{path.name}"
            test_content = f"""# Auto-generated tests for {path.name}
import pytest
from {path.stem} import *

{chr(10).join(test_cases)}
"""
            
            return {
                "success": True,
                "test_file": str(test_file),
                "test_content": test_content,
                "test_count": len(test_cases)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def explain_error(self, error_message: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Explica um erro de código."""
        
        explanations = {
            "SyntaxError": "Erro de sintaxe - verifique parênteses, colunas e indentação",
            "NameError": "Variável ou função não definida - verifique se foi importada",
            "TypeError": "Tipo de dado incorreto - verifique os argumentos passados",
            "ImportError": "Módulo não encontrado - instale com pip ou verifique o nome",
            "IndentationError": "Erro de indentação - Python requer indentação consistente",
        }
        
        for error_type, explanation in explanations.items():
            if error_type in error_message:
                return {
                    "success": True,
                    "error_type": error_type,
                    "explanation": explanation,
                    "suggestion": "Verifique a documentação do erro para mais detalhes",
                    "context": context
                }
        
        return {
            "success": True,
            "error_type": "Unknown",
            "explanation": "Erro não reconhecido",
            "original_message": error_message
        }
    
    def refactor_suggestion(self, file_path: str) -> Dict[str, Any]:
        """Sugere refatorações para o código."""
        
        suggestions = [
            "Extrair funções grandes em funções menores",
            "Adicionar type hints para melhor documentação",
            "Usar list comprehensions onde apropriado",
            "Mover constantes para o topo do arquivo",
            "Adicionar tratamento de exceções"
        ]
        
        return {
            "success": True,
            "file": file_path,
            "suggestions": suggestions
        }
```

---

## 🔌 FASE 5 — API ENDPOINTS (FastAPI)

### 📄 `backend/aura/api/system_routes.py`
```python
"""Rotas de controle do sistema."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..system_control import SystemController, AppManager, FileManager, TerminalExecutor

router = APIRouter(prefix="/system", tags=["system"])

# Instâncias
system_ctrl = SystemController()
app_mgr = AppManager()
file_mgr = FileManager()
terminal = TerminalExecutor()

class CommandRequest(BaseModel):
    command: str
    confirm_dangerous: bool = False
    timeout: int = 30

class FileCreateRequest(BaseModel):
    path: str
    content: str

@router.get("/info")
async def get_system_info():
    """Retorna informações do sistema."""
    info = system_ctrl.get_system_info()
    return {
        "success": True,
        "data": {
            "platform": info.platform,
            "version": info.version,
            "processor": info.processor,
            "memory_gb": round(info.memory_gb, 2),
            "disk_gb": round(info.disk_gb, 2),
            "uptime_hours": info.uptime_seconds // 3600
        }
    }

@router.get("/metrics")
async def get_system_metrics():
    """Retorna métricas em tempo real."""
    return {"success": True, "data": system_ctrl.get_system_metrics()}

@router.get("/processes")
async def list_processes(limit: int = 20):
    """Lista processos em execução."""
    processes = system_ctrl.list_processes(limit)
    return {
        "success": True,
        "data": [
            {
                "pid": p.pid,
                "name": p.name,
                "status": p.status,
                "cpu_percent": p.cpu_percent,
                "memory_mb": round(p.memory_mb, 2)
            }
            for p in processes
        ]
    }

# App Management
@router.post("/apps/open")
async def open_app(request: Dict[str, str]):
    """Abre um aplicativo."""
    result = app_mgr.open_app(request["app_name"])
    return result

@router.post("/apps/close")
async def close_app(request: Dict[str, str]):
    """Fecha um aplicativo."""
    result = app_mgr.close_app(request["app_name"])
    return result

@router.get("/apps/running")
async def list_running_apps():
    """Lista aplicativos em execução."""
    apps = app_mgr.list_running_apps()
    return {"success": True, "data": apps}

# File Management
@router.get("/files/list")
async def list_files(path: Optional[str] = None):
    """Lista arquivos de um diretório."""
    result = file_mgr.list_directory(path)
    return result

@router.get("/files/read")
async def read_file(path: str, max_lines: int = 100):
    """Lê conteúdo de um arquivo."""
    result = file_mgr.read_file(path, max_lines)
    return result

@router.post("/files/create")
async def create_file(request: FileCreateRequest):
    """Cria um novo arquivo."""
    result = file_mgr.create_file(request.path, request.content)
    return result

@router.get("/files/search")
async def search_files(query: str, path: Optional[str] = None):
    """Busca arquivos."""
    result = file_mgr.search_files(query, path)
    return result

# Terminal
@router.post("/terminal/execute")
async def execute_command(request: CommandRequest):
    """Executa comando de terminal."""
    result = terminal.execute(
        request.command,
        timeout=request.timeout,
        confirm_dangerous=request.confirm_dangerous
    )
    return result

@router.post("/terminal/navigate")
async def navigate_directory(request: Dict[str, str]):
    """Muda diretório atual."""
    result = terminal.navigate(request["path"])
    return result

@router.get("/terminal/pwd")
async def get_current_directory():
    """Retorna diretório atual."""
    return {"success": True, "data": {"current_directory": terminal.get_current_directory()}}
```

### 📄 `backend/aura/api/vision_routes.py`
```python
"""Rotas de visão e análise de tela."""

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from ..vision import ScreenCapture, ScreenAnalyzer

router = APIRouter(prefix="/vision", tags=["vision"])

capture = ScreenCapture()
analyzer = ScreenAnalyzer()

class AnalysisRequest(BaseModel):
    image_path: str
    question: str = "O que você vê nesta tela?"
    context: Optional[str] = None

@router.post("/capture")
async def capture_screen():
    """Captura a tela atual."""
    result = capture.capture()
    return result

@router.post("/capture/window")
async def capture_window(window_name: str):
    """Captura uma janela específica."""
    result = capture.capture_window(window_name)
    return result

@router.post("/analyze")
async def analyze_screen(request: AnalysisRequest):
    """Analiza uma imagem da tela."""
    result = analyzer.analyze(
        request.image_path,
        request.question,
        request.context
    )
    return result

@router.get("/screenshots")
async def list_screenshots(limit: int = 10):
    """Lista screenshots recentes."""
    result = capture.list_screenshots(limit)
    return result

@router.post("/ocr")
async def extract_text(image_path: str):
    """Extrai texto de uma imagem."""
    result = analyzer.extract_text(image_path)
    return result
```

### 📄 `backend/aura/api/automation_routes.py`
```python
"""Rotas de automação."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from ..automation import WorkflowEngine

router = APIRouter(prefix="/automation", tags=["automation"])

engine = WorkflowEngine()

class WorkflowCreateRequest(BaseModel):
    name: str
    description: str
    trigger_type: str
    trigger_config: Dict[str, Any]
    steps: List[Dict[str, Any]]

@router.post("/workflows")
async def create_workflow(request: WorkflowCreateRequest):
    """Cria um novo workflow."""
    workflow = engine.create_workflow(
        name=request.name,
        description=request.description,
        trigger_type=request.trigger_type,
        trigger_config=request.trigger_config,
        steps=request.steps
    )
    return {
        "success": True,
        "data": {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status.value
        }
    }

@router.post("/workflows/{workflow_id}/run")
async def run_workflow(workflow_id: str):
    """Executa um workflow."""
    result = engine.run_workflow(workflow_id)
    return result

@router.get("/workflows")
async def list_workflows():
    """Lista todos os workflows."""
    workflows = engine.list_workflows()
    return {"success": True, "data": workflows}

@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Remove um workflow."""
    success = engine.delete_workflow(workflow_id)
    return {"success": success}
```

### 📄 `backend/aura/api/dev_routes.py`
```python
"""Rotas do Developer Agent."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from ..agents.dev_agent import DeveloperAgent

router = APIRouter(prefix="/dev", tags=["developer"])

agent = DeveloperAgent()

class ErrorExplainRequest(BaseModel):
    error_message: str
    context: Optional[str] = None

@router.post("/analyze")
async def analyze_code(file_path: str):
    """Analisa código em busca de problemas."""
    result = agent.analyze_code(file_path)
    return result

@router.post("/test")
async def run_tests(test_path: Optional[str] = None):
    """Executa testes."""
    result = agent.run_tests(test_path)
    return result

@router.post("/generate-tests")
async def generate_tests(file_path: str):
    """Gera testes para um arquivo."""
    result = agent.generate_tests(file_path)
    return result

@router.post("/explain-error")
async def explain_error(request: ErrorExplainRequest):
    """Explica um erro de código."""
    result = agent.explain_error(request.error_message, request.context)
    return result

@router.post("/refactor")
async def refactor_suggestion(file_path: str):
    """Sugere refatorações."""
    result = agent.refactor_suggestion(file_path)
    return result
```

---

## 🎨 FASE 6 — FRONTEND HUD

### 📄 `frontend/components/system/system-hud.tsx`
```tsx
"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  Cpu, 
  HardDrive, 
  Activity,
  Terminal,
  FolderOpen,
  AppWindow
} from 'lucide-react';

interface SystemMetrics {
  cpu_percent: number;
  memory: {
    used_gb: number;
    total_gb: number;
    percent: number;
  };
  disk: {
    used_gb: number;
    total_gb: number;
    percent: number;
  };
}

interface RunningApp {
  name: string;
  is_running: boolean;
}

export function SystemHUD() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [runningApps, setRunningApps] = useState<RunningApp[]>([]);
  const [currentDir, setCurrentDir] = useState('~');

  useEffect(() => {
    // Polling de métricas
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/v1/system/metrics');
        const data = await response.json();
        if (data.success) setMetrics(data.data);
      } catch (e) {
        console.error('Erro ao buscar métricas:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-72 bg-slate-950/90 backdrop-blur-xl border-l border-white/5 p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-cyan-400">
        <Monitor className="w-4 h-4" />
        <span className="text-sm font-medium">System Control</span>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="space-y-4">
          {/* CPU */}
          <MetricBar
            icon={<Cpu className="w-3 h-3" />}
            label="CPU"
            value={metrics.cpu_percent}
            color="cyan"
          />
          
          {/* Memory */}
          <MetricBar
            icon={<Activity className="w-3 h-3" />}
            label="Memory"
            value={metrics.memory.percent}
            sublabel={`${metrics.memory.used_gb.toFixed(1)}GB / ${metrics.memory.total_gb.toFixed(1)}GB`}
            color="violet"
          />
          
          {/* Disk */}
          <MetricBar
            icon={<HardDrive className="w-3 h-3" />}
            label="Disk"
            value={metrics.disk.percent}
            sublabel={`${metrics.disk.used_gb.toFixed(0)}GB / ${metrics.disk.total_gb.toFixed(0)}GB`}
            color="amber"
          />
        </div>
      )}

      {/* Diretório Atual */}
      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <Terminal className="w-3 h-3" />
          <span>Terminal</span>
        </div>
        <div className="text-sm font-mono text-cyan-400 truncate">
          {currentDir}
        </div>
      </div>

      {/* Apps em Execução */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AppWindow className="w-3 h-3" />
          <span>Running Apps</span>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {runningApps.slice(0, 5).map((app, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-xs text-slate-300 p-1.5 rounded-lg hover:bg-white/5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {app.name}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <QuickAction icon={<Terminal />} label="Terminal" />
        <QuickAction icon={<FolderOpen />} label="Files" />
      </div>
    </div>
  );
}

function MetricBar({ 
  icon, 
  label, 
  value, 
  sublabel,
  color 
}: { 
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel?: string;
  color: 'cyan' | 'violet' | 'amber';
}) {
  const colors = {
    cyan: 'from-cyan-500 to-cyan-400',
    violet: 'from-violet-500 to-violet-400',
    amber: 'from-amber-500 to-amber-400',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-slate-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${colors[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {sublabel && (
        <div className="text-[10px] text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-slate-300">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
```

### 📄 `frontend/components/vision/screen-preview.tsx`
```tsx
"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Eye, RefreshCw } from 'lucide-react';

export function ScreenPreview() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const captureScreen = async () => {
    setIsCapturing(true);
    try {
      const response = await fetch('/api/v1/vision/capture', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setScreenshot(data.path);
      }
    } catch (e) {
      console.error('Erro ao capturar:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  const analyzeScreen = async () => {
    if (!screenshot) return;
    
    try {
      const response = await fetch('/api/v1/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: screenshot,
          question: "O que você vê nesta tela?"
        })
      });
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
      }
    } catch (e) {
      console.error('Erro ao analisar:', e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Screen Awareness</span>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={captureScreen}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {isCapturing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            Capture
          </motion.button>
          
          {screenshot && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={analyzeScreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs hover:bg-violet-500/30"
            >
              <Eye className="w-3.5 h-3.5" />
              Analyze
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {screenshot && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-slate-900"
          >
            {/* Placeholder para screenshot */}
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              Screenshot: {screenshot}
            </div>
            
            {/* Overlay de análise */}
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-0 left-0 right-0 p-3 bg-slate-950/90 backdrop-blur-sm border-t border-white/10"
              >
                <p className="text-xs text-slate-300">{analysis}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## 🧪 FASE 7 — TESTES E INTEGRAÇÃO

### 📄 Executar testes:
```bash
# Backend
cd backend
python -m pytest tests/ -v

# Frontend
cd frontend
pnpm build
pnpm test
```

---

## 📝 FASE 8 — COMMIT

```bash
git add .
git commit -m "feat: evolve Aura into AI OS

- Add System Control Module (apps, files, terminal)
- Add Vision Module (screen capture, analysis)
- Add Automation Engine (workflows, scheduler)
- Add Developer Agent (code analysis, tests)
- Add System HUD to frontend
- Add Screen Preview component
- Integrate all modules with existing agent system
- Add security layer for dangerous commands"

git push origin main
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend
- [ ] System Control Module (`system_control/`)
  - [ ] `controller.py` - Info, processos, métricas
  - [ ] `app_manager.py` - Abrir/fechar apps
  - [ ] `file_manager.py` - CRUD de arquivos
  - [ ] `terminal.py` - Execução segura de comandos
- [ ] Vision Module (`vision/`)
  - [ ] `capture.py` - Screenshots
  - [ ] `analyzer.py` - Análise com IA
- [ ] Automation Engine (`automation/`)
  - [ ] `workflow.py` - Workflows
  - [ ] `scheduler.py` - Agendamento
- [ ] Developer Agent (`agents/dev_agent.py`)
  - [ ] Análise de código
  - [ ] Geração de testes
  - [ ] Explicação de erros
- [ ] API Routes
  - [ ] `/system/*` - Controle do sistema
  - [ ] `/vision/*` - Visão
  - [ ] `/automation/*` - Automação
  - [ ] `/dev/*` - Developer tools

### Frontend
- [ ] System HUD (`components/system/system-hud.tsx`)
- [ ] Screen Preview (`components/vision/screen-preview.tsx`)
- [ ] Integração com APIs

### Segurança
- [ ] Validação de comandos perigosos
- [ ] Confirmação para operações críticas
- [ ] Restrição de diretórios acessíveis

---

## 🎯 COMANDOS DA AURA AI OS

Após implementação, a Aura suportará:

### Controle do Sistema
```
"Aura, abrir VS Code"
"Aura, fechar Safari"
"Aura, mostrar processos"
"Aura, matar processo 1234"
```

### Arquivos
```
"Aura, listar arquivos da pasta Projetos"
"Aura, ler arquivo config.py"
"Aura, buscar arquivos com 'test' no nome"
"Aura, criar arquivo hello.py"
```

### Terminal
```
"Aura, executar git status"
"Aura, rodar python script.py"
"Aura, navegar para ~/Documents"
```

### Visão
```
"Aura, o que está na minha tela?"
"Aura, capturar tela"
"Aura, há erros neste código?"
```

### Automação
```
"Aura, todo dia às 9h abrir workspace"
"Aura, quando receber email, notificar"
```

### Developer
```
"Aura, analisar este código"
"Aura, gerar testes para utils.py"
"Aura, explicar este erro"
"Aura, sugerir refatorações"
```

---

## 🏆 RESULTADO FINAL

A Aura se torna um **verdadeiro AI Operating System**:

```
┌──────────────────────────────────────────────────────────┐
│  AURA AI OS                                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🖥 System Control    👁 Screen Awareness               │
│     ├─ Apps              ├─ Capture                     │
│     ├─ Files             ├─ Analysis                    │
│     ├─ Terminal          └─ OCR                         │
│     └─ Processos                                        │
│                                                          │
│  ⚙️ Automation        👨‍💻 Developer Agent                │
│     ├─ Workflows         ├─ Code Analysis               │
│     ├─ Scheduler         ├─ Test Generation             │
│     └─ Triggers          └─ Error Explanation           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Pronto para deploy e uso real!** 🚀
