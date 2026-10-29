"""
setup_and_login.py — One-Time Setup and Google Drive Authorization
===================================================================
"""

import os
import sys
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")


def check_sql_server():
    print("[1/3] Checking SQL Server connection (AtechDB)...")
    try:
        import pyodbc
        conn_str = "DRIVER={SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=AtechDB;Trusted_Connection=yes;"
        c = pyodbc.connect(conn_str, timeout=5)
        cursor = c.cursor()
        cursor.execute("SELECT COUNT(*) FROM CustomerMaster")
        count = cursor.fetchone()[0]
        c.close()
        print(f"  [OK] Successfully connected to Accurate AtechDB! Found {count} parties in database.")
        return True
    except Exception as e:
        print(f"  [!] Note on SQL Server: {e}")
        print("  Ensure SQL Server (SQLEXPRESS) service is running.")
        return False


def authorize_google():
    print("\n[2/3] Authorizing Google Drive API...")
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"  [!] Missing {CREDENTIALS_FILE}!")
        print("  Please download your 'credentials.json' (OAuth Client ID) from Google Cloud Console")
        print("  and place it in this folder:")
        print(f"  {BASE_DIR}")
        return False

    try:
        from gdrive_uploader import GoogleDriveRelay
        print("  Opening browser for 1-time Google sign-in...")
        relay = GoogleDriveRelay()
        if relay.service:
            print("  [OK] Google Drive connected successfully!")
            root_id = relay.get_or_create_folder("SyncBill_Shop_Official")
            print(f"  [OK] Google Drive Folder initialized: 'SyncBill_Shop_Official' (ID: {root_id})")
            return True
        else:
            print("  [!] Failed to authorize Google Drive.")
            return False
    except Exception as e:
        print(f"  [!] Error during Google authorization: {e}")
        return False


def main():
    print("======================================================================")
    print("      SyncBill ERP - Old PC Initial Setup & Cloud Link Wizard")
    print("======================================================================\n")

    sql_ok = check_sql_server()
    gdrive_ok = authorize_google()

    print("\n[3/3] Setup Summary:")
    print(f"  SQL Server (Accurate DB): {'[READY]' if sql_ok else '[WARNING: Check Service]'}")
    print(f"  Google Drive Cloud Link : {'[READY]' if gdrive_ok else '[PENDING: credentials.json required]'}")

    if gdrive_ok:
        print("\n======================================================================")
        print(" [SUCCESS] Initial setup is complete!")
        print(" Next step: Right-click 'INSTALL_SILENT_SERVICE.bat' and select")
        print("            'Run as administrator' to activate silent background sync.")
        print("======================================================================")
    else:
        print("\n======================================================================")
        print(" Please provide credentials.json from Google Cloud Console and re-run.")
        print("======================================================================")


if __name__ == "__main__":
    main()

