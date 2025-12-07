# PowerShell deployment script for new-year branch to hnyear.com
# This script deploys the new-year branch to the production server

$ErrorActionPreference = "Stop"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"
$repoUrl = "https://github.com/luckyit-test/AI-Avatar.git"
$branch = "new-year"
$appDir = "/opt/hnyear"
$domain = "hnyear.com"
$email = "admin@hnyear.com"  # Замените на ваш email для SSL

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploying new-year branch to hnyear.com" -ForegroundColor Cyan
Write-Host "Server: $server" -ForegroundColor Cyan
Write-Host "Domain: $domain" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Create SSH commands script
$sshScript = @"
set -e

echo "========================================="
echo "Setting up hnyear.com deployment"
echo "========================================="
echo ""

# Create app directory
echo "Creating app directory: $appDir"
sudo mkdir -p "$appDir"
cd "$appDir"

# Initialize git repo if needed
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin $repoUrl || git remote set-url origin $repoUrl
fi

# Fetch and checkout new-year branch
echo "Fetching and checking out new-year branch..."
git fetch origin
git checkout $branch 2>/dev/null || git checkout -b $branch origin/$branch
git pull origin $branch

echo ""
echo "Code updated successfully!"
echo "Current branch: `$(git branch --show-current)"
echo "Current commit: `$(git rev-parse --short HEAD)"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "GEMINI_API_KEY=your_key_here" | sudo tee .env >/dev/null
    echo "ALLOWED_ORIGINS=https://$domain" | sudo tee -a .env >/dev/null
    echo "ROBOKASSA_LOGIN=$domain" | sudo tee -a .env >/dev/null
    echo "ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax" | sudo tee -a .env >/dev/null
    echo "ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E" | sudo tee -a .env >/dev/null
    echo "ROBOKASSA_IS_TEST=0" | sudo tee -a .env >/dev/null
    echo "ROBOKASSA_PAYMENT_AMOUNT=100.00" | sudo tee -a .env >/dev/null
    echo ".env file created. Please update GEMINI_API_KEY!"
fi

# Create necessary directories
echo "Creating necessary directories..."
sudo mkdir -p deploy/certbot/www deploy/certbot/conf
sudo mkdir -p deploy/nginx/conf.d
sudo mkdir -p data

# Create nginx configuration for hnyear.com
echo "Creating nginx configuration..."
sudo tee deploy/nginx/conf.d/app.conf >/dev/null <<'NGINX_CONFIG'
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name hnyear.com www.hnyear.com;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://`$host`$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name hnyear.com www.hnyear.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/hnyear.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hnyear.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend
    location / {
        proxy_pass http://hnyear_app:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_cache_bypass `$http_upgrade;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://hnyear_backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
NGINX_CONFIG

# Update docker-compose.yml to use unique container names
echo "Updating docker-compose.yml with unique container names..."
if [ -f docker-compose.yml ]; then
    # Backup original
    cp docker-compose.yml docker-compose.yml.bak
    
    # Update container names and network names
    sed -i 's/newava_backend/hnyear_backend/g' docker-compose.yml
    sed -i 's/newava_app/hnyear_app/g' docker-compose.yml
    sed -i 's/newava_nginx/hnyear_nginx/g' docker-compose.yml
    sed -i 's/newava_certbot/hnyear_certbot/g' docker-compose.yml
    sed -i 's/newava_network/hnyear_network/g' docker-compose.yml
    sed -i 's/newava-backend/hnyear-backend/g' docker-compose.yml
    sed -i 's/newava:latest/hnyear:latest/g' docker-compose.yml
    
    echo "docker-compose.yml updated"
fi

# Start containers (HTTP only first for SSL certificate)
echo ""
echo "Starting containers (HTTP only for SSL certificate)..."
sudo docker compose down || true
sudo docker compose up -d --build app backend nginx

echo ""
echo "Waiting for containers to start..."
sleep 10

# Issue SSL certificate
echo ""
echo "Issuing SSL certificate for $domain..."
sudo docker run --rm \
  -v "$appDir/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$appDir/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot:latest certonly --webroot \
  -w /var/www/certbot -d $domain -d www.$domain \
  -m $email --agree-tos --no-eff-email --non-interactive || echo "Certificate issue failed, will retry later"

# Reload nginx with SSL configuration
echo ""
echo "Reloading nginx..."
sudo docker compose exec -T nginx nginx -t && sudo docker compose exec -T nginx nginx -s reload || echo "Nginx reload failed"

# Start certbot container for auto-renewal
echo ""
echo "Starting certbot container for auto-renewal..."
sudo docker compose up -d certbot

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo ""
echo "Check status:"
sudo docker compose ps
echo ""
echo "Check logs:"
echo "  Frontend: sudo docker compose logs app"
echo "  Backend: sudo docker compose logs backend"
echo "  Nginx: sudo docker compose logs nginx"
echo ""
echo "IMPORTANT: Update GEMINI_API_KEY in .env file!"
echo "  sudo nano $appDir/.env"
"@

# Save script to temp file
$tempScript = [System.IO.Path]::GetTempFileName() + ".sh"
$sshScript | Out-File -FilePath $tempScript -Encoding ASCII -NoNewline

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
Write-Host "Option 3: Copy script to server and run" -ForegroundColor Cyan
Write-Host "  scp $tempScript $server`:/tmp/deploy.sh" -ForegroundColor Green
Write-Host "  ssh $server 'bash /tmp/deploy.sh'" -ForegroundColor Green
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
}

