@echo off
title SyncBill - Accurate Live Sync Watcher
color 0E
echo ======================================================================
echo   SyncBill ERP - Accurate Software Live Sync Watcher
echo ======================================================================
echo.
echo Starting sync loop...
echo This window will monitor Accurate software and sync new bills automatically.
echo You can minimize this window to keep it running in the background.
echo.
python accurate_sync_agent.py
pause
