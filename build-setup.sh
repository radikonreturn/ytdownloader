#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm ci --prefer-offline --no-audit --no-fund
fi

npm run setup

printf '\nSetup installer files:\n'
find src-tauri/target/release/bundle/nsis -maxdepth 1 -type f -name '*.exe' -print 2>/dev/null || true
