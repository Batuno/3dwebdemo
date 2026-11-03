#!/bin/sh
# Installs everything and opens the showroom. Usage: ./start.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is needed. Get it from https://nodejs.org and run this again."
  exit 1
fi
exec node tools/start.mjs "$@"
