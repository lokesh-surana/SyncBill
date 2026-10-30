"""
SyncBill ERP — Standalone Native Desktop App Runner
Launches the consolidated single-port server and WhatsApp Web Bridge
silently in the background (zero black windows) and opens a dedicated app window.
"""

import sys
import os
import time
import subprocess
import urllib.request
import shutil

_ROOT = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.join(_ROOT, "backend")
_PYTHON = os.path.join(_BACKEND_DIR, "venv", "Scripts", "python.exe")
_PYTHONW = os.path.join(_BACKEND_DIR, "venv", "Scripts", "pythonw.exe")
PY_EXEC = _PYTHONW if os.path.exists(_PYTHONW) else sys.executable

def find_browser():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def is_server_ready():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as res:
            return res.status == 200
    except Exception:
        return False

def is_whatsapp_ready():
    try:
        with urllib.request.urlopen("http://127.0.0.1:3001/status", timeout=1) as res:
            return res.status == 200
    except Exception:
        return False

def main():
    os.chdir(_ROOT)

    # 1. Start backend server silently if not running
    server_proc = None
    if not is_server_ready():
        cmd = [
            PY_EXEC, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--app-dir", _BACKEND_DIR
        ]
        server_proc = subprocess.Popen(
            cmd,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        for _ in range(30):
            if is_server_ready():
                break
            time.sleep(0.2)

    # 2. Start WhatsApp Bridge silently if not running
    whatsapp_proc = None
    if not is_whatsapp_ready():
        node_exe = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
        bridge_script = os.path.join(_ROOT, "whatsapp_bridge", "server.js")
        if os.path.exists(node_exe) and os.path.exists(bridge_script):
            whatsapp_proc = subprocess.Popen(
                [node_exe, bridge_script],
                cwd=os.path.join(_ROOT, "whatsapp_bridge"),
                creationflags=0x08000000 if sys.platform == "win32" else 0,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            for _ in range(25):
                if is_whatsapp_ready():
                    break
                time.sleep(0.2)

    # 3. Launch Dedicated App Window
    browser = find_browser()
    target_url = "http://127.0.0.1:8000"

    if browser:
        app_cmd = [browser, f"--app={target_url}", "--window-size=1366,850"]
        browser_proc = subprocess.Popen(app_cmd)
        browser_proc.wait()
    else:
        import webbrowser
        webbrowser.open(target_url)

    # 4. Clean up background processes when the window closes
    if server_proc:
        try:
            server_proc.terminate()
            server_proc.wait(timeout=2)
        except Exception:
            try:
                server_proc.kill()
            except Exception:
                pass

    if whatsapp_proc:
        try:
            whatsapp_proc.terminate()
            whatsapp_proc.wait(timeout=2)
        except Exception:
            try:
                whatsapp_proc.kill()
            except Exception:
                pass

if __name__ == "__main__":
    main()
