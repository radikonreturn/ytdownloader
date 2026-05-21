$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    npm ci --prefer-offline --no-audit --no-fund
}

npm run setup

$setupFiles = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue

if ($setupFiles) {
    Write-Host "`nSetup installer created:" -ForegroundColor Green
    $setupFiles | ForEach-Object { Write-Host $_.FullName }
}
else {
    Write-Host "`nBuild finished, but no NSIS setup .exe was found." -ForegroundColor Yellow
    Write-Host "Check src-tauri\target\release\bundle for generated installer files."
}
