#!/usr/bin/env bash
set -euo pipefail

# Настройки
APP_DIR="/opt/newava"
REPO_URL="https://github.com/luckyit-test/AI-Avatar.git"
BRANCH="main"

cd "$APP_DIR"

# Обновляем репозиторий
echo "[i] Обновляю репозиторий..."
if [ ! -d .git ]; then
    git clone "$REPO_URL" .
else
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
fi

# Каталоги для certbot
mkdir -p deploy/certbot/www deploy/certbot/conf

# Определяем команду docker compose
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Перезапуск контейнеров
echo "[i] Пересборка и запуск контейнеров..."
$DOCKER_COMPOSE down
$DOCKER_COMPOSE build --no-cache
$DOCKER_COMPOSE up -d

echo "[✓] Готово! Приложение обновлено."
