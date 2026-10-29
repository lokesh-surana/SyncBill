import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), "syncbill_dev.db")
    print(f"Opening database: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("PRAGMA table_info(invoices)")
    cols = [col[1] for col in c.fetchall()]

    if "original_invoice_id" not in cols:
        print("Adding column original_invoice_id to invoices...")
        c.execute("ALTER TABLE invoices ADD COLUMN original_invoice_id INTEGER NULL REFERENCES invoices(id)")

    if "original_invoice_number" not in cols:
        print("Adding column original_invoice_number to invoices...")
        c.execute("ALTER TABLE invoices ADD COLUMN original_invoice_number VARCHAR(50) NULL")

    if "return_reason" not in cols:
        print("Adding column return_reason to invoices...")
        c.execute("ALTER TABLE invoices ADD COLUMN return_reason VARCHAR(255) NULL")

    conn.commit()

    c.execute("PRAGMA table_info(invoices)")
    cols = [col[1] for col in c.fetchall()]
    print("Columns now in invoices:", [c for c in cols if 'return' in c or 'original' in c])
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
