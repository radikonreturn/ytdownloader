# install_deps.ps1
# Run once to install yt-dlp (pip) and ffmpeg (winget or scoop).

Write-Host "`n=== Installing yt-dlp ===" -ForegroundColor Cyan
pip install -q --upgrade yt-dlp
Write-Host "yt-dlp OK" -ForegroundColor Green

Write-Host "`n=== Installing ffmpeg ===" -ForegroundColor Cyan

# Try winget first
if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id=Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    Write-Host "ffmpeg installed via winget. You may need to restart your terminal." -ForegroundColor Green
}
elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
    scoop install ffmpeg
    Write-Host "ffmpeg installed via scoop." -ForegroundColor Green
}
else {
    Write-Host "Neither winget nor scoop found." -ForegroundColor Yellow
    Write-Host "Please install ffmpeg manually from https://ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host "and place ffmpeg.exe in the 'bin\' folder next to ytclip.py" -ForegroundColor Yellow
}

Write-Host "`nAll done. Try: python ytclip.py --help`n" -ForegroundColor Cyan
