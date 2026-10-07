from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.database import init_db, get_db
from services.matcher import CardMatcher
from services.settings import load_settings, save_settings, settings_public
from services.ollama import OllamaClient, OllamaUnreachable
from scrapers.cardmarket import CardmarketScraper
from scrapers.tradera import TraderaScraper

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "cards.json"

scan_progress: Dict[str, Any] = {
    "running": False,
    "phase": "idle",
    "processed": 0,
    "total": 0,
    "message": "",
    "error": None,
    "ollamaReachable": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    global card_matcher
    card_matcher = CardMatcher(CATALOG_PATH)
    yield


app = FastAPI(title="Riftbound Business API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

card_matcher: Optional[CardMatcher] = None


class InventoryLot(BaseModel):
    id: int
    cardId: str
    cardName: str
    cardCode: str
    qty: int
    condition: str
    costBasisSek: float
    purchasedAt: str
    status: str
    source: Optional[str] = None
    notes: Optional[str] = None
    purchaseId: Optional[int] = None


class PurchaseItem(BaseModel):
    cardId: str
    cardName: str
    cardCode: str
    qty: int
    condition: str
    pricePerCardSek: float


class Purchase(BaseModel):
    id: int
    vendor: str
    source: str
    sourceUrl: Optional[str] = None
    totalCostSek: float
    shippingSek: float
    feesSek: float
    purchasedAt: str
    notes: Optional[str] = None
    items: List[PurchaseItem]


class Deal(BaseModel):
    id: int
    source: str
    url: str
    title: str
    imageUrl: Optional[str] = None
    detectedCardId: Optional[str] = None
    detectedCardName: Optional[str] = None
    detectedCardCode: Optional[str] = None
    confidence: Optional[float] = None
    languageFilterPass: bool
    buyPriceSek: float
    shippingEstimateSek: float
    cardmarketEnLowSek: Optional[float] = None
    cardmarketEnAvgSek: Optional[float] = None
    expectedProfitSek: Optional[float] = None
    scannedAt: str


class CreatePurchaseItem(BaseModel):
    cardId: str
    cardName: str
    cardCode: str
    qty: int
    condition: str
    pricePerCardSek: float


class CreatePurchase(BaseModel):
    vendor: str
    source: str
    sourceUrl: Optional[str] = None
    shippingSek: float = 0
    feesSek: float = 0
    purchasedAt: Optional[str] = None
    notes: Optional[str] = None
    items: List[CreatePurchaseItem]


class UpdatePurchase(BaseModel):
    vendor: Optional[str] = None
    notes: Optional[str] = None
    shippingSek: Optional[float] = None
    feesSek: Optional[float] = None


class UpdateInventoryLot(BaseModel):
    status: Optional[str] = None
    qty: Optional[int] = None
    condition: Optional[str] = None
    notes: Optional[str] = None
    costBasisSek: Optional[float] = None


class CreateSale(BaseModel):
    inventoryId: int
    salePriceSek: float
    platform: str
    platformFeesSek: float = 0
    shippingSek: float = 0
    soldAt: Optional[str] = None
    buyerNotes: Optional[str] = None


class UpdateSale(BaseModel):
    salePriceSek: Optional[float] = None
    platformFeesSek: Optional[float] = None
    shippingSek: Optional[float] = None
    buyerNotes: Optional[str] = None


class Sale(BaseModel):
    id: int
    inventoryId: int
    cardName: str
    cardCode: str
    qty: int
    costBasisSek: float
    salePriceSek: float
    platform: str
    platformFeesSek: float
    shippingSek: float
    profitSek: float
    soldAt: str
    buyerNotes: Optional[str] = None


class Stats(BaseModel):
    totalInvestedSek: float
    inventoryCostSek: float
    listedCount: int
    ownedCount: int
    soldCount: int
    realizedProfitSek: float
    openDealsCount: int


class Settings(BaseModel):
    demoMode: bool
    minProfitSek: float
    defaultShippingSek: float
    cardmarketFeePercent: float
    traderaFeePercent: float
    askToSoldFactor: float
    ollamaBaseUrl: str = "http://127.0.0.1:11434"
    ollamaTextModel: str = "llama3.2"
    ollamaVisionModel: str = "llava"
    ollamaEnabled: bool = False
    minMatchConfidence: float = Field(default=0.55, ge=0, le=1)


def _require_money(value: Optional[float], field: str) -> Optional[float]:
    if value is None:
        return None
    if value < 0:
        raise HTTPException(status_code=400, detail=f"{field} cannot be negative")
    return value


def _lot_dict(row) -> Dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "cardId": row["card_id"],
        "cardName": row["card_name"],
        "cardCode": row["card_code"],
        "qty": row["qty"],
        "condition": row["condition"],
        "costBasisSek": row["cost_basis_sek"],
        "purchasedAt": row["purchased_at"],
        "status": row["status"],
        "source": row["source"],
        "notes": row["notes"] if "notes" in keys else None,
        "purchaseId": row["purchase_id"] if "purchase_id" in keys else None,
    }


def _sale_dict(row) -> Dict[str, Any]:
    cost = row["cost_basis_sek"] * row["qty"]
    net_sale = row["sale_price_sek"] - row["platform_fees_sek"] - row["shipping_sek"]
    return {
        "id": row["id"],
        "inventoryId": row["inventory_id"],
        "cardName": row["card_name"],
        "cardCode": row["card_code"],
        "qty": row["qty"],
        "costBasisSek": row["cost_basis_sek"],
        "salePriceSek": row["sale_price_sek"],
        "platform": row["platform"],
        "platformFeesSek": row["platform_fees_sek"],
        "shippingSek": row["shipping_sek"],
        "profitSek": net_sale - cost,
        "soldAt": row["sold_at"],
        "buyerNotes": row["buyer_notes"],
    }


async def _purchase_items(db, purchase_id: int) -> List[Dict[str, Any]]:
    cursor = await db.execute(
        """
        SELECT card_id, card_name, card_code, qty, condition, price_per_card_sek
        FROM purchase_items
        WHERE purchase_id = ?
        """,
        (purchase_id,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "cardId": item[0],
            "cardName": item[1],
            "cardCode": item[2],
            "qty": item[3],
            "condition": item[4],
            "pricePerCardSek": item[5],
        }
        for item in rows
    ]


async def _purchase_dict(db, row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "vendor": row["vendor"],
        "source": row["source"],
        "sourceUrl": row["source_url"],
        "totalCostSek": row["total_cost_sek"],
        "shippingSek": row["shipping_sek"],
        "feesSek": row["fees_sek"],
        "purchasedAt": row["purchased_at"],
        "notes": row["notes"],
        "items": await _purchase_items(db, row["id"]),
    }


async def _lots_for_purchase(db, purchase_id: int, purchased_at: str) -> List[Any]:
    cursor = await db.execute(
        "SELECT * FROM inventory WHERE purchase_id = ?",
        (purchase_id,),
    )
    lots = await cursor.fetchall()
    if lots:
        return lots
    cursor = await db.execute(
        """
        SELECT i.*
        FROM inventory i
        WHERE i.purchase_id IS NULL
          AND i.purchased_at = ?
          AND i.card_id IN (SELECT card_id FROM purchase_items WHERE purchase_id = ?)
        """,
        (purchased_at, purchase_id),
    )
    return await cursor.fetchall()


async def _sale_for_lot(db, lot_id: int):
    cursor = await db.execute("SELECT id FROM sales WHERE inventory_id = ?", (lot_id,))
    return await cursor.fetchone()


def _lookup_cm_price(cm_prices: Dict[str, Dict], match: Optional[Dict]) -> Optional[Dict]:
    if not match or not cm_prices:
        return None
    card_id = match.get("card_id")
    name = (match.get("name") or "").lower()
    if card_id and card_id in cm_prices:
        return cm_prices[card_id]
    if name and name in cm_prices:
        return cm_prices[name]
    return None


def _expected_profit(
    buy_price: float,
    shipping: float,
    cm_low: Optional[float],
    settings: Dict[str, Any],
) -> Optional[float]:
    if not cm_low:
        return None
    fee_percent = settings.get("tradera_fee_percent", 8.0)
    ask_to_sold_factor = settings.get("ask_to_sold_factor", 0.9)
    cm_fee = settings.get("cardmarket_fee_percent", 10.0)
    total_cost = buy_price + shipping + buy_price * (fee_percent / 100.0)
    expected_sell_gross = cm_low * ask_to_sold_factor
    expected_sell_net = expected_sell_gross * (1 - cm_fee / 100.0)
    return expected_sell_net - total_cost


def _set_scan(**kwargs):
    scan_progress.update(kwargs)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/v1/settings")
async def get_settings():
    try:
        return settings_public()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")


@app.put("/api/v1/settings")
async def update_settings(settings: Settings):
    try:
        save_settings({
            "demo_mode": settings.demoMode,
            "min_profit_sek": settings.minProfitSek,
            "default_shipping_sek": settings.defaultShippingSek,
            "cardmarket_fee_percent": settings.cardmarketFeePercent,
            "tradera_fee_percent": settings.traderaFeePercent,
            "ask_to_sold_factor": settings.askToSoldFactor,
            "ollama_base_url": settings.ollamaBaseUrl,
            "ollama_text_model": settings.ollamaTextModel,
            "ollama_vision_model": settings.ollamaVisionModel,
            "ollama_enabled": settings.ollamaEnabled,
            "min_match_confidence": settings.minMatchConfidence,
        })
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")


@app.get("/api/v1/inventory")
async def get_inventory():
    try:
        db = await get_db()
        cursor = await db.execute("""
            SELECT id, card_id, card_name, card_code, qty, condition,
                   cost_basis_sek, purchased_at, status, source, notes, purchase_id
            FROM inventory
            ORDER BY purchased_at DESC
        """)
        rows = await cursor.fetchall()
        return {"lots": [_lot_dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch inventory: {str(e)}")


@app.post("/api/v1/purchases")
async def create_purchase(purchase: CreatePurchase):
    try:
        if purchase.shippingSek < 0 or purchase.feesSek < 0:
            raise HTTPException(status_code=400, detail="Shipping and fees cannot be negative")
        if not purchase.items:
            raise HTTPException(status_code=400, detail="Purchase needs at least one item")
        for item in purchase.items:
            if item.qty < 1:
                raise HTTPException(status_code=400, detail="Quantity must be at least 1")
            if item.pricePerCardSek < 0:
                raise HTTPException(status_code=400, detail="Price cannot be negative")

        db = await get_db()

        purchased_at = purchase.purchasedAt or datetime.utcnow().isoformat()
        total_cost = sum(item.qty * item.pricePerCardSek for item in purchase.items)
        total_qty = sum(i.qty for i in purchase.items)
        cost_basis = (total_cost + purchase.shippingSek + purchase.feesSek) / total_qty

        cursor = await db.execute("""
            INSERT INTO purchases (
                vendor, source, source_url, total_cost_sek, shipping_sek,
                fees_sek, purchased_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            purchase.vendor,
            purchase.source,
            purchase.sourceUrl,
            total_cost,
            purchase.shippingSek,
            purchase.feesSek,
            purchased_at,
            purchase.notes,
        ))

        purchase_id = cursor.lastrowid

        for item in purchase.items:
            await db.execute("""
                INSERT INTO purchase_items (
                    purchase_id, card_id, card_name, card_code, qty,
                    condition, price_per_card_sek
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                purchase_id,
                item.cardId,
                item.cardName,
                item.cardCode,
                item.qty,
                item.condition,
                item.pricePerCardSek,
            ))

            await db.execute("""
                INSERT INTO inventory (
                    card_id, card_name, card_code, qty, condition,
                    cost_basis_sek, purchased_at, status, source, purchase_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item.cardId,
                item.cardName,
                item.cardCode,
                item.qty,
                item.condition,
                cost_basis,
                purchased_at,
                "owned",
                purchase.source,
                purchase_id,
            ))

        await db.commit()
        return {"status": "ok", "purchaseId": purchase_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create purchase: {str(e)}")


@app.get("/api/v1/purchases")
async def get_purchases():
    try:
        db = await get_db()
        cursor = await db.execute("""
            SELECT id, vendor, source, source_url, total_cost_sek, shipping_sek,
                   fees_sek, purchased_at, notes
            FROM purchases
            ORDER BY purchased_at DESC
        """)
        purchases_rows = await cursor.fetchall()
        purchases = [await _purchase_dict(db, row) for row in purchases_rows]
        return {"purchases": purchases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchases: {str(e)}")


@app.get("/api/v1/purchases/{purchase_id}")
async def get_purchase(purchase_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return await _purchase_dict(db, row)


@app.patch("/api/v1/purchases/{purchase_id}")
async def update_purchase(purchase_id: int, update: UpdatePurchase):
    _require_money(update.shippingSek, "shippingSek")
    _require_money(update.feesSek, "feesSek")
    db = await get_db()
    cursor = await db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase not found")

    lots = await _lots_for_purchase(db, purchase_id, row["purchased_at"])
    if any(lot["status"] == "sold" for lot in lots):
        raise HTTPException(
            status_code=409,
            detail="Cannot edit purchase: one or more lots have been sold",
        )
    for lot in lots:
        if await _sale_for_lot(db, lot["id"]):
            raise HTTPException(
                status_code=409,
                detail="Cannot edit purchase: one or more lots have been sold",
            )

    vendor = update.vendor if update.vendor is not None else row["vendor"]
    notes = update.notes if update.notes is not None else row["notes"]
    shipping = update.shippingSek if update.shippingSek is not None else row["shipping_sek"]
    fees = update.feesSek if update.feesSek is not None else row["fees_sek"]
    if not vendor.strip():
        raise HTTPException(status_code=400, detail="Vendor is required")

    await db.execute(
        """
        UPDATE purchases
        SET vendor = ?, notes = ?, shipping_sek = ?, fees_sek = ?
        WHERE id = ?
        """,
        (vendor.strip(), notes, shipping, fees, purchase_id),
    )

    total_qty = sum(lot["qty"] for lot in lots) if lots else 0
    if total_qty > 0:
        cost_basis = (row["total_cost_sek"] + shipping + fees) / total_qty
        for lot in lots:
            await db.execute(
                "UPDATE inventory SET cost_basis_sek = ? WHERE id = ?",
                (cost_basis, lot["id"]),
            )

    await db.commit()
    cursor = await db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
    updated = await cursor.fetchone()
    return await _purchase_dict(db, updated)


@app.delete("/api/v1/purchases/{purchase_id}")
async def delete_purchase(purchase_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
    row = await cursor.fetchone()
    if not row:
        return {"status": "ok"}

    lots = await _lots_for_purchase(db, purchase_id, row["purchased_at"])
    if any(lot["status"] == "sold" for lot in lots):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete purchase: one or more lots have been sold",
        )
    for lot in lots:
        if await _sale_for_lot(db, lot["id"]):
            raise HTTPException(
                status_code=409,
                detail="Cannot delete purchase: one or more lots have been sold",
            )

    for lot in lots:
        await db.execute("DELETE FROM inventory WHERE id = ?", (lot["id"],))
    await db.execute("DELETE FROM purchase_items WHERE purchase_id = ?", (purchase_id,))
    await db.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
    await db.commit()
    return {"status": "ok"}


@app.patch("/api/v1/inventory/{lot_id}")
async def update_inventory_lot(lot_id: int, update: UpdateInventoryLot):
    try:
        if all(
            value is None
            for value in (
                update.status,
                update.qty,
                update.condition,
                update.notes,
                update.costBasisSek,
            )
        ):
            raise HTTPException(status_code=400, detail="No fields to update")

        db = await get_db()
        cursor = await db.execute("SELECT * FROM inventory WHERE id = ?", (lot_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Inventory lot not found")

        if row["status"] == "sold":
            raise HTTPException(status_code=409, detail="Cannot edit a sold lot")

        if update.status is not None:
            if update.status not in ["owned", "listed", "sold", "reserved"]:
                raise HTTPException(status_code=400, detail="Invalid status")
            if update.status == "sold":
                raise HTTPException(status_code=400, detail="Record a sale instead of marking sold")

        if update.qty is not None and update.qty < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        _require_money(update.costBasisSek, "costBasisSek")

        await db.execute(
            """
            UPDATE inventory
            SET status = COALESCE(?, status),
                qty = COALESCE(?, qty),
                condition = COALESCE(?, condition),
                notes = COALESCE(?, notes),
                cost_basis_sek = COALESCE(?, cost_basis_sek)
            WHERE id = ?
            """,
            (
                update.status,
                update.qty,
                update.condition,
                update.notes,
                update.costBasisSek,
                lot_id,
            ),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM inventory WHERE id = ?", (lot_id,))
        return {"status": "ok", "lot": _lot_dict(await cursor.fetchone())}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update inventory: {str(e)}")


@app.delete("/api/v1/inventory/{lot_id}")
async def delete_inventory_lot(lot_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT id, status FROM inventory WHERE id = ?", (lot_id,))
    row = await cursor.fetchone()
    if not row:
        return {"status": "ok"}
    if await _sale_for_lot(db, lot_id) or row["status"] == "sold":
        raise HTTPException(status_code=409, detail="Cannot delete lot linked to a sale")
    await db.execute("DELETE FROM inventory WHERE id = ?", (lot_id,))
    await db.commit()
    return {"status": "ok"}


@app.post("/api/v1/sales")
async def create_sale(sale: CreateSale):
    try:
        if sale.salePriceSek < 0 or sale.platformFeesSek < 0 or sale.shippingSek < 0:
            raise HTTPException(status_code=400, detail="Money fields cannot be negative")
        db = await get_db()

        cursor = await db.execute("""
            SELECT card_name, card_code, qty, cost_basis_sek, status
            FROM inventory WHERE id = ?
        """, (sale.inventoryId,))
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Inventory lot not found")
        if row["status"] == "sold":
            raise HTTPException(status_code=409, detail="Lot already sold")

        card_name, card_code, qty, cost_basis, _status = row
        total_cost = cost_basis * qty
        net_sale = sale.salePriceSek - sale.platformFeesSek - sale.shippingSek
        profit = net_sale - total_cost

        sold_at = sale.soldAt or datetime.utcnow().isoformat()

        await db.execute("""
            INSERT INTO sales (
                inventory_id, sale_price_sek, platform, platform_fees_sek,
                shipping_sek, sold_at, buyer_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            sale.inventoryId,
            sale.salePriceSek,
            sale.platform,
            sale.platformFeesSek,
            sale.shippingSek,
            sold_at,
            sale.buyerNotes,
        ))

        await db.execute("""
            UPDATE inventory SET status = 'sold' WHERE id = ?
        """, (sale.inventoryId,))

        await db.commit()
        return {"status": "ok", "profitSek": profit}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create sale: {str(e)}")


SALE_SELECT = """
    SELECT s.id, s.inventory_id, i.card_name, i.card_code, i.qty,
           i.cost_basis_sek, s.sale_price_sek, s.platform,
           s.platform_fees_sek, s.shipping_sek, s.sold_at, s.buyer_notes
    FROM sales s
    JOIN inventory i ON s.inventory_id = i.id
"""


@app.get("/api/v1/sales")
async def get_sales():
    try:
        db = await get_db()
        cursor = await db.execute(SALE_SELECT + " ORDER BY s.sold_at DESC")
        rows = await cursor.fetchall()
        return {"sales": [_sale_dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales: {str(e)}")


@app.patch("/api/v1/sales/{sale_id}")
async def update_sale(sale_id: int, update: UpdateSale):
    _require_money(update.salePriceSek, "salePriceSek")
    _require_money(update.platformFeesSek, "platformFeesSek")
    _require_money(update.shippingSek, "shippingSek")
    db = await get_db()
    cursor = await db.execute("SELECT * FROM sales WHERE id = ?", (sale_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sale not found")

    await db.execute(
        """
        UPDATE sales
        SET sale_price_sek = COALESCE(?, sale_price_sek),
            platform_fees_sek = COALESCE(?, platform_fees_sek),
            shipping_sek = COALESCE(?, shipping_sek),
            buyer_notes = COALESCE(?, buyer_notes)
        WHERE id = ?
        """,
        (
            update.salePriceSek,
            update.platformFeesSek,
            update.shippingSek,
            update.buyerNotes,
            sale_id,
        ),
    )
    await db.commit()
    cursor = await db.execute(SALE_SELECT + " WHERE s.id = ?", (sale_id,))
    updated = await cursor.fetchone()
    return {"status": "ok", "sale": _sale_dict(updated)}


@app.delete("/api/v1/sales/{sale_id}")
async def delete_sale(sale_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT inventory_id FROM sales WHERE id = ?", (sale_id,))
    row = await cursor.fetchone()
    if not row:
        return {"status": "ok"}
    inventory_id = row["inventory_id"]
    await db.execute("DELETE FROM sales WHERE id = ?", (sale_id,))
    await db.execute(
        "UPDATE inventory SET status = 'owned' WHERE id = ? AND status = 'sold'",
        (inventory_id,),
    )
    await db.commit()
    return {"status": "ok"}


@app.get("/api/v1/stats")
async def get_stats():
    try:
        db = await get_db()
        settings = load_settings()
        min_profit = settings.get("min_profit_sek", 20.0)

        cursor = await db.execute("""
            SELECT COALESCE(SUM(total_cost_sek + shipping_sek + fees_sek), 0)
            FROM purchases
        """)
        total_invested = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT COALESCE(SUM(cost_basis_sek * qty), 0)
            FROM inventory
            WHERE status IN ('owned', 'listed')
        """)
        inventory_cost = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT COUNT(*) FROM inventory WHERE status = 'listed'
        """)
        listed_count = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT COUNT(*) FROM inventory WHERE status = 'owned'
        """)
        owned_count = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT COUNT(*) FROM inventory WHERE status = 'sold'
        """)
        sold_count = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT
                COALESCE(SUM(s.sale_price_sek - s.platform_fees_sek - s.shipping_sek - i.cost_basis_sek * i.qty), 0)
            FROM sales s
            JOIN inventory i ON s.inventory_id = i.id
        """)
        realized_profit = (await cursor.fetchone())[0]

        cursor = await db.execute("""
            SELECT COUNT(*) FROM deals
            WHERE language_filter_pass = 1 AND expected_profit_sek > ?
        """, (min_profit,))
        open_deals_count = (await cursor.fetchone())[0]

        return {
            "totalInvestedSek": total_invested,
            "inventoryCostSek": inventory_cost,
            "listedCount": listed_count,
            "ownedCount": owned_count,
            "soldCount": sold_count,
            "realizedProfitSek": realized_profit,
            "openDealsCount": open_deals_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@app.post("/api/v1/deals/{deal_id}/import-purchase")
async def import_deal_as_purchase(deal_id: int):
    try:
        db = await get_db()

        cursor = await db.execute("""
            SELECT title, detected_card_id, detected_card_name, detected_card_code,
                   buy_price_sek, shipping_estimate_sek, source, url
            FROM deals WHERE id = ?
        """, (deal_id,))
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Deal not found")

        if not row[1]:
            raise HTTPException(status_code=400, detail="Deal has no matched card")

        title, card_id, card_name, card_code, buy_price, shipping, source, url = row

        purchased_at = datetime.utcnow().isoformat()

        cursor = await db.execute("""
            INSERT INTO purchases (
                vendor, source, source_url, total_cost_sek, shipping_sek,
                fees_sek, purchased_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            source,
            source,
            url,
            buy_price,
            shipping,
            0,
            purchased_at,
            f"Imported from deal scanner: {title}",
        ))

        purchase_id = cursor.lastrowid

        await db.execute("""
            INSERT INTO purchase_items (
                purchase_id, card_id, card_name, card_code, qty,
                condition, price_per_card_sek
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            purchase_id,
            card_id,
            card_name,
            card_code,
            1,
            "NM",
            buy_price,
        ))

        cost_basis = buy_price + shipping

        await db.execute("""
            INSERT INTO inventory (
                card_id, card_name, card_code, qty, condition,
                cost_basis_sek, purchased_at, status, source, purchase_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            card_id,
            card_name,
            card_code,
            1,
            "NM",
            cost_basis,
            purchased_at,
            "owned",
            source,
            purchase_id,
        ))

        await db.commit()
        return {"status": "ok", "purchaseId": purchase_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import deal: {str(e)}")


@app.get("/api/v1/deals")
async def get_deals():
    try:
        db = await get_db()
        cursor = await db.execute("""
            SELECT id, source, url, title, image_url, detected_card_id,
                   detected_card_name, detected_card_code, confidence,
                   language_filter_pass, buy_price_sek, shipping_estimate_sek,
                   cardmarket_en_low_sek, cardmarket_en_avg_sek,
                   expected_profit_sek, scanned_at
            FROM deals
            ORDER BY (expected_profit_sek IS NULL), expected_profit_sek DESC, scanned_at DESC
        """)
        rows = await cursor.fetchall()

        deals = [
            {
                "id": row[0],
                "source": row[1],
                "url": row[2],
                "title": row[3],
                "imageUrl": row[4],
                "detectedCardId": row[5],
                "detectedCardName": row[6],
                "detectedCardCode": row[7],
                "confidence": row[8],
                "languageFilterPass": bool(row[9]),
                "buyPriceSek": row[10],
                "shippingEstimateSek": row[11],
                "cardmarketEnLowSek": row[12],
                "cardmarketEnAvgSek": row[13],
                "expectedProfitSek": row[14],
                "scannedAt": row[15],
            }
            for row in rows
        ]
        return {"deals": deals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch deals: {str(e)}")


@app.delete("/api/v1/deals/{deal_id}")
async def delete_deal(deal_id: int):
    db = await get_db()
    await db.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
    await db.commit()
    return {"status": "ok"}


@app.delete("/api/v1/deals")
async def delete_all_deals():
    db = await get_db()
    cursor = await db.execute("SELECT COUNT(*) FROM deals")
    count = (await cursor.fetchone())[0]
    await db.execute("DELETE FROM deals")
    await db.commit()
    return {"status": "ok", "deleted": count}


@app.get("/api/v1/deals/scan/status")
async def get_scan_status():
    return scan_progress


@app.post("/api/v1/deals/scan")
async def scan_deals():
    settings = load_settings()
    demo_mode = settings.get("demo_mode", True)

    if demo_mode:
        _set_scan(running=True, phase="demo", processed=0, total=0, message="Loading fixtures", error=None)
        await _create_demo_deals()
        _set_scan(running=False, phase="idle", message="Demo deals ready")
        return {"status": "ok", "mode": "demo", "message": "Created demo deals"}

    if scan_progress.get("running"):
        raise HTTPException(status_code=409, detail="A scan is already running")

    ollama_enabled = bool(settings.get("ollama_enabled", False))
    ollama = None
    if ollama_enabled:
        ollama = OllamaClient(
            settings.get("ollama_base_url", "http://127.0.0.1:11434"),
            settings.get("ollama_text_model", "llama3.2"),
            settings.get("ollama_vision_model", "llava"),
        )
        reachable = await ollama.ping()
        _set_scan(ollamaReachable=reachable)
        if not reachable:
            _set_scan(running=False, phase="error", error="Ollama unreachable", message="Ollama unreachable")
            raise HTTPException(status_code=503, detail="Ollama unreachable")

    _set_scan(
        running=True,
        phase="scraping",
        processed=0,
        total=0,
        message="Scraping Tradera and Cardmarket",
        error=None,
        ollamaReachable=True if ollama_enabled else None,
    )

    try:
        db = await get_db()
        await db.execute("DELETE FROM deals")
        await db.commit()

        cm_scraper = CardmarketScraper()
        tradera_scraper = TraderaScraper()

        _set_scan(message="Fetching Cardmarket EN comps")
        cm_prices = await cm_scraper.get_en_prices()
        _set_scan(message="Fetching Tradera listings")
        tradera_listings = await tradera_scraper.search_riftbound()

        default_shipping = settings.get("default_shipping_sek", 30.0)
        min_confidence = float(settings.get("min_match_confidence", 0.55))
        saved = 0
        total = len(tradera_listings)
        _set_scan(phase="matching", total=total, processed=0, message="Matching listings")

        for index, listing in enumerate(tradera_listings, start=1):
            _set_scan(
                processed=index,
                message=f"Matching {index}/{total}: {listing.get('title', '')[:80]}",
            )
            match = None
            language_ok = listing.get("language_ok", True)
            ollama_confidence = None

            if ollama:
                try:
                    detection = await ollama.identify_listing(
                        listing["title"],
                        listing.get("description") or "",
                        listing.get("image_url"),
                    )
                except OllamaUnreachable:
                    _set_scan(running=False, phase="error", error="Ollama unreachable")
                    raise HTTPException(status_code=503, detail="Ollama unreachable")

                if not detection or not detection.get("isRiftbound") or not detection.get("isEnglish"):
                    continue
                if detection["confidence"] < min_confidence:
                    continue
                language_ok = True
                ollama_confidence = detection["confidence"]
                match = card_matcher.match_detection(
                    detection.get("cardName"),
                    detection.get("cardCode"),
                    detection["confidence"],
                    min_confidence,
                ) if card_matcher else None
                if not match:
                    continue
            else:
                match = card_matcher.match_text(listing["title"]) if card_matcher else None
                if match and match["confidence"] < min_confidence:
                    match = None

            cm_price = _lookup_cm_price(cm_prices, match)
            expected_profit = _expected_profit(
                listing["price_sek"],
                listing.get("shipping_sek", default_shipping),
                cm_price["low_sek"] if cm_price else None,
                settings,
            )

            await db.execute("""
                INSERT INTO deals (
                    source, url, title, image_url, detected_card_id,
                    detected_card_name, detected_card_code, confidence,
                    language_filter_pass, buy_price_sek, shipping_estimate_sek,
                    cardmarket_en_low_sek, cardmarket_en_avg_sek,
                    expected_profit_sek, scanned_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "Tradera",
                listing["url"],
                listing["title"],
                listing.get("image_url"),
                match["card_id"] if match else None,
                match["name"] if match else None,
                match["code"] if match else None,
                match["confidence"] if match else ollama_confidence,
                language_ok,
                listing["price_sek"],
                listing.get("shipping_sek", 30),
                cm_price["low_sek"] if cm_price else None,
                cm_price["avg_sek"] if cm_price else None,
                expected_profit,
                datetime.utcnow().isoformat(),
            ))
            saved += 1

        await db.commit()
        _set_scan(running=False, phase="idle", message=f"Saved {saved} deals", processed=total, total=total)
        return {"status": "ok", "mode": "live", "scanned": len(tradera_listings), "saved": saved}
    except HTTPException:
        raise
    except Exception as e:
        _set_scan(running=False, phase="error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


async def _create_demo_deals():
    db = await get_db()
    await db.execute("DELETE FROM deals")

    demo_deals = [
        {
            "source": "Tradera (Demo)",
            "url": "https://www.tradera.com/item/demo/1",
            "title": "Riftbound - Aatrox, World Ender - English NM",
            "detected_card_id": "sfd-001-221",
            "detected_card_name": "Aatrox, World Ender",
            "detected_card_code": "SFD-001",
            "confidence": 0.95,
            "language_filter_pass": True,
            "buy_price_sek": 45.0,
            "shipping_estimate_sek": 25.0,
            "cardmarket_en_low_sek": 120.0,
            "expected_profit_sek": 38.0,
        },
        {
            "source": "Cardmarket (Demo)",
            "url": "https://www.cardmarket.com/en/Riftbound/Products/Singles/demo",
            "title": "Ahri, the Nine-Tailed Fox (Showcase) - EN",
            "detected_card_id": "sfd-062-221",
            "detected_card_name": "Ahri, the Nine-Tailed Fox",
            "detected_card_code": "SFD-062",
            "confidence": 0.88,
            "language_filter_pass": True,
            "buy_price_sek": 80.0,
            "shipping_estimate_sek": 15.0,
            "cardmarket_en_low_sek": 140.0,
            "expected_profit_sek": 31.0,
        },
    ]

    for deal in demo_deals:
        await db.execute("""
            INSERT INTO deals (
                source, url, title, detected_card_id, detected_card_name,
                detected_card_code, confidence, language_filter_pass,
                buy_price_sek, shipping_estimate_sek, cardmarket_en_low_sek,
                expected_profit_sek, scanned_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            deal["source"],
            deal["url"],
            deal["title"],
            deal["detected_card_id"],
            deal["detected_card_name"],
            deal["detected_card_code"],
            deal["confidence"],
            deal["language_filter_pass"],
            deal["buy_price_sek"],
            deal["shipping_estimate_sek"],
            deal["cardmarket_en_low_sek"],
            deal["expected_profit_sek"],
            datetime.utcnow().isoformat(),
        ))

    await db.commit()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
