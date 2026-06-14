#!/bin/zsh
# Double-click to launch Clinical Scenarios
cd "$(dirname "$0")"
PORT=8765
( sleep 1; open "http://localhost:$PORT" ) &
exec python3 -m http.server $PORT
