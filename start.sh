#!/bin/bash
# Start both API server and Next.js dev server

set -e

echo "🚀 Starting Riftbound Business Platform..."
echo ""

if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

if ! pip3 show fastapi > /dev/null 2>&1; then
    echo "🐍 Installing Python dependencies..."
    cd api && pip3 install -q -r requirements.txt && cd ..
fi

export PATH="/home/ubuntu/.local/bin:$HOME/.local/bin:$PATH"

echo "✅ Dependencies installed"
echo ""
echo "Starting services..."
echo "  API Server:  http://127.0.0.1:8000"
echo "  Next.js UI:  http://localhost:3000"
echo "  API Docs:    http://127.0.0.1:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

trap 'kill 0' EXIT

cd api && python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
cd .. && npm run dev &

wait
