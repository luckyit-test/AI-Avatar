@echo off
REM Простой деплой через SSH команды
REM Требует ручного ввода пароля

setlocal

set SERVER=root@43.245.226.24

echo =========================================
echo Deploying new-year branch to hnyear.com
echo =========================================
echo.
echo This script will connect to the server and deploy.
echo You will be prompted for the SSH password: Yd2Vc_Wejus0DlNB
echo.
pause

echo.
echo Connecting to server...
echo.

REM Выполняем команды деплоя через SSH
ssh %SERVER% "bash -s" << "DEPLOY_SCRIPT"
set -e

APP_DIR="/opt/hnyear"
NEWAVA_DIR="/opt/newava"
BRANCH="new-year"
DOMAIN="hnyear.com"
EMAIL="admin@hnyear.com"

echo "Creating app directory: $APP_DIR"
mkdir -p $APP_DIR
cd $APP_DIR

# Initialize git if needed
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Fetch and checkout new-year branch
echo "Fetching and checking out new-year branch..."
git fetch origin
git checkout $BRANCH 2>/dev/null || git checkout -b $BRANCH origin/$BRANCH
git pull origin $BRANCH

echo ""
echo "Code updated!"
echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse --short HEAD)"
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
    cp docker-compose.yml docker-compose.yml.bak 2>/dev/null || true
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
cd $NEWAVA_DIR
docker compose up -d 2>/dev/null || true
docker network create newava_network 2>/dev/null || true

# Copy nginx config to newava project
echo "Copying nginx configuration..."
cd $APP_DIR
if [ -f deploy/nginx/conf.d/hnyear.conf ]; then
    cp deploy/nginx/conf.d/hnyear.conf $NEWAVA_DIR/deploy/nginx/conf.d/hnyear.conf
    echo "Nginx config copied to newava project"
fi

# Build and start containers
echo ""
echo "Building and starting containers..."
cd $APP_DIR
docker compose up -d --build app backend

# Wait for containers
echo "Waiting for containers to start..."
sleep 5

# Issue SSL certificate
echo ""
echo "Issuing SSL certificate..."
cd $NEWAVA_DIR
docker run --rm \
  -v $NEWAVA_DIR/deploy/certbot/conf:/etc/letsencrypt \
  -v $NEWAVA_DIR/deploy/certbot/www:/var/www/certbot \
  certbot/certbot:latest certonly --webroot \
  -w /var/www/certbot -d $DOMAIN -d www.$DOMAIN \
  -m $EMAIL --agree-tos --no-eff-email --non-interactive || echo "Certificate issue failed, will retry later"

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
cd $APP_DIR
docker compose ps
echo ""
echo "IMPORTANT: Update GEMINI_API_KEY in .env file!"
echo "  nano $APP_DIR/.env"
DEPLOY_SCRIPT

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================
    echo Deployment completed successfully!
    echo =========================================
    echo.
    echo Check https://hnyear.com
) else (
    echo.
    echo =========================================
    echo Deployment failed!
    echo =========================================
    echo.
    echo Please check the error messages above.
)

pause
endlocal

