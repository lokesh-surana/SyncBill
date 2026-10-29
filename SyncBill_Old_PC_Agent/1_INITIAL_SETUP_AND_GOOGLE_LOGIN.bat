@echo off
title SyncBill ERP - Initial Setup & Google Drive Login
echo ======================================================================
echo    SyncBill ERP - Initial Setup & Google Drive Authorization
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/2] Installing required Python libraries...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib pyodbc requests
if %errorlevel% neq 0 (
    echo [!] Pip install failed. Please ensure Python is installed with pip added to PATH.
    pause
    exit /b 1
)

echo.
echo [2/2] Running Setup and Google Sign-in...
python setup_and_login.py

echo.
pause

