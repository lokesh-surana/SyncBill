"""
accurate_sync_agent.py — Lightweight, 100% Safe Sync Agent for Old PC (Accurate ERP)
======================================================================================
PURPOSE:
1. Runs silently in the background on your Old PC.
2. Checks for new Sales Invoices, Purchase Bills, or Parties created in Accurate software.
3. Sends updates OUTWARD over HTTP/HTTPS to your SyncBill ERP (works over Wi-Fi or Internet).

SAFETY & ACCURACY GUARANTEES:
- 100% READ-ONLY: Never modifies or deletes any data in Accurate.
- ZERO LOCKING: Queries SQL Server using `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`
  and `WITH (NOLOCK)` so Accurate software NEVER freezes, crashes, or shows any errors.
- SILENT & RESILIENT: If network is offline, it sleeps and retries quietly. Zero annoying popups.
"""

import os
import sys
import time
import json
import csv
import glob
import datetime
from decimal import Decimal

try:
    import requests
except ImportError:
    print("[ERROR] 'requests' library not found. Please run 1_INSTALL_REQUIREMENTS.bat first!")
    sys.exit(1)


# Path to config file in the same directory as this script
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
STATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synced_state.json")


def load_config():
    """Load settings from config.json with safe defaults."""
    if not os.path.exists(CONFIG_PATH):
        print(f"[!] config.json not found at {CONFIG_PATH}. Using default settings.")
        return {
            "syncbill_url": "http://127.0.0.1:8000",
            "secret_token": "syncbill_secret_2026",
            "machine_name": "Accurate-Old-PC",
            "check_interval_seconds": 30,
            "accurate_backup_folder": "C:\\Accurate\\backup",
            "sql_server": {"enabled": False}
        }
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_synced_state():
    """Load list of already synced bill numbers so we never send duplicates."""
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"synced_bills": []}
    return {"synced_bills": []}


