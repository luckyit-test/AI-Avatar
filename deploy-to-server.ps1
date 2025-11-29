# PowerShell deployment script
# This script deploys the avatar branch to the production server

$ErrorActionPreference = "Stop"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$repoUrl = "https://github.com/luckyit-test/AI-Avatar.git"
$branch = "avatar"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying avatar branch to production" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Create SSH commands script
$sshScript = @"
# Find app directory
APP_DIR=`$(find /opt -name "docker-compose.yml" -type f 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
if [ -z "`$APP_DIR" ]; then
    APP_DIR="/opt/newava"
    mkdir -p "`$APP_DIR"
fi

echo "App directory: `$APP_DIR"
cd "`$APP_DIR"

# Initialize git repo if needed
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin $repoUrl || git remote set-url origin $repoUrl
fi

# Fetch and checkout avatar branch
echo "Fetching and checking out avatar branch..."
git fetch origin
git checkout $branch 2>/dev/null || git checkout -b $branch origin/$branch
git pull origin $branch

echo "Code updated successfully!"
echo "Current branch: `$(git branch --show-current)"
echo "Current commit: `$(git rev-parse HEAD)"

# Rebuild and restart containers if docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    echo "Rebuilding and restarting containers..."
    docker compose up -d --build
    echo "Deployment complete!"
else
    echo "docker-compose.yml not found. Code updated but containers not restarted."
fi
"@

# Save script to temp file
$tempScript = [System.IO.Path]::GetTempFileName()
$sshScript | Out-File -FilePath $tempScript -Encoding ASCII

Write-Host "Connecting to server and deploying..." -ForegroundColor Yellow
Write-Host "Note: You will be prompted for the SSH password: $password" -ForegroundColor Yellow
Write-Host ""

# Try to use ssh with password
# Note: On Windows, you may need to use plink.exe or configure SSH key
try {
    # Try using ssh with the script
    $sshCommand = "ssh -o StrictHostKeyChecking=no root@43.245.226.24 'bash -s' < $tempScript"
    
    Write-Host "Executing SSH command..." -ForegroundColor Yellow
    Write-Host "If password prompt appears, enter: $password" -ForegroundColor Yellow
    Write-Host ""
    
    # For Windows, we'll provide instructions
    Write-Host "=========================================" -ForegroundColor Yellow
    Write-Host "MANUAL DEPLOYMENT INSTRUCTIONS" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please run the following commands manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "ssh root@43.245.226.24" -ForegroundColor Green
    Write-Host "# Enter password when prompted: $password" -ForegroundColor Green
    Write-Host ""
    Write-Host "Then on the server, run:" -ForegroundColor Green
    Write-Host ""
    Write-Host "cd /opt/newava  # or find your app directory" -ForegroundColor Green
    Write-Host "git fetch origin" -ForegroundColor Green
    Write-Host "git checkout avatar" -ForegroundColor Green
    Write-Host "git pull origin avatar" -ForegroundColor Green
    Write-Host "docker compose up -d --build" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    # Clean up temp file
    if (Test-Path $tempScript) {
        Remove-Item $tempScript -Force
    }
}
