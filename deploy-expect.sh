#!/usr/bin/expect -f

# Скрипт развертывания через expect (не требует sshpass)
# Использование: ./deploy-expect.sh [GEMINI_API_KEY] [DOMAIN]

set timeout 300
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

puts "🚀 Начинаем развертывание на сервер ${SERVER_HOST}...\n"

# Функция для выполнения команд через SSH
proc ssh_exec {command} {
    global SERVER_HOST SERVER_USER SERVER_PASS
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} $command
    expect {
        "password:" {
            send "${SERVER_PASS}\r"
            exp_continue
        }
        "Password:" {
            send "${SERVER_PASS}\r"
            exp_continue
        }
        "$ " { }
        "# " { }
        eof { }
    }
    expect eof
    catch wait result
    return [lindex $result 3]
}

puts "🔍 Проверяем окружение на сервере..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "docker --version && docker-compose --version && git --version"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Установка Docker если нужно
puts "📦 Проверяем Docker..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "command -v docker || curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "📁 Клонируем/обновляем репозиторий..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "if [ -d ${APP_DIR}/.git ]; then cd ${APP_DIR} && git pull origin main; else mkdir -p ${APP_DIR} && cd ${APP_DIR} && git clone ${GIT_REPO} .; fi"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "📁 Создаем необходимые директории..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${APP_DIR}/deploy/certbot/www && mkdir -p ${APP_DIR}/deploy/certbot/conf"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "⚙️  Создаем .env файл..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "echo 'GEMINI_API_KEY=${GEMINI_API_KEY}' > ${APP_DIR}/.env"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🐳 Останавливаем старые контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose down || true"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🔨 Собираем Docker образы..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose build --no-cache"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🚀 Запускаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose up -d"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "⏳ Ожидаем запуска контейнеров..."
sleep 5

if {$DOMAIN != ""} {
    puts "🔒 Настраиваем SSL сертификат для домена ${DOMAIN}..."
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose run --rm certbot certonly --webroot -w /var/www/certbot --email admin@${DOMAIN} -d ${DOMAIN} --agree-tos --non-interactive || echo 'Сертификат уже существует'"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "sed -i 's/server_name _;/server_name ${DOMAIN};/g' ${APP_DIR}/deploy/nginx/conf.d/app.conf && cd ${APP_DIR} && docker-compose restart nginx"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
}

puts "\n✅ Развертывание завершено!"
puts "🌐 Приложение доступно по адресу: http://${SERVER_HOST}"
if {$DOMAIN != ""} {
    puts "🌐 Или по домену: https://${DOMAIN}"
}

puts "\n📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd ${APP_DIR} && docker-compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"

