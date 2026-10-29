"""
import_all_database_items.py — Complete ETL Import for All Accurate Items & Categories
=====================================================================================
Extracts all real apparel and garments inventory from accurate.zip (r6.csv):
- 140+ real garment categories / sections (READYMADE GARMENTS, T-SHIRTS, JACKET, etc.)
- 5,000+ items with MRP, Sizes, UOMs, Stocks, and 5% GST
- Ensures SQLite schema has category, size, mrp, cd1, cd2 columns.
"""

import os
import zipfile
import csv
import io
import re
import sqlite3
from decimal import Decimal

from app.database import SessionLocal, engine, Base
from app.models.item import Item
from app.models.firm import Firm
from app.models.customer import Customer

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "syncbill_dev.db")
ZIP_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "accurate.zip")


def ensure_db_columns():
    """Ensure all required columns exist in SQLite without losing existing data."""
    print("[1/3] Checking and updating database table columns...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check items columns
    cur.execute("PRAGMA table_info(items)")
    item_cols = {col[1] for col in cur.fetchall()}
    if "category" not in item_cols:
        print("  + Adding column 'category' to items table")
        cur.execute("ALTER TABLE items ADD COLUMN category VARCHAR(100) DEFAULT 'READYMADE GARMENTS'")
    if "size" not in item_cols:
        print("  + Adding column 'size' to items table")
        cur.execute("ALTER TABLE items ADD COLUMN size VARCHAR(50)")
    if "item_type" not in item_cols:
        print("  + Adding column 'item_type' to items table")
        cur.execute("ALTER TABLE items ADD COLUMN item_type VARCHAR(50) DEFAULT 'Readymade'")

    # Check invoice_items columns
    cur.execute("PRAGMA table_info(invoice_items)")
    inv_cols = {col[1] for col in cur.fetchall()}
    if "size" not in inv_cols:
        print("  + Adding column 'size' to invoice_items table")
        cur.execute("ALTER TABLE invoice_items ADD COLUMN size VARCHAR(50)")
    if "mrp" not in inv_cols:
        print("  + Adding column 'mrp' to invoice_items table")
        cur.execute("ALTER TABLE invoice_items ADD COLUMN mrp NUMERIC(15, 2)")
    if "cd1_percent" not in inv_cols:
        print("  + Adding column 'cd1_percent' to invoice_items table")
        cur.execute("ALTER TABLE invoice_items ADD COLUMN cd1_percent NUMERIC(5, 2) DEFAULT 0.00")
    if "cd2_percent" not in inv_cols:
        print("  + Adding column 'cd2_percent' to invoice_items table")
        cur.execute("ALTER TABLE invoice_items ADD COLUMN cd2_percent NUMERIC(5, 2) DEFAULT 0.00")

    conn.commit()
    conn.close()
    print("  [OK] Database schema is up to date.")


def extract_size(name):
    """Extract garment size from item name."""
    if not name:
        return ""
    # Look for bracketed size e.g. (20/26), [M/XXL]
    m = re.search(r'[\(\[]([^\)\]]+)[\)\]]', name)
    if m:
        return m.group(1).strip()
    # Look for size tokens like M/XXL, S/XXL, L/2XL, S/XL, Free
    m = re.search(r'\b(M/XXL|S/XXL|L/XXL|S/XL|L/2XL|M/L|M/2XL|XS|S|M|L|XL|XXL|2XL|3XL|4XL|FREE)\b', name, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # Look for numeric range sizes e.g. 20/24, 26/30, 32-36
    m = re.search(r'(?:^|[- ])([1-4][0-9][/–-][1-4][0-9])(?:$|[- A-Za-z])', name)
    if m:
        return m.group(1).strip()
    return ""


def run_full_item_import():
    ensure_db_columns()

    print("\n[2/3] Extracting all items & sections from accurate.zip (r6.csv)...")
    if not os.path.exists(ZIP_PATH):
        print(f"[ERROR] accurate.zip not found at {ZIP_PATH}")
        return

    items_dict = {}
    current_cat = "READYMADE GARMENTS"

    with zipfile.ZipFile(ZIP_PATH, 'r') as z:
        with z.open('accurate/backup/Projects/Accurate/r6.csv') as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8', errors='ignore'))
            for row in reader:
                if not row:
                    continue
                non_empty = [c.strip() for c in row if c.strip()]
                # Check for section / category header row
                if len(non_empty) == 1 and not row[0].startswith('Stock Report') and not row[0].startswith('Total'):
                    val = non_empty[0]
                    if not any(val.startswith(x) for x in ['0.00', '5.00', '12.00', '18.00', 'Total']):
                        current_cat = val.strip().upper()
                elif len(row) >= 14:
                    name = row[0].strip()
                    if name and not name.startswith('Stock Report') and name != 'Total' and not name.startswith('0.00'):
                        try:
                            size = extract_size(name)
                            closing = float(row[8].replace(',', '')) if len(row) > 8 and row[8] else 0.0
                            uom = row[9].strip() if len(row) > 9 and row[9] else 'PCS'
                            mrp_rate = float(row[10].replace(',', '')) if len(row) > 10 and row[10] else 0.0
                            tax_rate = float(row[12].replace(',', '')) if len(row) > 12 and row[12] else 5.0

                            if name not in items_dict:
                                items_dict[name] = {
                                    'name': name,
                                    'category': current_cat,
                                    'size': size,
                                    'uom': uom,
                                    'mrp': mrp_rate,
                                    'stock': max(0.0, closing),
                                    'tax': tax_rate
                                }
                            else:
                                if mrp_rate > 0 and items_dict[name]['mrp'] == 0:
                                    items_dict[name]['mrp'] = mrp_rate
                                if current_cat != 'READYMADE GARMENTS' and items_dict[name]['category'] == 'READYMADE GARMENTS':
                                    items_dict[name]['category'] = current_cat
                                if size and not items_dict[name]['size']:
                                    items_dict[name]['size'] = size
                                items_dict[name]['stock'] += max(0.0, closing)
                        except Exception:
                            pass

    print(f"  [OK] Extracted {len(items_dict)} unique items across sections.")

    print("\n[3/3] Importing & Upserting all items into SyncBill database...")
    db = SessionLocal()
    inserted_count = 0
    updated_count = 0

    try:
        # Load all existing items from DB to memory for fast lookups
        existing_items = {item.name.strip().upper(): item for item in db.query(Item).all()}

        for name, data in items_dict.items():
            key = name.strip().upper()
            mrp_val = Decimal(str(data['mrp'])) if data['mrp'] > 0 else Decimal("100.00")
            retail_val = mrp_val
            wholesale_val = mrp_val
            purchase_val = Decimal(str(round(float(mrp_val) * 0.7, 2)))
            stock_val = Decimal(str(data['stock']))
            tax_val = Decimal(str(data['tax'])) if data['tax'] > 0 else Decimal("5.00")

            if key in existing_items:
                item = existing_items[key]
                item.category = data['category']
                item.size = data['size']
                if float(item.mrp or 0) <= 0 or data['mrp'] > 0:
                    item.mrp = mrp_val
                    item.retail_rate = retail_val
                    item.wholesale_rate = wholesale_val
                    item.purchase_rate = purchase_val
                if item.primary_uom != data['uom'] and data['uom']:
                    item.primary_uom = data['uom']
                item.current_stock = stock_val
                item.is_active = True
                updated_count += 1
            else:
                new_item = Item(
                    name=data['name'],
                    category=data['category'],
                    size=data['size'],
                    hsn_code="6109",
                    primary_uom=data['uom'] or "PCS",
                    purchase_rate=purchase_val,
                    wholesale_rate=wholesale_val,
                    retail_rate=retail_val,
                    mrp=mrp_val,
                    gst_rate=tax_val,
                    current_stock=stock_val,
                    is_active=True,
                )
                db.add(new_item)
                existing_items[key] = new_item
                inserted_count += 1

            if (inserted_count + updated_count) % 500 == 0:
                db.commit()

        db.commit()
        print(f"  [SUCCESS] Successfully imported {inserted_count} new items and updated {updated_count} existing items!")
        print(f"  Total items in database: {db.query(Item).count()}")
        print(f"  Total distinct categories: {db.query(Item.category).distinct().count()}")

        # Print top 10 categories
        print("\nSample Categories in Database:")
        rows = db.query(Item.category, sqlite3.sql.functions if hasattr(sqlite3, 'sql') else Item.id).limit(1).all()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT category, count(*) FROM items GROUP BY category ORDER BY count(*) DESC LIMIT 10")
        for cat, cnt in c.fetchall():
            print(f"  - {cat}: {cnt} items")
        conn.close()

    finally:
        db.close()


if __name__ == "__main__":
    run_full_item_import()
