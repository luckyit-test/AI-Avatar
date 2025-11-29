# Direct deployment script using SSH key or password
$ErrorActionPreference = "Stop"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$appDir = "/opt/newava"
$branch = "avatar"
$sshKey = "$env:USERPROFILE\.ssh\avatar_deploy"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying avatar branch to production" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Deployment commands
$deployScript = @"
set -e
cd $appDir

# Initialize git if needed
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git 2>/dev/null || git remote set-url origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Update from avatar branch
echo "Fetching latest changes from avatar branch..."
git fetch origin

# Checkout avatar branch
echo "Checking out avatar branch..."
if git show-ref --verify --quiet refs/heads/$branch; then
    git checkout $branch
else
    git checkout -b $branch origin/$branch
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin $branch

echo ""
echo "========================================="
echo "Code updated successfully!"
echo "Current branch: `$(git branch --show-current)"
echo "Current commit: `$(git rev-parse --short HEAD)"
echo "========================================="
echo ""

# Rebuild containers if docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
    echo "Rebuilding and restarting containers..."
    docker compose up -d --build
    echo ""
    echo "Deployment complete! Containers restarted."
    docker compose ps
else
    echo "Warning: docker-compose.yml not found. Code updated but containers not restarted."
fi
"@

# Save script to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$deployScript | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline

Write-Host "Attempting deployment..." -ForegroundColor Yellow

# Try with SSH key first
if (Test-Path $sshKey) {
    Write-Host "Trying SSH key authentication..." -ForegroundColor Yellow
    try {
        $result = & ssh -i $sshKey -o StrictHostKeyChecking=no -o ConnectTimeout=10 $server "bash -s" < $tempFile 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host $result
            Write-Host "`n✅ Deployment successful using SSH key!" -ForegroundColor Green
            Remove-Item $tempFile -Force
            exit 0
        }
    } catch {
        Write-Host "SSH key authentication failed, trying password..." -ForegroundColor Yellow
    }
}

# Try with password using plink if available
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue
if ($plinkPath) {
    Write-Host "Using plink with password..." -ForegroundColor Yellow
    $deployScript | & $plinkPath.Path -ssh $server -pw $password
    Remove-Item $tempFile -Force
    exit 0
}

# If all else fails, try to add SSH key first
Write-Host "Adding SSH key to server for future deployments..." -ForegroundColor Yellow
$addKeyScript = @"
mkdir -p ~/.ssh && 
echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+hDm6qoU9CL0C2nJ0Kjo5yRT0G2agibbwG5bjKUcmqip/n27agnQfQFl16+JVCFqV+iJcEwZzAVsBH1OYjGkmOkXl+0UIl0b2CnQTWUd6xioRyV3bIOHKelh042w08x3SYqNFJvMk12pOsxr1Vfb2jk+dyGlw37uvdWI0UnqXv127vzBPjzsdGKz3vzUF9d5D1tHsSuFbZtLlSPKnzYUefH5aPD5FikS347T/KRPtyHbT3UddFnF2dCfHzm/dwSgciefZEwLcxJoIVATknPju5aTmBNGCn/kYpOOI7b0WOSrKmVZuyIXxfmn7iy8/gP4kmxYzIzeghOPtatsyrqK5AkDCggNCH9pwDzvJMZx4+qKdPxN4eDS7e0Hs28M1avumM8tSNg/3K4W9dnBAIKFleh29mPqzZ8XUIh7TrB0CaISgeX2b6FqQuF4ErphvmdmFRbmNc8LfimWfQWoifiZpfOwSoOviPt2EEzzazwnummhmXFSwxgo81yvPeAonW9EBVu4CtHK1PJZpUdbk281bF9JqshEx23bc6bR/J86s/iXbjutcU4ymKpg4bqbi+7o0G4D1+IKYegB7SMk16iXFqWqs6Nl8t/RKxaAOPK5xJYInfc4P9g6i+FGTwtuJNHFhH+1hJUZtpaq8sNF6TZeou4XBiZyNSXuHud2EDD/pGQ== user@DESKTOP-O7AH1P2' >> ~/.ssh/authorized_keys && 
chmod 600 ~/.ssh/authorized_keys && 
chmod 700 ~/.ssh
"@

# For now, provide manual instructions
Write-Host "`n=========================================" -ForegroundColor Yellow
Write-Host "MANUAL DEPLOYMENT REQUIRED" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "`nRun these commands:" -ForegroundColor Yellow
Write-Host "ssh $server" -ForegroundColor Green
Write-Host "Password: $password" -ForegroundColor Yellow
Write-Host "`nThen paste:" -ForegroundColor Yellow
Write-Host $deployScript -ForegroundColor Cyan
Write-Host "`nScript saved to: $tempFile" -ForegroundColor Gray

