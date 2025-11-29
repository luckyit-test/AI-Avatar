# Direct deployment script for avatar branch
# This script will execute deployment commands on the server

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$appDir = "/opt/newava"
$branch = "avatar"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying avatar branch to production" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Create a single SSH command that does everything
$deployCommand = @"
cd $appDir && 
if [ ! -d .git ]; then 
    git init && 
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git; 
fi && 
git fetch origin && 
git checkout $branch 2>/dev/null || git checkout -b $branch origin/$branch && 
git pull origin $branch && 
echo 'Current commit:' && git log -1 --oneline && 
echo 'Current branch:' && git branch --show-current && 
if [ -f docker-compose.yml ]; then 
    docker compose up -d --build; 
    echo 'Containers restarted'; 
else 
    echo 'docker-compose.yml not found'; 
fi
"@

Write-Host "Executing deployment commands..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Command to run:" -ForegroundColor Yellow
Write-Host "ssh $server" -ForegroundColor Green
Write-Host ""
Write-Host "Then paste this:" -ForegroundColor Yellow
Write-Host $deployCommand -ForegroundColor Cyan
Write-Host ""

# Try to use plink if available, or provide manual instructions
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue
if ($plinkPath) {
    Write-Host "Found plink.exe, attempting deployment..." -ForegroundColor Green
    $deployCommand | & $plinkPath.Path -ssh $server -pw $password
} else {
    Write-Host "For automatic deployment, you can:" -ForegroundColor Yellow
    Write-Host "1. Install PuTTY (includes plink.exe)" -ForegroundColor Yellow
    Write-Host "2. Use WSL with expect: wsl bash deploy-avatar-branch.sh" -ForegroundColor Yellow
    Write-Host "3. Run the commands manually as shown above" -ForegroundColor Yellow
}

