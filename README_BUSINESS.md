# Riftbound Business Platform

A local central platform for managing a small English-only Riftbound singles resale business in Sweden.

## Features

### Core Functionality
- **Collection Display** – View your existing Riftbound card collection
- **Business Inventory Ledger** – Track purchases, stock on hand, for sale, sold, with per-line and overall P&L
- **Deal Finder** – Scan buy sources (Tradera, Cardmarket) for underpriced English singles
- **AI Card Matching** – Match listing images/titles to catalog cards (English printings only)
- **Price Comps** – Cardmarket EN price reference (NM/EX low/avg)

### Market Rules
- **English cards only** – Hard-filter non-EN listings
- **Price reference** – Cardmarket Riftbound English (NM/EX grades)
- **Buy sources** – Tradera (Swedish auction site) + Cardmarket EN comps
- **Deal scoring** – Expected Cardmarket EN sell net − (buy + shipping + platform fees)
- **No auto-buy** – Manual review required; no secrets in git
- **Rate limits** – Polite scraping with delays; public data only

## Architecture

### Frontend (Next.js + TypeScript)
- **Pages:** Dashboard, Collection, Inventory, Purchases, Deals, Card Detail, Settings
- **Port:** `http://localhost:3000`
- **Framework:** Next.js 14 with App Router

### Backend (Python + FastAPI)
- **API Server:** FastAPI with async SQLite
- **Port:** `http://127.0.0.1:8000`
- **Services:**
  - Scrapers (Cardmarket, Tradera)
  - Card matching (fuzzy text + optional vision API)
  - Business logic (P&L, inventory tracking)

### Data Storage
- **SQLite** – `data/business.db` for inventory, purchases, sales, deals
- **JSON** – Existing `data/cards.json`, `data/collection.json` preserved
- **GitHub Pages** – Legacy gallery remains functional at `/index.html`

## Setup

