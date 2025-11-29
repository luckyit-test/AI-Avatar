# Simple deployment script
$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"

Write-Host "Deploying to server..." -ForegroundColor Cyan

# Create deployment commands
$deployCommands = @"
cd /opt/newava 2>/dev/null || (find /opt -name 'docker-compose.yml' -type f 2>/dev/null | head -1 | xargs dirname) || mkdir -p /opt/newava && cd /opt/newava
if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi
git fetch origin
git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
git pull origin avatar
if [ -f docker-compose.yml ]; then docker compose up -d --build; fi
"@

Write-Host "Please run this command manually:" -ForegroundColor Yellow
Write-Host "ssh root@$server" -ForegroundColor Green
Write-Host "Password: $password" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then execute:" -ForegroundColor Yellow
Write-Host $deployCommands -ForegroundColor Green

