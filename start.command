#!/bin/zsh
# Double-click to run Cortex Medical Academy locally with the same routing as production.
cd "$(dirname "$0")"
PORT=8765
( sleep 1; open "http://127.0.0.1:$PORT" ) &
exec python3 scripts/serve.py --port "$PORT"
