#!/bin/bash
# ALTIER · stop all services started by start-all.sh.
cd "$(dirname "$0")"

for pidfile in logs/page1.pid logs/personal_stylist.pid logs/backend.pid; do
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "stopped $pidfile (pid $pid)"
    fi
    rm -f "$pidfile"
  fi
done

# Also kill any stray uvicorn/node processes on our ports
pkill -f "uvicorn page1.api:app" 2>/dev/null || true
pkill -f "uvicorn personal_stylist.api:app" 2>/dev/null || true
pkill -f "node backend/index.js" 2>/dev/null || true

echo "=== All services stopped ==="
