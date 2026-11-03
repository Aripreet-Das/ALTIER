#!/bin/bash
# ALTIER · start all services.
#
#   page1/api.py          — FastAPI :8000  (colour, body, face, rules, RAG, recommender)
#   personal-stylist/api.py — FastAPI :8090  (verdict, wardrobe, outfit, shades, sizing, try-on)
#   backend/index.js        — Express :3000   (auth gateway, proxy, web frontend)
#
# Binds 0.0.0.0 so your phone can reach it on this wifi or Tailscale.
#
# Usage: ./start-all.sh
#
set -e

cd "$(dirname "$0")"
mkdir -p logs

echo "=== ALTIER · starting all services ==="

# --- 1. page1 API (FastAPI :8000)
# Python 3.11, not 3.12+: MediaPipe ships no wheel past 3.11 yet.
if [ ! -d "page1/venv" ]; then
  echo "→ creating page1 venv (python3.11)"
  python3.11 -m venv page1/venv
  ./page1/venv/bin/pip install -q -r page1/requirements.txt
fi
source page1/venv/bin/activate
echo "→ page1 API on :8000"
nohup python -m uvicorn page1.api:app --host 0.0.0.0 --port 8000 --reload > logs/page1.log 2>&1 &
echo $! > logs/page1.pid

# --- 2. personal-stylist API (FastAPI :8090)
if [ ! -d "personal_stylist/venv" ]; then
  python3.11 -m venv personal_stylist/venv
  source personal_stylist/venv/bin/activate
  pip install fastapi pydantic python-dotenv supabase requests uvicorn
fi
source personal_stylist/venv/bin/activate
echo "→ personal-stylist API on :8090"
nohup python -m uvicorn personal_stylist.api:app --host 0.0.0.0 --port 8090 --reload > logs/personal_stylist.log 2>&1 &
echo $! > logs/personal_stylist.pid

# --- 3. backend (Express :3000)
if [ ! -d "backend/node_modules" ]; then
  cd backend && npm install && cd ..
fi
echo "→ backend on :3000"
nohup node backend/index.js > logs/backend.log 2>&1 &
echo $! > logs/backend.pid

mkdir -p logs

echo ""
echo "=== All services started ==="
echo "  page1 API:        http://localhost:8000/health"
echo "  personal-stylist: http://localhost:8090/health"
echo "  backend:          http://localhost:3000/health"
echo ""
echo "Logs: logs/page1.log, logs/personal_stylist.log, logs/backend.log"
echo "Stop all: ./stop-all.sh"
