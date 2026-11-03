#!/bin/bash
# ALTIER · start the page1 engine alone. Binds 0.0.0.0 so your phone can reach it on this wifi.
cd "$(dirname "$0")"

PY=page1/venv/bin/python
if [ ! -x "$PY" ]; then
  echo "no page1 venv — falling back to python3.11 on PATH"
  echo "  python3.11 -m venv page1/venv && source page1/venv/bin/activate && pip install -r page1/requirements.txt"
  PY=python3.11
fi

exec "$PY" -m uvicorn page1.api:app --host 0.0.0.0 --port 8000 --reload
