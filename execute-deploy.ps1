# Execute deployment directly
$ErrorActionPreference = "Continue"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"

$deployCmd = @"
cd /opt/newava && 
if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && 
git fetch origin && 
git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && 
git pull origin avatar && 
echo 'Code updated! Branch:' `$(git branch --show-current) 'Commit:' `$(git rev-parse --short HEAD) && 
if [ -f docker-compose.yml ]; then docker compose up -d --build && docker compose ps; fi
"@

Write-Host "Deploying to production..." -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Cyan
Write-Host ""

# Try multiple methods
$methods = @(
    { ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $server $deployCmd },
    { echo $password | ssh -o StrictHostKeyChecking=no $server $deployCmd }
)

foreach ($method in $methods) {
    try {
        Write-Host "Trying deployment method..." -ForegroundColor Yellow
        & $method
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "Method failed, trying next..." -ForegroundColor Yellow
    }
}

Write-Host "`n⚠️  Automatic deployment failed. GitHub Actions will handle it automatically." -ForegroundColor Yellow
Write-Host "Check: https://github.com/luckyit-test/AI-Avatar/actions" -ForegroundColor Cyan

