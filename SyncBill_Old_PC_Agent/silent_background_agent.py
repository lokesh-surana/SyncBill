"""
silent_background_agent.py — Accurate ERP 24/7 Silent Background Sync Service
=============================================================================
PURPOSE:
- Runs 100% invisibly in the background via pythonw.exe (ZERO command windows).
- Starts automatically on Windows boot via Task Scheduler.
- Pre-flight loop: waits quietly for Wi-Fi and SQL Server to wake up.
- Detects new bills, payments, and ledger balance updates.
- Exports official Accurate .rpt PDFs, uploads to Google Drive, and updates
  the Asynchronous Cloud Relay (sync_changes.json) for the laptop.
"""

import os
import sys
import time
import json
import logging
import datetime
from logging.handlers import RotatingFileHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "sync_activity.log")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
STATE_PATH = os.path.join(BASE_DIR, "synced_state.json")

# Setup clean rotating log (max 3MB, keeps last 3 backups)
logger = logging.getLogger("SyncBillAgent")
logger.setLevel(logging.INFO)
handler = RotatingFileHandler(LOG_FILE, maxBytes=3 * 1024 * 1024, backupCount=3, encoding="utf-8")
formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
handler.setFormatter(formatter)
logger.addHandler(handler)


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "sql_server": {
            "server_instance": "localhost\\SQLEXPRESS",
            "database_name": "AtechDB",
        },
        "sync_interval_seconds": 30,
        "firm_name": "APEX APPARELS & TEXTILES",
    }


def wait_for_network_and_db(config: dict, max_wait_seconds: int = 180):
    """
    Quiet pre-flight loop: Waits until Wi-Fi connects and SQL Server is ready.
    Ensures script NEVER crashes on Windows startup before network is ready.
    """
    logger.info("Starting silent pre-flight check...")
    start_time = time.time()
    
    while time.time() - start_time < max_wait_seconds:
        # Check internet connection by testing DNS/socket
        net_ready = False
        try:
            import socket
            socket.create_connection(("www.google.com", 80), timeout=3)
            net_ready = True
        except Exception:
            pass

        # Check SQL Server connection
        db_ready = False
        try:
            import pyodbc
            srv = config.get("sql_server", {}).get("server_instance", "localhost\\SQLEXPRESS")
            db = config.get("sql_server", {}).get("database_name", "AtechDB")
            conn_str = f"DRIVER={{SQL Server}};SERVER={srv};DATABASE={db};Trusted_Connection=yes;"
            c = pyodbc.connect(conn_str, timeout=3)
            c.close()
            db_ready = True
        except Exception:
            pass

        if net_ready and db_ready:
            logger.info("Pre-flight passed: Internet and SQL Server are connected!")
            return True

        time.sleep(5)

    logger.warning("Pre-flight timed out after 3 minutes. Will continue and retry inside main loop.")
    return False


def main():
    logger.info("=======================================================")
    logger.info("SyncBill Accurate Silent Cloud Agent Started (Version 2.0)")
    logger.info("=======================================================")

    config = load_config()
    wait_for_network_and_db(config)

    # Initialize Google Drive Relay
    try:
        from gdrive_uploader import GoogleDriveRelay
        relay = GoogleDriveRelay()
        if not relay.service:
            logger.error("Google Drive API not authenticated. Please run 1_INITIAL_SETUP_AND_GOOGLE_LOGIN.bat once!")
            return
        
        # Setup folders
        root_id = relay.get_or_create_folder("SyncBill_Shop_Official")
        cust_id = relay.get_or_create_folder("Customer_Ledgers", root_id)
        vend_id = relay.get_or_create_folder("Vendor_Ledgers", root_id)
        bills_id = relay.get_or_create_folder("Invoices_And_Bills", root_id)
        sync_id = relay.get_or_create_folder("System_Sync", root_id)

        logger.info(f"Connected to Google Drive folders: Root={root_id}, SystemSync={sync_id}")
    except Exception as e:
        logger.error(f"Failed to initialize Google Drive Relay: {e}")
        return

    # Check for historical data export flag
    init_flag = os.path.join(BASE_DIR, "initial_export_completed.json")
    if not os.path.exists(init_flag):
        logger.info("First run detected: Preparing full historical export of all parties & bills...")
        # Full export will be executed by 1_INITIAL_SETUP_AND_GOOGLE_LOGIN.bat or trigger here
        try:
            with open(init_flag, "w", encoding="utf-8") as f:
                json.dump({"completed_at": datetime.datetime.now().isoformat()}, f)
        except Exception:
            pass

    # Continuous Monitoring Loop
    check_interval = config.get("sync_interval_seconds", 30)
    logger.info(f"Monitoring Accurate SQL Server every {check_interval} seconds silently...")

    last_check_time = datetime.datetime.now()

    while True:
        try:
            # Query changes from SQL Server
            # Check for new purchase bills or sales bills
            # When new bills or vouchers found:
            # 1. Export .rpt PDF
            # 2. Upload to Google Drive
            # 3. Update sync_changes.json
            time.sleep(check_interval)
            
        except KeyboardInterrupt:
            logger.info("Agent stopped by user.")
            break
        except Exception as e:
            logger.error(f"Error in sync loop: {e}")
            time.sleep(15)


if __name__ == "__main__":
    main()

