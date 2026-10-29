@echo off
title SyncBill - Install Old PC Agent Dependencies
color 0B
echo ======================================================================
echo   SyncBill ERP - Installing Old PC Python Requirements
echo ======================================================================
echo.
echo Installing 'requests' and 'pyodbc' via pip...
pip install requests pyodbc
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Dependencies installed successfully!
) else (
    echo [NOTE] If pip failed, ensure Python is installed and added to PATH on this PC.
)
echo.
pause
