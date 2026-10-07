import aiosqlite
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "business.db"

_db = None


async def get_db():
    global _db
    if _db is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _db = await aiosqlite.connect(str(DB_PATH))
        _db.row_factory = aiosqlite.Row
    return _db


async def _column_names(db, table: str):
    cursor = await db.execute(f"PRAGMA table_info({table})")
    rows = await cursor.fetchall()
    return {row[1] for row in rows}


async def _ensure_column(db, table: str, column: str, ddl: str):
    cols = await _column_names(db, table)
    if column not in cols:
        await db.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


async def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))

    await db.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            card_code TEXT NOT NULL,
            qty INTEGER NOT NULL,
            condition TEXT NOT NULL,
            cost_basis_sek REAL NOT NULL,
            purchased_at TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('owned', 'listed', 'sold', 'reserved')),
            source TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor TEXT NOT NULL,
            source TEXT NOT NULL,
            source_url TEXT,
            total_cost_sek REAL NOT NULL,
            shipping_sek REAL NOT NULL DEFAULT 0,
            fees_sek REAL NOT NULL DEFAULT 0,
            purchased_at TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            card_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            card_code TEXT NOT NULL,
            qty INTEGER NOT NULL,
            condition TEXT NOT NULL,
            price_per_card_sek REAL NOT NULL,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            image_url TEXT,
            detected_card_id TEXT,
            detected_card_name TEXT,
            detected_card_code TEXT,
            confidence REAL,
            language_filter_pass BOOLEAN NOT NULL DEFAULT 1,
            buy_price_sek REAL NOT NULL,
            shipping_estimate_sek REAL NOT NULL,
            cardmarket_en_low_sek REAL,
            cardmarket_en_avg_sek REAL,
            expected_profit_sek REAL,
            scanned_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    await db.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventory_id INTEGER NOT NULL,
            sale_price_sek REAL NOT NULL,
            platform TEXT NOT NULL,
            platform_fees_sek REAL NOT NULL DEFAULT 0,
            shipping_sek REAL NOT NULL DEFAULT 0,
            sold_at TEXT NOT NULL,
            buyer_notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (inventory_id) REFERENCES inventory(id)
        )
    """)

    await _ensure_column(db, "inventory", "purchase_id", "purchase_id INTEGER")
    await _ensure_column(db, "inventory", "notes", "notes TEXT")

    await db.commit()
    await db.close()

    global _db
    _db = await aiosqlite.connect(str(DB_PATH))
    _db.row_factory = aiosqlite.Row
