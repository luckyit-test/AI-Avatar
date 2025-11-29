# Complete setup and deployment script
$ErrorActionPreference = "Stop"

$server = "43.245.226.24"
$user = "root"
$password = "Yd2Vc_Wejus0DlNB"
$sshKey = "$env:USERPROFILE\.ssh\avatar_deploy"
$pubKey = "$sshKey.pub"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Setting up SSH key and deploying" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Read public key
if (Test-Path $pubKey) {
    $pubKeyContent = Get-Content $pubKey -Raw
    Write-Host "SSH key found: $pubKey" -ForegroundColor Green
} else {
    Write-Host "SSH key not found. Please run deploy-now.ps1 first." -ForegroundColor Red
    exit 1
}

# Create script to add key and deploy
$setupScript = @"
#!/bin/bash
set -e

# Add SSH key
mkdir -p ~/.ssh
echo '$pubKeyContent' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Deploy
cd /opt/newava

if [ ! -d .git ]; then
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git 2>/dev/null || git remote set-url origin https://github.com/luckyit-test/AI-Avatar.git
fi

git fetch origin
git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
git pull origin avatar

echo "✅ Code updated! Branch: `$(git branch --show-current), Commit: `$(git rev-parse --short HEAD)"

if [ -f "docker-compose.yml" ]; then
    docker compose up -d --build
    docker compose ps
fi
"@

Write-Host "Deploying via SSH with password (one-time setup)..." -ForegroundColor Yellow
Write-Host ""

# Use plink if available
$plink = Get-Command plink -ErrorAction SilentlyContinue
if ($plink) {
    $setupScript | & $plink.Path -ssh "$user@$server" -pw $password
} else {
    Write-Host "PuTTY plink not found. Please install PuTTY or run manually:" -ForegroundColor Yellow
    Write-Host "ssh $user@$server" -ForegroundColor Green
    Write-Host "Password: $password" -ForegroundColor Yellow
    Write-Host ""
    Write-Host $setupScript -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Setup complete! Future deployments can use SSH key." -ForegroundColor Green

