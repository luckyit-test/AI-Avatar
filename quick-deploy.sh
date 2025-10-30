#!/bin/bash
# Быстрое развертывание - требует ввода пароля вручную или настроенный SSH ключ

set -e

SERVER_HOST="94.198.221.161"
SERVER_USER="root"
APP_DIR="/opt/newava"
GIT_REPO="https://github.com/luckyit-test/AI-Avatar.git"

echo "🔍 Подключение к серверу..."
echo "📝 Введите пароль когда будет запрошено: oJ@MQ+vvmo,G2G"
echo ""

# Клонируем/обновляем репозиторий
echo "📁 Клонируем/обновляем репозиторий..."
ssh ${SERVER_USER}@${SERVER_HOST} "
if [ -d ${APP_DIR}/.git ]; then
    cd ${APP_DIR} && git pull origin main
else
    mkdir -p ${APP_DIR} && cd ${APP_DIR} && git clone ${GIT_REPO} .
fi
"

# Создаем директории
echo "📁 Создаем директории..."
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${APP_DIR}/deploy/certbot/www && mkdir -p ${APP_DIR}/deploy/certbot/conf"

# Запрашиваем GEMINI_API_KEY
echo ""
read -p "🔑 Введите GEMINI_API_KEY: " GEMINI_API_KEY

# Создаем .env
echo "⚙️  Создаем .env файл..."
ssh ${SERVER_USER}@${SERVER_HOST} "echo 'GEMINI_API_KEY=${GEMINI_API_KEY}' > ${APP_DIR}/.env"

# Запрашиваем домен (опционально)
echo ""
read -p "🌐 Введите домен (или Enter чтобы пропустить): " DOMAIN

# Собираем и запускаем
echo "🐳 Останавливаем старые контейнеры..."
ssh ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose down || true"

echo "🔨 Собираем образы..."
ssh ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose build --no-cache"

echo "🚀 Запускаем контейнеры..."
ssh ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose up -d"

sleep 5

if [ -n "$DOMAIN" ]; then
    echo "🔒 Настраиваем SSL для ${DOMAIN}..."
    ssh ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose run --rm certbot certonly --webroot -w /var/www/certbot --email admin@${DOMAIN} -d ${DOMAIN} --agree-tos --non-interactive || echo 'Сертификат уже существует'"
    ssh ${SERVER_USER}@${SERVER_HOST} "sed -i 's/server_name _;/server_name ${DOMAIN};/g' ${APP_DIR}/deploy/nginx/conf.d/app.conf && cd ${APP_DIR} && docker-compose restart nginx"
fi

echo ""
echo "✅ Развертывание завершено!"
echo "🌐 Приложение: http://${SERVER_HOST}"
[ -n "$DOMAIN" ] && echo "🌐 Домен: https://${DOMAIN}"

echo ""
echo "📊 Статус контейнеров:"
ssh ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose ps"

