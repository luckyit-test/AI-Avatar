# Быстрый деплой ветки new-year на домен hnyear.com
# Использует общий nginx контейнер из проекта newava

$ErrorActionPreference = "Stop"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$appDir = "/opt/hnyear"
$newavaDir = "/opt/newava"
$branch = "new-year"
$domain = "hnyear.com"
$email = "admin@hnyear.com"  # Замените на ваш email

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying new-year branch to hnyear.com" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$deployScript = @"
set -e

echo "Creating app directory: $appDir"
mkdir -p $appDir
cd $appDir

# Initialize git if needed
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Fetch and checkout new-year branch
echo "Fetching and checking out new-year branch..."
git fetch origin
git checkout $branch 2>/dev/null || git checkout -b $branch origin/$branch
git pull origin $branch

echo ""
echo "Code updated!"
echo "Current branch: `$(git branch --show-current)"
echo "Current commit: `$(git rev-parse --short HEAD)"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'ENVEOF'
GEMINI_API_KEY=your_key_here
GEMINI_API_KEY_ANALYSIS=your_key_here
ALLOWED_ORIGINS=https://hnyear.com,https://www.hnyear.com
ROBOKASSA_LOGIN=hnyear.com
ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax
ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E
ROBOKASSA_IS_TEST=0
ROBOKASSA_PAYMENT_AMOUNT=100.00
ENVEOF
    echo ".env file created. Please update GEMINI_API_KEY!"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p deploy/certbot/www deploy/certbot/conf
mkdir -p data

# Use docker-compose.hnyear.yml if it exists
if [ -f docker-compose.hnyear.yml ]; then
    echo "Using docker-compose.hnyear.yml"
    cp docker-compose.hnyear.yml docker-compose.yml
else
    echo "Updating docker-compose.yml..."
    # Backup
    cp docker-compose.yml docker-compose.yml.bak 2>/dev/null || true
    
    # Update container names
    sed -i 's/newava_backend/hnyear_backend/g' docker-compose.yml
    sed -i 's/newava_app/hnyear_app/g' docker-compose.yml
    sed -i 's/newava_nginx/hnyear_nginx/g' docker-compose.yml
    sed -i 's/newava_certbot/hnyear_certbot/g' docker-compose.yml
    sed -i 's/newava_network/hnyear_network/g' docker-compose.yml
    sed -i 's/newava-backend/hnyear-backend/g' docker-compose.yml
    sed -i 's/newava:latest/hnyear:latest/g' docker-compose.yml
fi

# Ensure newava_network exists
echo "Ensuring network exists..."
cd $newavaDir
docker compose up -d 2>/dev/null || true
docker network create newava_network 2>/dev/null || true

# Copy nginx config to newava project
echo "Copying nginx configuration..."
cd $appDir
if [ -f deploy/nginx/conf.d/hnyear.conf ]; then
    cp deploy/nginx/conf.d/hnyear.conf $newavaDir/deploy/nginx/conf.d/hnyear.conf
    echo "Nginx config copied to newava project"
fi

# Build and start containers (without nginx)
echo ""
echo "Building and starting containers..."
cd $appDir
docker compose up -d --build app backend

# Wait for containers
echo "Waiting for containers to start..."
sleep 5

# Issue SSL certificate (using newava nginx)
echo ""
echo "Issuing SSL certificate..."
cd $newavaDir
docker run --rm \
  -v $newavaDir/deploy/certbot/conf:/etc/letsencrypt \
  -v $newavaDir/deploy/certbot/www:/var/www/certbot \
  certbot/certbot:latest certonly --webroot \
  -w /var/www/certbot -d $domain -d www.$domain \
  -m $email --agree-tos --no-eff-email --non-interactive || echo "Certificate issue failed, will retry later"

# Reload nginx
echo ""
echo "Reloading nginx..."
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload || echo "Nginx reload failed"

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo ""
echo "Check status:"
cd $appDir
docker compose ps
echo ""
echo "Check logs:"
echo "  cd $appDir && docker compose logs"
echo ""
echo "IMPORTANT: Update GEMINI_API_KEY in .env file!"
echo "  nano $appDir/.env"
"@

$tempScript = [System.IO.Path]::GetTempFileName() + ".sh"
$deployScript | Out-File -FilePath $tempScript -Encoding ASCII -NoNewline

Write-Host "SSH script created: $tempScript" -ForegroundColor Green
Write-Host ""
Write-Host "To deploy, run one of the following:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Manual SSH (recommended)" -ForegroundColor Cyan
Write-Host "  ssh $server" -ForegroundColor Green
Write-Host "  (Password: $password)" -ForegroundColor Gray
Write-Host "  Then paste the commands from: $tempScript" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Using plink (if installed)" -ForegroundColor Cyan
Write-Host "  plink -ssh $server -pw $password -m $tempScript" -ForegroundColor Green
Write-Host ""

# Try to use plink if available
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue
if ($plinkPath) {
    Write-Host "Found plink.exe, attempting automatic deployment..." -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Do you want to deploy now? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        & $plinkPath.Path -ssh $server -pw $password -m $tempScript
    }
} else {
    Write-Host "Plink not found. Please use manual SSH method (Option 1)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or install plink from:" -ForegroundColor Yellow
    Write-Host "  https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html" -ForegroundColor Cyan
}

