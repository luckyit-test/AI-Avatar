#!/usr/bin/expect -f

set timeout 600
set GEMINI_API_KEY [lindex $argv 0]
set DOMAIN [lindex $argv 1]
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"
set GIT_REPO "https://github.com/luckyit-test/AI-Avatar.git"

if {$GEMINI_API_KEY == ""} {
    puts "❌ Ошибка: не указан GEMINI_API_KEY"
    puts "Использование: $argv0 <GEMINI_API_KEY> [DOMAIN]"
    exit 1
}

puts "\n🚀 Начинаем развертывание AI-Avatar на ${SERVER_HOST}...\n"

# Установка Docker если нужно
puts "🔍 Проверяем Docker..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "command -v docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh)"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Клонирование репозитория
puts "📁 Клонируем/обновляем репозиторий..."
set app_dir "${APP_DIR}"
set git_repo "${GIT_REPO}"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "if \[ -d $app_dir/.git \]; then cd $app_dir && git pull origin main; else mkdir -p $app_dir && cd $app_dir && git clone $git_repo .; fi"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Создание директорий
puts "📁 Создаем директории..."
set deploy_dir "${APP_DIR}/deploy/certbot/www"
set conf_dir "${APP_DIR}/deploy/certbot/conf"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "mkdir -p $deploy_dir $conf_dir"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Создание .env
puts "⚙️  Создаем .env файл..."
set env_file "${APP_DIR}/.env"
set api_key "${GEMINI_API_KEY}"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "echo 'GEMINI_API_KEY=$api_key' > $env_file"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Остановка старых контейнеров
puts "🐳 Останавливаем старые контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose down || true"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Сборка образов
puts "🔨 Собираем Docker образы (это может занять несколько минут)..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose build --no-cache"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Запуск контейнеров
puts "🚀 Запускаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose up -d"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 5

# SSL если указан домен
if {$DOMAIN != ""} {
    puts "🔒 Настраиваем SSL для домена ${DOMAIN}..."
    set domain "${DOMAIN}"
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose run --rm certbot certonly --webroot -w /var/www/certbot --email admin@$domain -d $domain --agree-tos --non-interactive || echo 'Сертификат уже существует'"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "sed -i 's/server_name _;/server_name $domain;/g' $app_dir/deploy/nginx/conf.d/app.conf && cd $app_dir && docker-compose restart nginx"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
}

puts "\n✅ Развертывание завершено!"
puts "🌐 Приложение доступно: http://${SERVER_HOST}"
if {$DOMAIN != ""} {
    puts "🌐 Или по домену: https://${DOMAIN}"
}

puts "\n📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"

