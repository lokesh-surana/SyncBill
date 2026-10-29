@echo off
title Uninstalling SyncBill Background Service
echo ======================================================================
echo    Uninstalling SyncBill Silent Background Service
echo ======================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Please right-click and select 'Run as administrator'!
    echo.
    pause
    exit /b 1
)

set "TASK_NAME=SyncBillAccurateCloudSync"

echo Stopping task if running...
schtasks /end /tn "%TASK_NAME%" >nul 2>&1

echo Deleting task from Windows Task Scheduler...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

echo [OK] SyncBill Background Service has been uninstalled.
echo.
pause