### Prerequisites
- Node.js 18+ (for Next.js frontend)
- Python 3.10+ (for FastAPI backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RaasBraa/riftbound.git
   cd riftbound
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   cd api
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

4. **Environment variables (optional)**
   Create a `.env.local` file in the root for configuration:
   ```bash
   # Demo mode (default: true) - uses fixture data instead of live scraping
   DEMO_MODE=true
   
   # Optional: Vision API key for image-based card matching
   # VISION_API_KEY=your_key_here
   ```

### Running the Platform

You need to run **both** the API server and the Next.js frontend:

**Terminal 1 - API Server:**
```bash
cd api
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev
```

Then open your browser to:
- **Business Platform:** http://localhost:3000
- **Legacy Gallery:** http://localhost:3000/gallery or http://localhost:3000/index.html
- **API Docs:** http://127.0.0.1:8000/docs

Dark mode follows the OS by default. Toggle it in the nav bar or Settings (stored in `localStorage`).

### Alternative: Using npm scripts
```bash
# Terminal 1
npm run api

# Terminal 2
npm run dev
```

## Data Model

### Inventory Lots
```sql
- card_id, card_name, card_code
- qty, condition (NM, EX, etc.)
- cost_basis_sek (per card)
- status: owned | listed | sold | reserved
- purchased_at, source
```

### Purchases
```sql
- vendor, source, source_url
- total_cost_sek, shipping_sek, fees_sek
- purchased_at, notes
- items: [card_id, qty, condition, price_per_card_sek]
```

### Deals
```sql
- source (Tradera, Cardmarket), url, title, image_url
- detected_card_id, confidence, language_filter_pass
- buy_price_sek, shipping_estimate_sek
- cardmarket_en_low_sek, cardmarket_en_avg_sek
- expected_profit_sek
```

### Sales
```sql
- inventory_id (FK), sale_price_sek
- platform, platform_fees_sek, shipping_sek
- sold_at, buyer_notes
```

## Usage

### View Collection
Navigate to **Collection** to see cards from your existing `data/collection.json`.

### Track Purchases
1. Navigate to **Purchases**
2. Click **Add Purchase**
3. Enter vendor, items, costs, shipping, fees
4. System creates inventory lots and calculates P&L
5. Edit vendor/notes/shipping/fees, or delete (cascades unsold lots; blocked if any lot is sold)

### Inventory & Sold
- **Inventory:** edit qty/condition/status/notes/cost, mark listed, record sale, or delete (blocked if a sale exists)
- **Sold:** edit price/fees/shipping (profit recalculates live) or delete a sale (lot returns to owned)

### Find Deals
1. Navigate to **Deals**
2. Click **Scan for Deals**
3. Demo mode loads fixtures (default). Live mode (demo off) scrapes Tradera and Cardmarket EN comps
4. If Ollama is enabled, each listing is identified with a vision or text model, then matched to `data/cards.json`
5. Non-English / non-Riftbound / low-confidence hits are dropped
6. Expected profit uses fee and shipping settings
7. Remove a row or **Clear all**; **Import as Purchase** still creates stock

### Demo Mode
By default, the platform runs in **demo mode** (`demo_mode: true` in `data/settings.json`):
- Shows example deals without live scraping or Ollama
- Safe for testing UI without hitting real sites
- Turn Demo Mode off in Settings to enable live scraping

## AI Card Matching

### Text Matching (Always Available)
- Exact card code when present, then RapidFuzz names
- Confidence must meet `minMatchConfidence` (default 0.55)

### Ollama (optional, local only)
Live scrape + Ollama run only when **demo mode is off** and **Ollama is enabled** in Settings.

```bash
ollama serve
ollama pull llama3.2          # or your Settings text model
ollama pull llava             # or your Settings vision model
```

- Default URL: `http://127.0.0.1:11434`
- Vision model is used when the listing has an image URL; otherwise the text model
- Strict JSON: `cardName`, `cardCode?`, `set?`, `language`, `conditionGuess?`, `confidence`, `isRiftbound`, `isEnglish`
- Scan UI shows progress; if Ollama is down you get **Ollama unreachable**
- Aquitaz and TCGPlayer scrapers stay stubbed

## Scraper Notes

### Tradera (Swedish Auction Site)
- **URL:** https://www.tradera.com
- **Search:** "Riftbound" keyword
- **Rate Limit:** 1-2 second delay between requests
- **ToS:** Public auction listings only; no automated bidding
- **Language Filter:** Manual review recommended (some listings may not specify language)

### Cardmarket
- **URL:** https://www.cardmarket.com/en/Riftbound
- **Purpose:** Price comps for English singles (NM/EX grades)
- **Rate Limit:** 2-3 second delay between requests
- **ToS:** Public price data only; no automated purchases
- **Filter:** `/en/Riftbound` path ensures English language preference

### Extension Points
Add new sources by creating scrapers in `api/scrapers/`:
1. Implement `search_riftbound()` method
2. Return standardized listing dict
3. Register in `api/main.py`

## Legacy Features (Preserved)

The original static GitHub Pages gallery remains fully functional:

- **Gallery:** `/index.html` (redirects from `/gallery`)
- **Intake:** `/intake.html` for fast collection entry
- **Local Server:** `python scripts/local_server.py` (legacy tool)
- **Data:** `data/collection.json` read by both systems

### Adding Cards (Legacy)
```bash
python scripts/local_server.py
# Visit http://127.0.0.1:4173/intake.html
# Use voice, camera, or text search to add cards
```

### Refreshing Prices (Legacy)
```bash
python scripts/fetch_prices.py
# Updates data/prices.json with TCGPlayer prices
```

## Development

### Database Migrations
The database schema is created automatically on first run. To reset:
```bash
rm data/business.db
# Restart the API server to recreate tables
```

### API Endpoints
- `GET /api/v1/health` – Health check
- `GET /api/v1/settings` · `PUT /api/v1/settings`
- `GET /api/v1/inventory` · `PATCH /api/v1/inventory/{id}` · `DELETE /api/v1/inventory/{id}`
- `GET/POST /api/v1/purchases` · `GET/PATCH/DELETE /api/v1/purchases/{id}`
- `GET/POST /api/v1/sales` · `PATCH/DELETE /api/v1/sales/{id}`
- `GET /api/v1/deals` · `DELETE /api/v1/deals` · `DELETE /api/v1/deals/{id}`
- `POST /api/v1/deals/scan` · `GET /api/v1/deals/scan/status`
- `GET /api/v1/stats`

See full API docs at http://127.0.0.1:8000/docs when running.

```bash
python test_api.py   # requires API on :8000; skips live Ollama
```

## Remaining Work / Known Limitations

### MVP Scope
- ✅ Collection display from existing data (read-only; not merged into inventory)
- ✅ Editable purchases, inventory, sales, and deals
- ✅ Dark mode
- ✅ Demo mode with fixture data
- ✅ Local Ollama matching when demo is off
- ⚠️ Live Tradera/Cardmarket HTML is still site-structure dependent
- ⚠️ Aquitaz / TCGPlayer scrapers remain stubs

### Next Steps
1. Harden live Tradera and Cardmarket parsers as those sites change
2. Optional bulk CSV import
3. Export / reporting

## Legal & Ethics

### Compliance
- ✅ Public data only (no authenticated scraping)
- ✅ Polite rate limits (1-3 second delays)
- ✅ User-Agent identification
- ✅ No automated purchasing
- ✅ Manual review required for deals
- ⚠️ Review Tradera and Cardmarket ToS before enabling live scraping

### Recommendations
- Start with demo mode
- Test scrapers on small datasets
- Monitor for site structure changes
- Consider using official APIs when available
- Respect robots.txt directives

## License & Disclaimer

Riftbound, League of Legends, and related marks are trademarks of Riot Games, Inc. This project is unofficial and not endorsed by Riot.

Card data and images are sourced from the official Riftbound gallery for personal collection tracking and price comparison purposes only.

---

**Questions?** Open an issue on GitHub or check the existing discussions.
