$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    npm ci --prefer-offline --no-audit --no-fund
}

npm run fast
