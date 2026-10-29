import sqlite3

def migrate():
    conn = sqlite3.connect('syncbill_dev.db')
    c = conn.cursor()

    c.execute('PRAGMA table_info(items)')
    cols = [col[1] for col in c.fetchall()]

    if 'item_type' not in cols:
        print('Adding column item_type to items table...')
        c.execute("ALTER TABLE items ADD COLUMN item_type VARCHAR(50) DEFAULT 'Readymade'")

    # Set default item_type
    c.execute("UPDATE items SET item_type = 'Readymade' WHERE item_type IS NULL OR item_type = ''")

    # Set item_code = name where missing
    c.execute("UPDATE items SET item_code = name WHERE (item_code IS NULL OR item_code = '') AND name IS NOT NULL")

    conn.commit()

    c.execute('SELECT COUNT(*), COUNT(item_code), COUNT(item_type) FROM items')
    total, with_code, with_type = c.fetchone()
    print(f'Done! Total: {total}, With item_code: {with_code}, With item_type: {with_type}')

    c.execute('SELECT id, item_code, name, description, item_type, category, size, mrp FROM items LIMIT 5')
    print('Sample rows:')
    for r in c.fetchall():
        print(r)

    conn.close()

if __name__ == '__main__':
    migrate()
