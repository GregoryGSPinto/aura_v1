import shutil
import subprocess
from pathlib import Path
from typing import Optional

from app.core.exceptions import AuraError


class VSCodeTool:
    def open_path(self, path: str) -> dict:
        target = Path(path).expanduser().resolve()
        if not target.exists():
            raise AuraError("path_not_found", "O caminho solicitado para o VS Code não existe.", status_code=404)

        code_bin = shutil.which("code")
        if code_bin:
            subprocess.Popen([code_bin, str(target)])
            return {"opened_in": "code", "path": str(target), "message": f"{target.name} aberto no VS Code."}

        subprocess.Popen(["open", "-a", "Visual Studio Code", str(target)])
        return {"opened_in": "open", "path": str(target), "message": f"{target.name} aberto no VS Code."}

    def open_file(self, path: str, line: Optional[int] = None) -> dict:
        target = Path(path).expanduser().resolve()
        if not target.exists():
            raise AuraError("file_not_found", "Arquivo solicitado não existe.", status_code=404)
        code_bin = shutil.which("code")
        if code_bin:
            args = [code_bin]
            if line:
                args.extend(["-g", f"{target}:{line}"])
            else:
                args.append(str(target))
            subprocess.Popen(args)
            return {"opened_in": "code", "path": str(target), "line": line}
        subprocess.Popen(["open", "-a", "Visual Studio Code", str(target)])
        return {"opened_in": "open", "path": str(target), "line": line}

    def open_app(self) -> dict:
        subprocess.Popen(["open", "-a", "Visual Studio Code"])
        return {"opened_in": "open", "message": "VS Code solicitado ao macOS."}
