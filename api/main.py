import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.database import init_db, get_db
from services.matcher import CardMatcher
from services.settings import load_settings, save_settings, get_setting
from scrapers.cardmarket import CardmarketScraper
from scrapers.tradera import TraderaScraper

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "cards.json"


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


class UpdateInventoryStatus(BaseModel):
    status: str


class CreateSale(BaseModel):
    inventoryId: int
    salePriceSek: float
    platform: str
    platformFeesSek: float = 0
    shippingSek: float = 0
    soldAt: Optional[str] = None
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


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/v1/settings")
async def get_settings():
    settings = load_settings()
    return {
        "demoMode": settings.get("demo_mode", True),
        "minProfitSek": settings.get("min_profit_sek", 20.0),
        "defaultShippingSek": settings.get("default_shipping_sek", 30.0),
        "cardmarketFeePercent": settings.get("cardmarket_fee_percent", 10.0),
        "traderaFeePercent": settings.get("tradera_fee_percent", 8.0),
        "askToSoldFactor": settings.get("ask_to_sold_factor", 0.9),
    }


@app.put("/api/v1/settings")
async def update_settings(settings: Settings):
    save_settings({
        "demo_mode": settings.demoMode,
        "min_profit_sek": settings.minProfitSek,
        "default_shipping_sek": settings.defaultShippingSek,
        "cardmarket_fee_percent": settings.cardmarketFeePercent,
        "tradera_fee_percent": settings.traderaFeePercent,
        "ask_to_sold_factor": settings.askToSoldFactor,
    })
    return {"status": "ok"}


@app.get("/api/v1/inventory")
async def get_inventory():
    db = await get_db()
    cursor = await db.execute("""
        SELECT id, card_id, card_name, card_code, qty, condition, 
               cost_basis_sek, purchased_at, status, source
        FROM inventory
        ORDER BY purchased_at DESC
    """)
    rows = await cursor.fetchall()
    
    lots = [
        {
            "id": row[0],
            "cardId": row[1],
            "cardName": row[2],
            "cardCode": row[3],
            "qty": row[4],
            "condition": row[5],
            "costBasisSek": row[6],
            "purchasedAt": row[7],
            "status": row[8],
            "source": row[9],
        }
        for row in rows
    ]
    return {"lots": lots}


@app.post("/api/v1/purchases")
async def create_purchase(purchase: CreatePurchase):
    db = await get_db()
    
    purchased_at = purchase.purchasedAt or datetime.utcnow().isoformat()
    total_cost = sum(item.qty * item.pricePerCardSek for item in purchase.items)
    
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
        
        cost_basis = (total_cost + purchase.shippingSek + purchase.feesSek) / sum(i.qty for i in purchase.items)
        
        await db.execute("""
            INSERT INTO inventory (
                card_id, card_name, card_code, qty, condition,
                cost_basis_sek, purchased_at, status, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ))
    
    await db.commit()
    return {"status": "ok", "purchaseId": purchase_id}


@app.get("/api/v1/purchases")
async def get_purchases():
    db = await get_db()
    cursor = await db.execute("""
        SELECT id, vendor, source, source_url, total_cost_sek, shipping_sek, 
               fees_sek, purchased_at, notes
        FROM purchases
        ORDER BY purchased_at DESC
    """)
    purchases_rows = await cursor.fetchall()
    
    purchases = []
    for row in purchases_rows:
        purchase_id = row[0]
        items_cursor = await db.execute("""
            SELECT card_id, card_name, card_code, qty, condition, price_per_card_sek
            FROM purchase_items
            WHERE purchase_id = ?
        """, (purchase_id,))
        items_rows = await items_cursor.fetchall()
        
        items = [
            {
                "cardId": item[0],
                "cardName": item[1],
                "cardCode": item[2],
                "qty": item[3],
                "condition": item[4],
                "pricePerCardSek": item[5],
            }
            for item in items_rows
        ]
        
        purchases.append({
            "id": row[0],
            "vendor": row[1],
            "source": row[2],
            "sourceUrl": row[3],
            "totalCostSek": row[4],
            "shippingSek": row[5],
            "feesSek": row[6],
            "purchasedAt": row[7],
            "notes": row[8],
            "items": items,
        })
    
    return {"purchases": purchases}


@app.patch("/api/v1/inventory/{lot_id}")
async def update_inventory_status(lot_id: int, update: UpdateInventoryStatus):
    db = await get_db()
    
    if update.status not in ["owned", "listed", "sold", "reserved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.execute("""
        UPDATE inventory SET status = ? WHERE id = ?
    """, (update.status, lot_id))
    
    await db.commit()
    return {"status": "ok"}


@app.post("/api/v1/sales")
async def create_sale(sale: CreateSale):
    db = await get_db()
    
    cursor = await db.execute("""
        SELECT card_name, card_code, qty, cost_basis_sek
        FROM inventory WHERE id = ?
    """, (sale.inventoryId,))
    row = await cursor.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Inventory lot not found")
    
    card_name, card_code, qty, cost_basis = row
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


@app.get("/api/v1/sales")
async def get_sales():
    db = await get_db()
    cursor = await db.execute("""
        SELECT s.id, s.inventory_id, i.card_name, i.card_code, i.qty,
               i.cost_basis_sek, s.sale_price_sek, s.platform,
               s.platform_fees_sek, s.shipping_sek, s.sold_at, s.buyer_notes
        FROM sales s
        JOIN inventory i ON s.inventory_id = i.id
        ORDER BY s.sold_at DESC
    """)
    rows = await cursor.fetchall()
    
    sales = []
    for row in rows:
        cost = row[5] * row[4]
        net_sale = row[6] - row[8] - row[9]
        profit = net_sale - cost
        
        sales.append({
            "id": row[0],
            "inventoryId": row[1],
            "cardName": row[2],
            "cardCode": row[3],
            "qty": row[4],
            "costBasisSek": row[5],
            "salePriceSek": row[6],
            "platform": row[7],
            "platformFeesSek": row[8],
            "shippingSek": row[9],
            "profitSek": profit,
            "soldAt": row[10],
            "buyerNotes": row[11],
        })
    
    return {"sales": sales}


@app.get("/api/v1/stats")
async def get_stats():
    db = await get_db()
    
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
        WHERE language_filter_pass = 1 AND expected_profit_sek > 20
    """)
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


