"""
SyncBill ERP — Standalone Windows Desktop Executable Entrypoint
================================================================
Embeds:
1. Built React + Vite Frontend (frontend/dist)
2. FastAPI + Uvicorn Local Server
3. Native Application Window (Chrome/Edge App Mode — Zero Address Bar)
4. Persistent SQLite database in %APPDATA%/SyncBill/syncbill.db
"""

import os
import sys
import time
import socket
import threading
import subprocess
import webbrowser
import urllib.request

# Setup paths for frozen executable vs normal script
if getattr(sys, "frozen", False):
    APP_ROOT = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    EXE_DIR = os.path.dirname(sys.executable)
else:
    APP_ROOT = os.path.dirname(os.path.abspath(__file__))
    EXE_DIR = APP_ROOT

# Ensure backend directory is in sys.path
backend_path = os.path.join(APP_ROOT, "backend")
if os.path.exists(backend_path) and backend_path not in sys.path:
    sys.path.insert(0, backend_path)
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)


def find_available_port(start_port=8000):
    """Find an open TCP port starting from 8000."""
    for port in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


def run_server(port):
    """Run uvicorn server inside this process."""
    import uvicorn
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


def find_browser():
    """Locate Microsoft Edge or Google Chrome for clean native app-window mode."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def main():
    port = find_available_port(8000)

    # 1. Start embedded uvicorn server in a background daemon thread
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()

    # 2. Wait for server readiness
    url = f"http://127.0.0.1:{port}"
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=0.5) as r:
                if r.status == 200:
                    break
        except Exception:
            time.sleep(0.15)

    # 3. Launch Native App Window (Zero URL bar, standalone window)
    browser = find_browser()
    if browser:
        app_cmd = [browser, f"--app={url}", "--window-size=1366,850"]
        proc = subprocess.Popen(app_cmd)
        proc.wait()
    else:
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
