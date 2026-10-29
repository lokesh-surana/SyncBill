@echo off
title SyncBill Launcher
echo ========================================================
echo           Starting SyncBill Local Server
echo ========================================================
echo.

cd /d "%~dp0"

echo Closing any previous server instances on ports 8000, 5173, 3001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000, 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [1/3] Starting FastAPI Backend Server (Port 8000)...
start "SyncBill Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/3] Starting React Frontend Server (Port 5173)...
start "SyncBill Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0 --port 5173"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Free WhatsApp Web Bridge (Port 3001)...
start "SyncBill WhatsApp Bridge" cmd /k "cd /d "%~dp0whatsapp_bridge" && node server.js"

timeout /t 2 /nobreak >nul

echo.
echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo All servers are running! 
echo - Frontend POS & ERP : http://localhost:5173
echo - Backend API Docs   : http://localhost:8000/docs
echo - WhatsApp Bridge    : http://localhost:3001/qr-view
echo ========================================================
