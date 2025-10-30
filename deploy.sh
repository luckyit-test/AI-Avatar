#!/bin/bash

# Скрипт развертывания AI-Avatar на сервер
# Использование: ./deploy.sh [GEMINI_API_KEY] [DOMAIN]

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Параметры
SERVER_HOST="94.198.221.161"
SERVER_USER="root"
SERVER_PASS="oJ@MQ+vvmo,G2G"
APP_DIR="/opt/newava"
GEMINI_API_KEY="${1}"
DOMAIN="${2}"

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}❌ Ошибка: не указан GEMINI_API_KEY${NC}"
    echo "Использование: $0 <GEMINI_API_KEY> [DOMAIN]"
    exit 1
fi

echo -e "${YELLOW}🚀 Начинаем развертывание на сервер ${SERVER_HOST}...${NC}\n"

# Функция для выполнения команд на сервере через SSH с паролем
ssh_exec() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "$@"
}

# Функция для копирования файлов на сервер
scp_exec() {
    sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -r "$@"
}

# Проверка наличия sshpass
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}📦 Устанавливаем sshpass...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew &> /dev/null; then
            echo -e "${RED}❌ Требуется Homebrew для установки sshpass на macOS${NC}"
            echo "Установите: brew install hudochenkov/sshpass/sshpass"
            exit 1
        fi
        brew install hudochenkov/sshpass/sshpass || true
    else
        sudo apt-get update && sudo apt-get install -y sshpass || true
    fi
fi

echo -e "${GREEN}🔍 Проверяем окружение на сервере...${NC}"
ssh_exec "docker --version && docker-compose --version && git --version" || {
    echo -e "${YELLOW}⚠️  Устанавливаем Docker и Docker Compose...${NC}"
    ssh_exec "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh"
    ssh_exec "docker --version"
}

echo -e "${GREEN}📁 Клонируем/обновляем репозиторий на сервере...${NC}"
GIT_REPO="https://github.com/luckyit-test/AI-Avatar.git"
ssh_exec "if [ -d ${APP_DIR}/.git ]; then
    cd ${APP_DIR} && git pull origin main
else
    mkdir -p ${APP_DIR} && cd ${APP_DIR} && git clone ${GIT_REPO} .
fi"

echo -e "${GREEN}📁 Создаем необходимые директории...${NC}"
ssh_exec "mkdir -p ${APP_DIR}/deploy/certbot/www && mkdir -p ${APP_DIR}/deploy/certbot/conf"

echo -e "${GREEN}⚙️  Создаем .env файл на сервере...${NC}"
ssh_exec "cat > ${APP_DIR}/.env << EOF
GEMINI_API_KEY=${GEMINI_API_KEY}
EOF"

echo -e "${GREEN}🐳 Запускаем Docker Compose...${NC}"
ssh_exec "cd ${APP_DIR} && docker-compose down || true"
ssh_exec "cd ${APP_DIR} && docker-compose build --no-cache"
ssh_exec "cd ${APP_DIR} && docker-compose up -d"

echo -e "${GREEN}⏳ Ожидаем запуска контейнеров...${NC}"
sleep 5

if [ -n "$DOMAIN" ]; then
    echo -e "${GREEN}🔒 Настраиваем SSL сертификат для домена ${DOMAIN}...${NC}"
    ssh_exec "cd ${APP_DIR} && docker-compose run --rm certbot certonly --webroot -w /var/www/certbot --email admin@${DOMAIN} -d ${DOMAIN} --agree-tos --non-interactive || echo 'Сертификат уже существует или ошибка получения'"
    
    # Обновляем конфигурацию nginx с доменом
    ssh_exec "sed -i 's/server_name _;/server_name ${DOMAIN};/g' ${APP_DIR}/deploy/nginx/conf.d/app.conf"
    ssh_exec "cd ${APP_DIR} && docker-compose restart nginx"
fi

echo -e "${GREEN}✅ Развертывание завершено!${NC}"
echo -e "${GREEN}🌐 Приложение доступно по адресу: http://${SERVER_HOST}${NC}"
if [ -n "$DOMAIN" ]; then
    echo -e "${GREEN}🌐 Или по домену: https://${DOMAIN}${NC}"
fi

echo -e "\n${YELLOW}📊 Статус контейнеров:${NC}"
ssh_exec "cd ${APP_DIR} && docker-compose ps"

