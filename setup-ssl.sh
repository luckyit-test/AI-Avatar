#!/usr/bin/env bash
set -euo pipefail

# Скрипт для получения SSL сертификата Let's Encrypt

DOMAIN="newava.pro"
EMAIL="your-email@example.com"  # Замените на ваш email

# Каталоги для certbot
mkdir -p deploy/certbot/www deploy/certbot/conf

# Получаем сертификат
docker run --rm \
    -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/deploy/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo "[✓] SSL сертификат получен для $DOMAIN"
echo "[i] Теперь запустите: docker compose up -d"

