# -*- coding: utf-8 -*-
"""
test_insert.py — Verification script: creates tables and inserts a sample Item.

Run this from the 'backend/' directory:
    python test_insert.py

What this script does, step by step:
  1. Imports our database engine and all models.
  2. Creates the actual tables in the database (if they don't exist yet).
  3. Opens a session and inserts one sample Item.
  4. Reads it back from the database and prints it.
  5. Cleans up the session.

If you see a <Item ...> line printed at the end — SUCCESS! 🎉
If you see an error — read the traceback. The most common issue is
a missing library (run: pip install -r requirements.txt).
"""

# ── Imports ────────────────────────────────────────────────────────────────────
# We import "Base" and "engine" from our database module.
# Base knows about ALL models (because models/__init__.py imported them).
from app.database import Base, engine, SessionLocal

# We import models so SQLAlchemy registers them with Base before create_all().
# Even though we don't use the names directly here, the import is necessary.
import app.models  # noqa — this triggers models/__init__.py which imports all models

# We import the specific model we want to insert.
from app.models.item import Item


def main():
    print("\n" + "=" * 60)
    print("  SyncBill - Database Verification Script")
    print("=" * 60)

    # ── Step 1: Create all tables ──────────────────────────────────────────
    # Base.metadata.create_all() looks at every class that inherits from Base
    # (Firm, Customer, Item) and creates the corresponding table in the DB.
    # If the table already exists, it does NOTHING (safe to run multiple times).
    print("\n[1/4] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("      [OK] Tables created (or already existed).")

    # ── Step 2: Open a session ─────────────────────────────────────────────
    # A session is like opening a "transaction". All changes are temporary
    # until we call session.commit(). If something goes wrong, we call
    # session.rollback() to undo everything — no partial data left in the DB.
    print("\n[2/4] Opening database session...")
    session = SessionLocal()
    print("      [OK] Session opened.")

    try:
        # ── Step 3: Check if the item already exists (idempotent) ─────────────
        # "Idempotent" = safe to run multiple times without creating duplicates.
        # We check if item_code "STAT-SP-10MM" is already in the DB.
        from sqlalchemy import select
        print("\n[3/4] Checking for existing item or creating new one...")

        existing = session.execute(
            select(Item).where(Item.item_code == "STAT-SP-10MM")
        ).scalar_one_or_none()  # Returns the Item if found, None if not found

        if existing:
            # The item already exists from a previous test run. Reuse it.
            print("      [INFO] Item already exists in DB. Reusing existing record.")
            sample_item = existing
        else:
            # First run: create and insert the item.
            sample_item = Item(
                name                  = "Stapler Pins 10mm",
                item_code             = "STAT-SP-10MM",
                description           = "Standard 10mm stapler pins, 1000 pieces per box",
                hsn_code              = "83053000",
                gst_rate              = 18.00,
                primary_uom           = "Pcs",
                secondary_uom         = "Box",
                uom_conversion_factor = 1000,
                purchase_rate         = 120.00,
                wholesale_rate        = 0.25,
                retail_rate           = 0.50,
                mrp                   = 0.60,
                current_stock         = 5000.000,
                reorder_level         = 1000.000,
                is_service            = False,
                is_active             = True,
            )
            print("      [OK] Item object created in memory.")
            session.add(sample_item)       # Stage it (no SQL yet)
            session.commit()               # Fire the INSERT SQL
            session.refresh(sample_item)   # Reload from DB to get auto-assigned id
            print(f"      [SAVED] Item inserted with ID: {sample_item.id}")

        print(f"\n      [OK] Working with Item ID: {sample_item.id}")

        # ── Step 4: Read it back from the database ────────────────────────────
        print("\n[4/4] Reading Item back from database to verify...")

        # session.get() fetches a row by its primary key.
        # Under the hood: SELECT * FROM items WHERE id = ?
        fetched_item = session.get(Item, sample_item.id)

        print("\n" + "-" * 60)
        print("  Database Record:")
        print(f"    ID            : {fetched_item.id}")
        print(f"    Name          : {fetched_item.name}")
        print(f"    Item Code     : {fetched_item.item_code}")
        print(f"    HSN Code      : {fetched_item.hsn_code}")
        print(f"    GST Rate      : {fetched_item.gst_rate}%")
        print(f"    UOM           : {fetched_item.primary_uom} (1 {fetched_item.secondary_uom} = {int(fetched_item.uom_conversion_factor)} {fetched_item.primary_uom})")
        print(f"    Purchase Rate : Rs.{fetched_item.purchase_rate}")
        print(f"    Wholesale     : Rs.{fetched_item.wholesale_rate}")
        print(f"    Retail Rate   : Rs.{fetched_item.retail_rate}")
        print(f"    MRP           : Rs.{fetched_item.mrp}")
        print(f"    Stock         : {fetched_item.current_stock} {fetched_item.primary_uom}")
        print(f"    Reorder Level : {fetched_item.reorder_level} {fetched_item.primary_uom}")
        print(f"    Created At    : {fetched_item.created_at}")
        print("-" * 60)
        print(f"\n  repr() -> {fetched_item!r}")
        print("\n[PASS] TEST PASSED - Database models are working correctly!")

    except Exception as e:
        # If anything goes wrong, rollback the transaction to keep the DB clean.
        session.rollback()
        print(f"\n[FAIL] ERROR: {e}")
        print("\nTroubleshooting tips:")
        print("  1. Did you run: pip install -r requirements.txt ?")
        print("  2. Is your .env file in the backend/ folder?")
        raise  # Re-raise the error so you can see the full traceback

    finally:
        # Always close the session, even if an error occurred.
        session.close()
        print("\n[Done] Session closed.\n")


# This block runs only when you execute "python test_insert.py" directly.
# It does NOT run when this file is imported by another module.
if __name__ == "__main__":
    main()
