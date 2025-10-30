#!/usr/bin/env bash
set -euo pipefail

# Настройки
APP_DIR="/opt/newava"
REPO_URL="https://github.com/luckyit-test/AI-Avatar.git"  # где лежит проект на VPS
BRANCH="main"

# Опционально: если нужно обновить ключ прямо из скрипта
# GEMINI_API_KEY="PASTE_KEY"
# оставь пустым чтобы .env не трогать

cd "$APP_DIR"

# Если репо ещё не клонировано — клонируем, иначе обновляем
if [ ! -d .git ]; then
    echo "[i] Клонирую репозиторий..."
    git clone "$REPO_URL" .
else
    echo "[i] Обновляю репозиторий..."
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
fi

# Обновим .env при необходимости
if [ -n "${GEMINI_API_KEY:-}" ]; then
    echo "[i] Обновляю .env"
    printf "GEMINI_API_KEY=%s\n" "$GEMINI_API_KEY" > .env
fi

# Каталоги для certbot (на всякий случай)
mkdir -p deploy/certbot/www deploy/certbot/conf

# Определяем команду docker compose (V2) или docker-compose (V1)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "[✗] Ошибка: не найдена команда docker compose или docker-compose"
    exit 1
fi

# Перезапуск (app + nginx)
echo "[i] Пересборка и запуск контейнеров..."
$DOCKER_COMPOSE down
$DOCKER_COMPOSE build --no-cache
$DOCKER_COMPOSE up -d

echo "[✓] Готово! Приложение обновлено и перезапущено."

