# Automated deployment script for avatar branch
# Uses SSH with password authentication

$ErrorActionPreference = "Stop"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$appDir = "/opt/newava"
$branch = "avatar"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Automated Deployment: avatar branch" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Create deployment script content
$scriptContent = @"
set -e
cd $appDir

echo "📥 Initializing/updating repository..."
if [ ! -d .git ]; then
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git 2>/dev/null || git remote set-url origin https://github.com/luckyit-test/AI-Avatar.git
fi

echo "🔄 Fetching latest changes..."
git fetch origin

echo "🌿 Checking out $branch branch..."
if git show-ref --verify --quiet refs/heads/$branch; then
    git checkout $branch
else
    git checkout -b $branch origin/$branch
fi

echo "⬇️  Pulling latest changes..."
git pull origin $branch

echo ""
echo "========================================="
echo "✅ Code updated successfully!"
echo "Current branch: `$(git branch --show-current)"
echo "Current commit: `$(git rev-parse --short HEAD)"
echo "========================================="
echo ""

if [ -f "docker-compose.yml" ]; then
    echo "🐳 Rebuilding and restarting containers..."
    docker compose up -d --build
    echo ""
    echo "✅ Deployment complete! Containers restarted."
    echo ""
    docker compose ps
else
    echo "⚠️  Warning: docker-compose.yml not found."
fi
"@

# Save to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$scriptContent | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline

Write-Host "Executing deployment..." -ForegroundColor Yellow
Write-Host ""

# Try to use plink if available
$plink = Get-Command plink -ErrorAction SilentlyContinue
if ($plink) {
    Write-Host "Using plink for SSH connection..." -ForegroundColor Green
    Get-Content $tempFile | & $plink.Path -ssh $server -pw $password
    $exitCode = $LASTEXITCODE
} else {
    # Try using ssh with expect-like functionality via WSL
    Write-Host "Attempting via WSL/expect..." -ForegroundColor Yellow
    
    # Create expect script
    $expectScript = @"
#!/usr/bin/expect -f
set timeout 600
spawn ssh -o StrictHostKeyChecking=no $server "bash -s" < $tempFile
expect {
    "password:" { send "$password\r"; exp_continue }
    "Password:" { send "$password\r"; exp_continue }
    eof { }
}
catch wait
"@
    
    $expectFile = [System.IO.Path]::GetTempFileName()
    $expectScript | Out-File -FilePath $expectFile -Encoding ASCII
    
    # Try WSL
    try {
        $wslResult = wsl bash -c "which expect"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Using WSL with expect..." -ForegroundColor Green
            wsl bash -c "chmod +x $expectFile && $expectFile"
            $exitCode = $LASTEXITCODE
        } else {
            throw "expect not found"
        }
    } catch {
        Write-Host "WSL/expect not available. Manual deployment required." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please run manually:" -ForegroundColor Yellow
        Write-Host "ssh $server" -ForegroundColor Green
        Write-Host "Password: $password" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Then execute:" -ForegroundColor Yellow
        Write-Host (Get-Content $tempFile) -ForegroundColor Cyan
        $exitCode = 1
    }
    
    Remove-Item $expectFile -ErrorAction SilentlyContinue
}

Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "❌ Deployment failed or requires manual intervention" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    exit 1
}

