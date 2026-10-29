@echo off
title SyncBill - Live Sync Status Monitor
color 0B
echo ======================================================================
echo             SyncBill ERP - Live Sync Verification Monitor
echo ======================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$backendRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -InformationLevel Quiet;" ^
    "if (-not $backendRunning) {" ^
    "    Write-Host '[ERROR] SyncBill Backend is NOT running on Port 8000.' -ForegroundColor Red;" ^
    "    Write-Host 'Please run START_SYNCBILL.bat first.' -ForegroundColor Yellow;" ^
    "    exit 1;" ^
    "}" ^
    "try {" ^
    "    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/sync/status' -TimeoutSec 5;" ^
    "    Write-Host '[OK] Sync Engine:' $res.sync_engine -ForegroundColor Green;" ^
    "    Write-Host '     Sales Invoices in DB :' $res.database_totals.sales_invoices -ForegroundColor Cyan;" ^
    "    Write-Host '     Purchase Bills in DB :' $res.database_totals.purchase_bills -ForegroundColor Cyan;" ^
    "    Write-Host '     Parties in DB        :' $res.database_totals.parties -ForegroundColor Cyan;" ^
    "    Write-Host '     Items in DB          :' $res.database_totals.items -ForegroundColor Cyan;" ^
    "    Write-Host '';" ^
    "    if ($res.last_sync.status -eq 'idle' -or -not $res.last_sync.last_sync_time) {" ^
    "        Write-Host '[WAITING] No sync transmissions received from Old PC yet.' -ForegroundColor Yellow;" ^
    "        Write-Host '          Status is IDLE. Old PC has not pushed new bills since server started.' -ForegroundColor DarkYellow;" ^
    "    } else {" ^
    "        Write-Host '[SUCCESS] Last Sync from Old PC:' $res.last_sync.last_sync_time -ForegroundColor Green;" ^
    "        Write-Host '          Machine Name     :' $res.last_sync.last_machine -ForegroundColor Green;" ^
    "        Write-Host '          Invoices Added   :' $res.last_sync.invoices_added -ForegroundColor Green;" ^
    "    }" ^
    "} catch {" ^
    "    Write-Host '[ERROR] Could not query sync status API:' $_.Exception.Message -ForegroundColor Red;" ^
    "}"

echo.
echo ======================================================================
echo This PC's Wi-Fi IP for the Old PC config is: 192.168.1.5
echo ======================================================================
echo.
pause