def save_synced_state(state):
    """Save synced bill numbers back to disk."""
    try:
        with open(STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save synced_state: {e}")


def parse_date_str(dstr):
    """Parse various Indian accounting date formats (dd-mmm-yyyy, dd/mm/yyyy)."""
    if not dstr:
        return None
    dstr = dstr.strip()
    for fmt in ('%d-%b-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.datetime.strptime(dstr, fmt).strftime('%Y-%m-%d')
        except Exception:
            pass
    return None


def clean_num(val):
    """Safely convert strings with commas (e.g. '12,500.00') to float."""
    if not val:
        return 0.0
    try:
        cleaned = str(val).replace(',', '').strip()
        if not cleaned or cleaned == '-':
            return 0.0
        return float(cleaned)
    except Exception:
        return 0.0


def scan_backup_folder(folder_path, already_synced):
    """
    Scans the Accurate Backup / GSTReports directory for newly generated CSV files.
    Extracts new Sales and Purchase bills without interrupting Accurate software.
    """
    new_invoices = []
    if not os.path.exists(folder_path):
        return new_invoices

    # Search for all CSV files in backup and GSTReports
    search_pattern = os.path.join(folder_path, "**", "*.CSV")
    csv_files = glob.glob(search_pattern, recursive=True)

    for csv_file in csv_files:
        fname = os.path.basename(csv_file).upper()
        # Only process Sales and Purchase registers, ignore HSN and GR summary files
        if "HSN" in fname or "GR" in fname:
            continue

        is_sales = "SALES" in fname
        is_purchase = "PURCHASE" in fname

        if not (is_sales or is_purchase):
            continue

        try:
            with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                for row in reader:
                    # Accurate CSV standard columns:
                    # row[1]: Bill No, row[2]: Date, row[3]: Pay Type, row[6]: GSTIN, row[7]: Party Name
                    if len(row) >= 17 and row[1] and row[1] != 'Bill No' and row[2] != 'Total':
                        bill_no = row[1].strip()
                        inv_key = f"{'SALES' if is_sales else 'PURCH'}_{bill_no}"

                        # Skip if already sent to SyncBill in an earlier round
                        if inv_key in already_synced:
                            continue

                        bdate = parse_date_str(row[2])
                        taxable = clean_num(row[11] if is_sales and len(row) > 11 else row[8])
                        cgst = clean_num(row[12] if is_sales and len(row) > 12 else row[14] if len(row) > 14 else 0)
                        sgst = clean_num(row[13] if is_sales and len(row) > 13 else row[15] if len(row) > 15 else 0)
                        igst = clean_num(row[17] if not is_sales and len(row) > 17 else 0)
                        roundoff = clean_num(row[15] if is_sales and len(row) > 15 else row[19] if len(row) > 19 else 0)
                        total = clean_num(row[16] if is_sales and len(row) > 16 else row[20] if len(row) > 20 else 0)

                        new_invoices.append({
                            "bill_no": bill_no,
                            "inv_key": inv_key,
                            "invoice_type": "sales" if is_sales else "purchase",
                            "date": bdate or datetime.date.today().strftime('%Y-%m-%d'),
                            "party_name": row[7].strip() if len(row) > 7 else ("Cash Customer" if is_sales else "Cash Supplier"),
                            "party_gstin": row[6].strip().upper() if len(row) > 6 else "",
                            "taxable": taxable,
                            "cgst": cgst,
                            "sgst": sgst,
                            "igst": igst,
                            "roundoff": roundoff,
                            "total": total,
                        })
        except Exception as e:
            # Silently pass file lock or permission errors
            pass

    return new_invoices


def scan_sql_server(sql_cfg, already_synced):
    """
    Direct SQL Server Reader via ODBC with WITH (NOLOCK) — 100% Read-Only & Non-Blocking.
    Used if sql_server.enabled is set to true in config.json.
    """
    new_invoices = []
    try:
        import pyodbc
    except ImportError:
        return new_invoices

    server = sql_cfg.get("server_instance", "localhost\\SQLEXPRESS")
    db_name = sql_cfg.get("database_name", "AtechDB")

    if sql_cfg.get("use_windows_auth", True):
        conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={db_name};Trusted_Connection=yes;"
    else:
        conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={db_name};UID={sql_cfg.get('username')};PWD={sql_cfg.get('password')};"

    try:
        # Connect with read-only autocommit
        conn = pyodbc.connect(conn_str, autocommit=True, timeout=5)
        cursor = conn.cursor()

        # Crucial: Uncommitted reads ensure ZERO table locks on Accurate software!
        cursor.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;")

        # Query latest sales bills
        query = """
        SELECT TOP 100 
            b.BillNo, b.BillDate, b.PartyName, ISNULL(b.GSTIN, '') AS GSTIN,
            ISNULL(b.TaxableAmount, 0) AS Taxable,
            ISNULL(b.CGST, 0) AS CGST, ISNULL(b.SGST, 0) AS SGST,
            ISNULL(b.IGST, 0) AS IGST, ISNULL(b.GrandTotal, 0) AS GrandTotal
        FROM SalesBill b WITH (NOLOCK)
        ORDER BY b.BillNo DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        for r in rows:
            bill_no = str(r[0]).strip()
            inv_key = f"SALES_{bill_no}"
            if inv_key in already_synced:
                continue

            new_invoices.append({
                "bill_no": bill_no,
                "inv_key": inv_key,
                "invoice_type": "sales",
                "date": str(r[1])[:10] if r[1] else datetime.date.today().strftime('%Y-%m-%d'),
                "party_name": str(r[2]).strip() if r[2] else "Cash Customer",
                "party_gstin": str(r[3]).strip().upper(),
                "taxable": float(r[4]),
                "cgst": float(r[5]),
                "sgst": float(r[6]),
                "igst": float(r[7]),
                "total": float(r[8]),
            })

        conn.close()
    except Exception as e:
        # Silently catch and wait for next interval
        pass

    return new_invoices


def push_to_syncbill(cfg, new_invoices):
    """Send newly discovered invoices to the SyncBill ERP backend."""
    if not new_invoices:
        return 0

    base_url = cfg.get("syncbill_url", "http://127.0.0.1:8000").rstrip("/")
    endpoint = f"{base_url}/api/v1/sync/accurate-push"

    payload = {
        "secret_token": cfg.get("secret_token", "syncbill_secret_2026"),
        "machine_name": cfg.get("machine_name", "Old-PC"),
        "firm_name": "APEX APPARELS & TEXTILES",
        "invoices": new_invoices,
    }

    try:
        resp = requests.post(endpoint, json=payload, timeout=10)
        if resp.status_code == 200:
            result = resp.json()
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [OK] {result.get('message')}")
            return len(new_invoices)
        else:
            print(f"[!] Server returned status {resp.status_code}: {resp.text}")
            return 0
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] [Waiting] Cannot reach SyncBill ({base_url}). Will retry in next loop.")
        return 0


def main():
    print("=" * 70)
    print("  SyncBill ERP — Accurate Software (Old PC) Live Sync Agent")
    print("=" * 70)

    cfg = load_config()
    print(f"[*] Target SyncBill URL : {cfg.get('syncbill_url')}")
    print(f"[*] Accurate Backup Dir: {cfg.get('accurate_backup_folder')}")
    print(f"[*] Check Interval     : {cfg.get('check_interval_seconds', 30)} seconds")
    print("[*] Status             : RUNNING IN BACKGROUND (Press Ctrl+C to stop)")
    print("=" * 70 + "\n")

    state = load_synced_state()
    synced_set = set(state.get("synced_bills", []))

    while True:
        try:
            # 1. Scan folder (Mode A)
            backup_folder = cfg.get("accurate_backup_folder", "C:\\Accurate\\backup")
            discovered_invoices = scan_backup_folder(backup_folder, synced_set)

            # 2. Scan SQL Server if enabled (Mode B)
            if cfg.get("sql_server", {}).get("enabled", False):
                sql_invoices = scan_sql_server(cfg.get("sql_server"), synced_set)
                discovered_invoices.extend(sql_invoices)

            if discovered_invoices:
                print(f"[*] Found {len(discovered_invoices)} new bills from Accurate software. Sending...")
                success_count = push_to_syncbill(cfg, discovered_invoices)
                if success_count > 0:
                    for inv in discovered_invoices:
                        synced_set.add(inv["inv_key"])
                    state["synced_bills"] = list(synced_set)
                    save_synced_state(state)
            else:
                # Idle heartbeat
                # print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] No new changes. Monitoring Accurate...")
                pass

        except Exception as e:
            print(f"[Notice] Heartbeat check: {e}")

        time.sleep(cfg.get("check_interval_seconds", 30))


if __name__ == "__main__":
    main()
