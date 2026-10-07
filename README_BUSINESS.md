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
2. Click "Add Purchase" (TODO: UI form)
3. Enter vendor, items, costs, shipping, fees
4. System creates inventory lots and calculates P&L

### Find Deals
1. Navigate to **Deals**
2. Click **Scan for Deals**
3. System scrapes Tradera/Cardmarket for Riftbound listings
4. Matches cards using fuzzy text matching
5. Calculates expected profit based on Cardmarket EN comps
6. Filters to English-only when possible
7. Sorts by profit potential

### Demo Mode
By default, the platform runs in **demo mode** with fixture data:
- Shows example deals without live scraping
- Safe for testing UI without hitting real sites
- Set `DEMO_MODE=false` in `.env.local` to enable live scraping

## AI Card Matching

### Text Matching (Always Available)
- Fuzzy matching using RapidFuzz
- Searches card names in listing titles
- Confidence scoring (threshold: 75%)

### Vision API (Optional)
- Set `VISION_API_KEY` environment variable
- Matches card images to catalog
- Fallback to text matching if unavailable

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
- `GET /api/v1/inventory` – List inventory lots
- `GET /api/v1/purchases` – List purchases
- `GET /api/v1/deals` – List deal candidates
- `POST /api/v1/deals/scan` – Scan for new deals

See full API docs at http://127.0.0.1:8000/docs when running.

## Remaining Work / Known Limitations

### MVP Scope
- ✅ Collection display from existing data
- ✅ Database schema for business tracking
- ✅ UI for inventory, purchases, deals
- ✅ Demo mode with fixture data
- ⚠️ Scrapers are stubs (demo mode works, live scraping needs implementation)
- ⚠️ No UI forms for adding purchases yet (API endpoints exist)
- ⚠️ Vision API matching is stubbed (text matching works)
- ⚠️ P&L calculations in progress

### Next Steps
1. Implement live Tradera scraper (requires HTML structure investigation)
2. Implement Cardmarket EN price scraper
3. Add UI forms for purchases/sales
4. Integrate vision API for image matching
5. Add export/reporting features
6. Implement bulk import from Tradera/Cardmarket CSVs

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
