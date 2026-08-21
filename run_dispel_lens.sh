#!/bin/bash
# ==============================================================================
# Dispel Lens — 1-Click Complete Launcher (Zero Cost, No Fees)
# Starts the Backend Server, Cloudflare Tunnel, and Launches Chrome with the Extension
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "=========================================================="
echo "🚀 Starting Dispel Lens (dispel.cloud/lens) - 1-Click Launch"
echo "=========================================================="

# 1. Activate Virtual Environment & Start Backend Server if not already running
if ! lsof -i :8000 > /dev/null 2>&1; then
  echo "[1/3] Starting FastAPI Backend on port 8000..."
  source venv/bin/activate
  cd backend
  python server.py &
  cd "$PROJECT_DIR"
  sleep 2
else
  echo "[1/3] Backend already running on port 8000."
fi

# 2. Start Cloudflare Tunnel for Free Public HTTPS / WSS if not already running
if ! pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
  echo "[2/3] Launching free Cloudflare Tunnel..."
  cloudflared tunnel --url http://localhost:8000 > /tmp/dispel_tunnel.log 2>&1 &
  sleep 3
else
  echo "[2/3] Cloudflare Tunnel already active."
fi

# 3. Launch Google Chrome with Dispel Lens Extension Pre-Loaded
echo "[3/3] Launching Google Chrome with Dispel Lens Extension loaded..."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="/tmp/chrome-dispel-dev-profile" \
  --load-extension="$PROJECT_DIR/extension" \
  "http://localhost:8000/demo/" \
  "https://www.youtube.com" > /dev/null 2>&1 &

echo "=========================================================="
echo "✨ Dispel Lens is LIVE and running on your screen!"
echo "   - Local Portal: http://localhost:8000/demo/"
echo "   - YouTube & TikTok: Ambient HUD Badge active on videos"
echo "=========================================================="
