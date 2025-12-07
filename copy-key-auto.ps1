# Auto copy GEMINI_API_KEY from avatar to hnyear
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Copying GEMINI_API_KEY from avatar" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$command = @'
AVATAR_KEY=$(grep '^GEMINI_API_KEY=' /opt/newava/.env | cut -d'=' -f2- | head -1)
if [ -z "$AVATAR_KEY" ] || [ "$AVATAR_KEY" = "your_key_here" ]; then
    echo "ERROR: GEMINI_API_KEY not found or equals your_key_here"
    exit 1
fi
cd /opt/hnyear
sed -i "s|GEMINI_API_KEY=.*|GEMINI_API_KEY=$AVATAR_KEY|" .env
sed -i "s|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=$AVATAR_KEY|" .env
docker compose restart backend
echo "Key copied and backend restarted"
'@

$plinkArgs = @(
    "-ssh",
    $server,
    "-pw", $password,
    "-batch",
    "-o", "StrictHostKeyChecking=no",
    $command
)

Write-Host "Executing command on server..." -ForegroundColor Yellow
Write-Host ""

try {
    & $plinkPath $plinkArgs
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Done!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
pause
