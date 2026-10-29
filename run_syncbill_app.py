"""
SyncBill ERP — Standalone Native Desktop App Runner
Launches the consolidated single-port server silently in the background
and opens a native dedicated application window without browser bars.
"""

import sys
import os
import time
import subprocess
import urllib.request
import signal

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

def main():
    os.chdir(_ROOT)

    # 1. Start backend server if not already running
    server_proc = None
    if not is_server_ready():
        # Start uvicorn silently using pythonw
        cmd = [
            PY_EXEC, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--app-dir", _BACKEND_DIR
        ]
        # CREATE_NO_WINDOW = 0x08000000 ensures zero console window popup
        server_proc = subprocess.Popen(
            cmd,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        # Wait up to 6 seconds for server to be ready
        for _ in range(30):
            if is_server_ready():
                break
            time.sleep(0.2)

    # 2. Launch Dedicated App Window
    browser = find_browser()
    target_url = "http://127.0.0.1:8000"

    if browser:
        app_cmd = [browser, f"--app={target_url}", "--window-size=1366,850"]
        # Run browser and wait until user closes the window
        browser_proc = subprocess.Popen(app_cmd)
        browser_proc.wait()
    else:
        import webbrowser
        webbrowser.open(target_url)

    # 3. Clean up server if we spawned it
    if server_proc:
        try:
            server_proc.terminate()
            server_proc.wait(timeout=2)
        except Exception:
            try:
                server_proc.kill()
            except Exception:
                pass

if __name__ == "__main__":
    main()

