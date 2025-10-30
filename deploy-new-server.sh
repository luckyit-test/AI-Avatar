#!/usr/bin/expect -f

set timeout 600
set SERVER_HOST "43.245.226.24"
set SERVER_USER "root"
set SERVER_PASS "Yd2Vc_Wejus0DlNB"
set APP_DIR "/opt/newava"
set GIT_REPO "https://github.com/luckyit-test/AI-Avatar.git"
set GEMINI_API_KEY "AIzaSyDwsRIAaS0E6qcNfkOjY6rr1mcOSiG1coI"

set app_dir "${APP_DIR}"
set git_repo "${GIT_REPO}"
set api_key "${GEMINI_API_KEY}"

puts "\n🚀 Развертывание на новом сервере ${SERVER_HOST}...\n"

# Проверка и установка Docker
puts "🔍 Проверяем Docker..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "command -v docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh)"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Клонирование репозитория
puts "📁 Клонируем репозиторий..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "if \[ -d $app_dir/.git \]; then cd $app_dir && git fetch origin && git reset --hard origin/main; else mkdir -p $app_dir && cd $app_dir && git clone $git_repo .; fi"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Создание директорий
puts "📁 Создаем директории..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "mkdir -p $app_dir/deploy/certbot/www $app_dir/deploy/certbot/conf"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Создание .env файла
puts "⚙️  Создаем .env файл..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "echo 'GEMINI_API_KEY=$api_key' > $app_dir/.env"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Настройка Nginx конфигурации для доступа по IP (без SSL)
puts "📝 Настраиваем Nginx для доступа по IP..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cat > $app_dir/deploy/nginx/conf.d/app.conf << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://app:80;
    }
}
NGINX_CONF
"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Остановка старых контейнеров
puts "🐳 Останавливаем старые контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Сборка образов
puts "🔨 Собираем Docker образы (это может занять несколько минут)..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose build --no-cache 2>/dev/null || docker-compose build --no-cache"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Запуск контейнеров
puts "🚀 Запускаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose up -d 2>/dev/null || docker-compose up -d"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 5

puts "\n📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose ps 2>/dev/null || docker-compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🌐 Проверяем доступность:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -I http://localhost/interaction 2>&1 | head -5"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Развертывание завершено!"
puts "🌐 Приложение доступно по адресу: http://${SERVER_HOST}"
puts "\n📊 Проверка версии кода:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git log -1 --oneline"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"

