# Business Platform Scripts

# Start both API and UI
npm run dev          # Start Next.js dev server
npm run api          # Start Python API server

# Or use the convenience script (requires bash)
./start.sh           # Starts both in one terminal

# Build for production
npm run build
npm start

# Legacy tools (still work)
python scripts/local_server.py     # Legacy intake server
python scripts/fetch_cards.py      # Update card catalog
python scripts/fetch_prices.py     # Update TCGPlayer prices
