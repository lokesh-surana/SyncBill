@echo off
setlocal enabledelayedexpansion
title Installing SyncBill Silent Background Service

echo ======================================================================
echo    SyncBill ERP - Silent Background Sync Service Installer
echo    (No Black Windows, Starts Automatically with Windows)
echo ======================================================================
echo.

:: Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Please right-click this file and select 'Run as administrator'!
    echo.
    pause
    exit /b 1
)

:: Get current folder and locate pythonw.exe
set "AGENT_DIR=%~dp0"
set "AGENT_DIR=%AGENT_DIR:~0,-1%"

:: Look for pythonw.exe
set "PYTHONW_EXE="
if exist "%AGENT_DIR%\venv\Scripts\pythonw.exe" (
    set "PYTHONW_EXE=%AGENT_DIR%\venv\Scripts\pythonw.exe"
) else (
    for %%P in (pythonw.exe) do set "PYTHONW_EXE=%%~$PATH:P"
)

if "%PYTHONW_EXE%"=="" (
    for %%P in (python.exe) do set "PYTHONW_EXE=%%~$PATH:P"
    if not "%PYTHONW_EXE%"=="" (
        set "PYTHONW_EXE=%PYTHONW_EXE:python.exe=pythonw.exe%"
    )
)

if not exist "%PYTHONW_EXE%" (
    echo [!] WARNING: pythonw.exe not found automatically. Using default pythonw.
    set "PYTHONW_EXE=pythonw.exe"
)

echo [OK] Using Python Engine: %PYTHONW_EXE%
echo [OK] Agent Working Directory: %AGENT_DIR%
echo.

:: Name of the Scheduled Task
set "TASK_NAME=SyncBillAccurateCloudSync"

:: Remove old task if exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: Create silent scheduled task at logon with restart policy
echo Registering silent background task with Windows Task Scheduler...
schtasks /create /tn "%TASK_NAME%" /tr "\"%PYTHONW_EXE%\" \"%AGENT_DIR%\silent_background_agent.py\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  [SUCCESS] SyncBill Silent Background Service Installed Successfully!
    echo ======================================================================
    echo  - Starts automatically every time Windows boots/logs in.
    echo  - Runs 100%% invisibly with ZERO black command windows.
    echo  - Logs all activity silently to:
    echo    %AGENT_DIR%\sync_activity.log
    echo ======================================================================
    echo.
    echo Starting service now...
    schtasks /run /tn "%TASK_NAME%" >nul 2>&1
    echo [OK] Service is now running in the background!
) else (
    echo [!] Failed to create scheduled task. Please verify administrator rights.
)

echo.
pause

