import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.database import init_db, get_db
from services.matcher import CardMatcher
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


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


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
    demo_mode = os.getenv("DEMO_MODE", "true").lower() == "true"
    
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
    
    for listing in tradera_listings:
        match = card_matcher.match_text(listing["title"])
        
        cm_price = None
        if match and match["card_id"] in cm_prices:
            cm_price = cm_prices[match["card_id"]]
        
        expected_profit = None
        if cm_price and cm_price.get("low_sek"):
            total_cost = listing["price_sek"] + listing.get("shipping_sek", 30)
            expected_sell = cm_price["low_sek"] * 0.9
            expected_profit = expected_sell - total_cost
        
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
