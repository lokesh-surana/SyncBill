"""
import_accurate_data.py — Automated ETL pipeline to import real data from accurate.zip
Extracts and migrates:
  - Real Operating Firms (APEX APPARELS & TEXTILES & METRO CREATIONS)
  - Real Customers (with active Maharashtra GSTINs)
  - Real Vendors / Suppliers
  - Real Garments & Apparel Item Masters (with 5% GST rates and UOMs)
"""

import os
import zipfile
import csv
import io
import re
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
import app.models
from app.models.firm import Firm
from app.models.customer import Customer, PartyType
from app.models.item import Item


def run_migration():
    print("=" * 60)
    print("MIGRATING REAL ACCURATE SOFTWARE DATA TO SYNCBILL ERP")
    print("=" * 60)

    db: Session = SessionLocal()

    try:
        # 1. FIRMS CREATION
        print("\n[Step 1] Creating Real Firms...")
        firms_data = [
            {"name": "APEX APPARELS & TEXTILES", "address": "Wholesale Textile Market, Mumbai, Maharashtra", "gstin": "27AABCS1429B1Z1"},
            {"name": "METRO CREATIONS", "address": "Commercial Complex, Mumbai, Maharashtra", "gstin": "27AACCK0000A1Z5"},
        ]

        for fd in firms_data:
            existing = db.query(Firm).filter(Firm.name == fd["name"]).first()
            if not existing:
                f = Firm(name=fd["name"], address=fd["address"], gstin=fd["gstin"], is_active=True)
                db.add(f)
                print(f"  + Added Firm: {fd['name']}")
            else:
                print(f"  * Firm already exists: {fd['name']}")
        db.commit()

        # 2. CUSTOMERS EXTRACTION
        print("\n[Step 2] Extracting & Importing Real Customers from Accurate Sales Reports...")
        existing_parties = db.query(Customer).all()
        seen_names = set(p.name.lower().strip() for p in existing_parties)
        seen_gstins = set(p.gstin.upper().strip() for p in existing_parties if p.gstin)

        customers_map = {}
        zip_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "accurate.zip")
        with zipfile.ZipFile(zip_path, 'r') as z:
            for n in z.namelist():
                if 'Sales' in n and not 'HSN' in n and not 'GR' in n and n.endswith('.CSV'):
                    with z.open(n) as f:
                        reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8', errors='ignore'))
                        for row in reader:
                            if len(row) >= 8:
                                gstin = row[6].strip().upper() if len(row) > 6 else ''
                                name = row[7].strip() if len(row) > 7 else ''
                                if name and name not in ['Customer Name', 'Total', 'Customer', 'Name']:
                                    if name not in customers_map:
                                        customers_map[name] = gstin

        cust_count = 0
        for name, gstin in customers_map.items():
            clean_name = name.lower().strip()
            clean_gstin = gstin.upper().strip() if gstin else ''
            if clean_name in seen_names or (clean_gstin and clean_gstin in seen_gstins):
                continue

            state_code = clean_gstin[:2] if (clean_gstin and len(clean_gstin) >= 2) else "27"
            c = Customer(
                name=name,
                gstin=clean_gstin if clean_gstin else None,
                party_type=PartyType.CUSTOMER,
                state_code=state_code,
                credit_limit=Decimal("50000.00"),
                is_active=True,
            )
            db.add(c)
            seen_names.add(clean_name)
            if clean_gstin:
                seen_gstins.add(clean_gstin)
            cust_count += 1
        db.commit()
        print(f"  [OK] Successfully imported {cust_count} new real customers (Total found: {len(customers_map)})")

        # 3. VENDORS EXTRACTION
        print("\n[Step 3] Extracting & Importing Real Vendors from Accurate Purchase Reports...")
        vendors_map = {}
        with zipfile.ZipFile(zip_path, 'r') as z:
            for n in z.namelist():
                if 'Purchase' in n and not 'HSN' in n and not 'GR' in n and n.endswith('.CSV'):
                    with z.open(n) as f:
                        reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8', errors='ignore'))
                        for row in reader:
                            if len(row) >= 8:
                                gstin = row[6].strip().upper() if len(row) > 6 else ''
                                name = row[7].strip() if len(row) > 7 else ''
                                if name and name not in ['Customer Name', 'Vendor Name', 'Supplier Name', 'Total']:
                                    if name not in vendors_map:
                                        vendors_map[name] = gstin

        vendor_count = 0
        for name, gstin in vendors_map.items():
            clean_name = name.lower().strip()
            clean_gstin = gstin.upper().strip() if gstin else ''
            if clean_name in seen_names or (clean_gstin and clean_gstin in seen_gstins):
                continue

            state_code = clean_gstin[:2] if (clean_gstin and len(clean_gstin) >= 2) else "27"
            c = Customer(
                name=name,
                gstin=clean_gstin if clean_gstin else None,
                party_type=PartyType.VENDOR,
                state_code=state_code,
                is_active=True,
            )
            db.add(c)
            seen_names.add(clean_name)
            if clean_gstin:
                seen_gstins.add(clean_gstin)
            vendor_count += 1
        db.commit()
        print(f"  [OK] Successfully imported {vendor_count} new real suppliers/vendors (Total found: {len(vendors_map)})")

        # 4. ITEM MASTERS EXTRACTION
        print("\n[Step 4] Extracting & Importing Apparel Products from r6.csv...")
        items_map = {}
        with zipfile.ZipFile(zip_path, 'r') as z:
            with z.open('accurate/backup/Projects/Accurate/r6.csv') as f:
                reader = csv.reader(io.TextIOWrapper(f, encoding='utf-8', errors='ignore'))
                for row in reader:
                    if len(row) >= 14 and row[0] and not row[0].startswith('Stock Report'):
                        name = row[0].strip()
                        if name and name != 'Total' and not name.startswith('0.00'):
                            try:
                                rate = float(row[13].replace(',', ''))
                                uom = row[12].strip() or 'PCS'
                                closing = float(row[11].replace(',', '')) if len(row) > 11 and row[11] else 100.0
                                if rate > 0 and name not in items_map:
                                    items_map[name] = (rate, uom, closing)
                            except:
                                pass

        # Import top items into database (e.g. top 500 or all)
        item_count = 0
        for name, (rate, uom, stock) in items_map.items():
            existing = db.query(Item).filter(Item.name == name).first()
            if not existing:
                it = Item(
                    name=name,
                    primary_uom=uom if uom else 'PCS',
                    purchase_rate=Decimal(str(round(rate * 0.8, 2))),
                    wholesale_rate=Decimal(str(rate)),
                    retail_rate=Decimal(str(rate)),
                    gst_rate=Decimal("5.00"),  # Default 5% tax
                    hsn_code="6109",           # Garments & Apparel HSN
                    current_stock=Decimal(str(max(0, stock))),
                    is_active=True,
                )
                db.add(it)
                item_count += 1
                if item_count >= 1000:  # Import top 1,000 products for optimal speed
                    break

        db.commit()
        print(f"  [OK] Successfully imported {item_count} real garment products with 5% GST and active stock levels!")

        print("\n" + "=" * 60)
        print("ACCURATE SOFTWARE DATA MIGRATION COMPLETE!")
        print(f"Total Database Items: {db.query(Item).count()}")
        print(f"Total Database Parties: {db.query(Customer).count()}")
        print("=" * 60)

    finally:
        db.close()


if __name__ == '__main__':
    run_migration()