@app.post("/api/v1/deals/{deal_id}/import-purchase")
async def import_deal_as_purchase(deal_id: int):
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
            cost_basis_sek, purchased_at, status, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ))
    
    await db.commit()
    return {"status": "ok", "purchaseId": purchase_id}


@app.get("/api/v1/deals")
async def get_deals():
    db = await get_db()
    cursor = await db.execute("""
        SELECT id, source, url, title, image_url, detected_card_id, 
               detected_card_name, detected_card_code, confidence,
               language_filter_pass, buy_price_sek, shipping_estimate_sek,
               cardmarket_en_low_sek, cardmarket_en_avg_sek, 
               expected_profit_sek, scanned_at
        FROM deals
        ORDER BY expected_profit_sek DESC NULLS LAST, scanned_at DESC
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


@app.post("/api/v1/deals/scan")
async def scan_deals():
    settings = load_settings()
    demo_mode = settings.get("demo_mode", True)
    
    if demo_mode:
        await _create_demo_deals()
        return {"status": "ok", "mode": "demo", "message": "Created demo deals"}
    
    db = await get_db()
    await db.execute("DELETE FROM deals")
    await db.commit()
    
    cm_scraper = CardmarketScraper()
    tradera_scraper = TraderaScraper()
    
    cm_prices = await cm_scraper.get_en_prices()
    tradera_listings = await tradera_scraper.search_riftbound()
    
    settings = load_settings()
    ask_to_sold_factor = settings.get("ask_to_sold_factor", 0.9)
    default_shipping = settings.get("default_shipping_sek", 30.0)
    fee_percent = settings.get("tradera_fee_percent", 8.0)
    
    for listing in tradera_listings:
        match = card_matcher.match_text(listing["title"])
        
        cm_price = None
        if match and match["card_id"] in cm_prices:
            cm_price = cm_prices[match["card_id"]]
        
        expected_profit = None
        if cm_price and cm_price.get("low_sek"):
            buy_price = listing["price_sek"]
            shipping = listing.get("shipping_sek", default_shipping)
            total_cost = buy_price + shipping
            
            buy_fees = buy_price * (fee_percent / 100.0)
            total_cost_with_fees = total_cost + buy_fees
            
            expected_sell_gross = cm_price["low_sek"] * ask_to_sold_factor
            sell_fees = expected_sell_gross * 0.1
            expected_sell_net = expected_sell_gross - sell_fees
            
            expected_profit = expected_sell_net - total_cost_with_fees
        
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
            match["confidence"] if match else None,
            listing.get("language_ok", True),
            listing["price_sek"],
            listing.get("shipping_sek", 30),
            cm_price["low_sek"] if cm_price else None,
            cm_price["avg_sek"] if cm_price else None,
            expected_profit,
            datetime.utcnow().isoformat(),
        ))
    
    await db.commit()
    return {"status": "ok", "mode": "live", "scanned": len(tradera_listings)}


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
