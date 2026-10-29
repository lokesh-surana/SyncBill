"""
cleanup_fake_data.py — Surgically remove test/dummy prototype data, preserving 100% of authentic Accurate ERP data.
"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "syncbill_dev.db")

def cleanup():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    print("=" * 60)
    print("CLEANING UP FAKE / PROTOTYPE DATA")
    print("=" * 60)

    # 1. Target dummy invoices
    fake_invoice_ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 311, 312, 313, 314, 315]
    placeholders = ",".join("?" for _ in fake_invoice_ids)

    # Payments
    c.execute(f"DELETE FROM payments WHERE invoice_id IN ({placeholders}) OR firm_id = 1", fake_invoice_ids)
    print(f"[-] Deleted fake payments: {c.rowcount} rows")

    # Invoice Items
    c.execute(f"DELETE FROM invoice_items WHERE invoice_id IN ({placeholders})", fake_invoice_ids)
    print(f"[-] Deleted fake invoice items: {c.rowcount} rows")

    # Invoices
    c.execute(f"DELETE FROM invoices WHERE id IN ({placeholders})", fake_invoice_ids)
    print(f"[-] Deleted fake invoices: {c.rowcount} rows")

    # Fake Items
    fake_item_ids = [1, 2, 3, 4]
    item_placeholders = ",".join("?" for _ in fake_item_ids)
    c.execute(f"DELETE FROM items WHERE id IN ({item_placeholders})", fake_item_ids)
    print(f"[-] Deleted fake items (Dell Desktop, Stapler Pins, etc.): {c.rowcount} rows")

    # Fake Customers
    fake_customer_ids = [1, 2]
    cust_placeholders = ",".join("?" for _ in fake_customer_ids)
    c.execute(f"DELETE FROM customers WHERE id IN ({cust_placeholders})", fake_customer_ids)
    print(f"[-] Deleted fake parties (Apex Electronics, etc.): {c.rowcount} rows")

    # Fake Firm
    c.execute("DELETE FROM firms WHERE id = 1 AND name = 'Demo Enterprise Pvt Ltd'")
    print(f"[-] Deleted fake firm (Demo Enterprise Pvt Ltd): {c.rowcount} rows")

    conn.commit()

    print("\n" + "=" * 60)
    print("REMAINING AUTHENTIC ACCURATE ERP DATA:")
    c.execute("SELECT id, name, gstin FROM firms")
    print("Active Firms:", c.fetchall())

    c.execute("SELECT COUNT(*) FROM items")
    print("Active Apparel Products:", c.fetchone()[0])

    c.execute("SELECT COUNT(*) FROM customers")
    print("Active Parties (Customers/Vendors):", c.fetchone()[0])

    # Check total Sales Invoices (Note: In the database, invoice_type is stored in uppercase: 'SALES')
    c.execute("SELECT COUNT(*) FROM invoices WHERE UPPER(invoice_type) = 'SALES'")
    print("Active Sales Invoices:", c.fetchone()[0])

    # Check total Purchase Bills (Stored in uppercase: 'PURCHASE')
    c.execute("SELECT COUNT(*) FROM invoices WHERE UPPER(invoice_type) = 'PURCHASE'")
    print("Active Purchase Bills:", c.fetchone()[0])

    print("=" * 60)
    conn.close()

if __name__ == "__main__":
    cleanup()
