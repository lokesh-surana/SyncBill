@echo off
title SyncBill WhatsApp Bridge (Zero Cost)
color 0A
echo ========================================================
echo        SyncBill Free WhatsApp Web Bridge
echo        Zero Meta API Charges - 100%% Free
echo ========================================================
echo.

cd /d "%~dp0whatsapp_bridge"

if not exist "node_modules" (
    echo [SETUP] Installing required bridge packages...
    npm install
)

echo Starting WhatsApp Web Bridge on Port 3001...
echo A browser QR code will be displayed at http://localhost:3001/qr-view
echo.

node server.js

pause
