"""
build_exe.py — Compiles SyncBill ERP into a Standalone Shareable Windows Executable
==================================================================================
Builds 'dist/SyncBill_ERP.exe' (Single-File, No Python Required, Offline Ready).
"""

import os
import sys
import shutil
import subprocess

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(ROOT_DIR, "frontend", "dist")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
DB_FILE = os.path.join(BACKEND_DIR, "syncbill_dev.db")
PYINSTALLER_EXE = os.path.join(BACKEND_DIR, "venv", "Scripts", "pyinstaller.exe")

def check_prerequisites():
    print("[1/4] Checking build prerequisites...")
    if not os.path.exists(FRONTEND_DIST):
        print("  Building React frontend first via npm...")
        subprocess.run(["npm", "--prefix", "frontend", "run", "build"], check=True)
    print(f"  [OK] Frontend bundle found at: {FRONTEND_DIST}")

    if not os.path.exists(DB_FILE):
        print("  [!] Warning: syncbill_dev.db not found!")
    else:
        print(f"  [OK] Database file found at: {DB_FILE}")

def run_pyinstaller():
    print("\n[2/4] Running PyInstaller to build standalone Windows Executable...")
    
    hidden_imports = [
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.lifespans",
        "uvicorn.lifespans.auto",
        "uvicorn.lifespans.on",
        "uvicorn.lifespans.off",
        "anyio",
        "anyio._backends._asyncio",
        "sqlite3",
        "sqlalchemy.dialects.sqlite",
        "pyodbc",
        "app",
        "app.database",
        "app.models",
        "app.models.firm",
        "app.models.item",
        "app.models.customer",
        "app.models.invoice",
        "app.models.payment",
        "app.routers",
        "app.routers.firms",
        "app.routers.items",
        "app.routers.customers",
        "app.routers.invoices",
        "app.routers.payments",
        "app.routers.sync",
        "app.routers.reports",
        "app.routers.whatsapp",
        "app.schemas",
        "app.schemas.firm",
        "app.schemas.item",
        "app.schemas.customer",
        "app.schemas.invoice",
        "app.schemas.payment",
        "app.schemas.sync",
    ]

    cmd = [
        PYINSTALLER_EXE,
        "--name=SyncBill_ERP",
        "--onefile",
        "--noconsole",
        "--clean",
        f"--paths={BACKEND_DIR}",
        f"--add-data={FRONTEND_DIST};frontend_dist",
        f"--add-data={DB_FILE};.",
    ]

    for hi in hidden_imports:
        cmd.append(f"--hidden-import={hi}")

    cmd.append(os.path.join(ROOT_DIR, "desktop_main.py"))

    print("  Command: PyInstaller building...")
    subprocess.run(cmd, check=True)

def verify_output():
    print("\n[3/4] Verifying generated executable...")
    out_exe = os.path.join(ROOT_DIR, "dist", "SyncBill_ERP.exe")
    if os.path.exists(out_exe):
        size_mb = os.path.getsize(out_exe) / (1024 * 1024)
        print(f"  [SUCCESS] Executable generated: {out_exe}")
        print(f"  Size: {size_mb:.2f} MB")
        return out_exe
    else:
        print("  [ERROR] Executable was not found in dist/")
        return None

if __name__ == "__main__":
    check_prerequisites()
    run_pyinstaller()
    verify_output()
