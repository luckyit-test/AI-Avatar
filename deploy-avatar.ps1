# Deployment script for avatar branch
# This will deploy the current avatar branch to production server

param(
    [string]$Server = "root@43.245.226.24",
    [string]$Password = "Yd2Vc_Wejus0DlNB"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying avatar branch to production" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Deployment commands to run on server
$deployScript = @'
#!/bin/bash
set -e

# Find or create app directory
APP_DIR=$(find /opt -name "docker-compose.yml" -type f 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
if [ -z "$APP_DIR" ]; then
    APP_DIR="/opt/newava"
    echo "Creating app directory: $APP_DIR"
    mkdir -p "$APP_DIR"
fi

echo "Using app directory: $APP_DIR"
cd "$APP_DIR"

# Initialize git if needed
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git 2>/dev/null || git remote set-url origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Update from avatar branch
echo "Fetching latest changes from avatar branch..."
git fetch origin

# Checkout avatar branch
echo "Checking out avatar branch..."
if git show-ref --verify --quiet refs/heads/avatar; then
    git checkout avatar
else
    git checkout -b avatar origin/avatar
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin avatar

echo ""
echo "========================================="
echo "Code updated successfully!"
echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse --short HEAD)"
echo "========================================="
echo ""

# Rebuild containers if docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    echo "Rebuilding and restarting containers..."
    docker compose up -d --build
    echo ""
    echo "Deployment complete! Containers restarted."
else
    echo "Warning: docker-compose.yml not found. Code updated but containers not restarted."
fi
'@

# Save script to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$deployScript | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline

Write-Host "To deploy, run this command:" -ForegroundColor Yellow
Write-Host ""
Write-Host "ssh $Server 'bash -s' < $tempFile" -ForegroundColor Green
Write-Host ""
Write-Host "Or manually connect and run:" -ForegroundColor Yellow
Write-Host "ssh $Server" -ForegroundColor Green
Write-Host "Password: $Password" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then copy and paste the following commands:" -ForegroundColor Yellow
Write-Host $deployScript -ForegroundColor Cyan

# Try to execute if we have a way to pass password
Write-Host ""
Write-Host "Attempting automatic deployment..." -ForegroundColor Yellow

# Check if we can use WSL or other tools
$wslAvailable = $false
try {
    $null = wsl --list 2>&1
    $wslAvailable = $true
} catch {
    $wslAvailable = $false
}

if ($wslAvailable) {
    Write-Host "WSL detected. Trying to deploy via WSL..." -ForegroundColor Yellow
    # Copy script to WSL and execute
    $wslPath = wsl wslpath -a $tempFile
    Write-Host "Run in WSL: sshpass -p '$Password' ssh -o StrictHostKeyChecking=no $Server 'bash -s' < $wslPath" -ForegroundColor Green
} else {
    Write-Host "For automatic deployment, you can:" -ForegroundColor Yellow
    Write-Host "1. Install sshpass (via WSL or Git Bash)" -ForegroundColor Yellow
    Write-Host "2. Use SSH keys instead of password" -ForegroundColor Yellow
    Write-Host "3. Run the commands manually as shown above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Script saved to: $tempFile" -ForegroundColor Gray

