@echo off
title SyncBill - Test Connection
color 0A
echo ======================================================================
echo   SyncBill ERP - Testing Connection from Old PC to SyncBill
echo ======================================================================
echo.
python -c "import json, requests; cfg=json.load(open('config.json')); url=cfg.get('syncbill_url').rstrip('/') + '/api/v1/sync/status'; print('Testing URL:', url); r=requests.get(url, timeout=5); print('Server Response Code:', r.status_code); print('Status Details:', r.json()); print('\n[PASS] Connection to SyncBill was SUCCESSFUL!')"
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Could not connect to SyncBill.
    echo Please make sure:
    echo 1. Your SyncBill backend is running.
    echo 2. The 'syncbill_url' inside config.json matches your SyncBill IP address or Tunnel URL.
)
echo.
pause
