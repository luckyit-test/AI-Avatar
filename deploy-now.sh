#!/usr/bin/expect -f

set timeout 600
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"
set GIT_REPO "https://github.com/luckyit-test/AI-Avatar.git"

puts "\n🚀 Начинаем развертывание AI-Avatar на ${SERVER_HOST}...\n"

# Проверка Docker
puts "🔍 Проверяем Docker..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "docker --version 2>/dev/null || echo 'NOT_INSTALLED'"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Установка Docker если нужно
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "command -v docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh)"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Проверка Docker Compose
puts "🔍 Проверяем Docker Compose..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "docker-compose --version 2>/dev/null || docker compose version 2>/dev/null || echo 'NOT_INSTALLED'"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Клонирование репозитория
puts "📁 Клонируем репозиторий..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "if \[ -d ${APP_DIR}/.git \]; then cd ${APP_DIR} && git pull origin main; else mkdir -p ${APP_DIR} && cd ${APP_DIR} && git clone ${GIT_REPO} .; fi"
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

puts "\n✅ Базовое развертывание завершено!"
puts "📝 Теперь нужно:"
puts "   1. Создать .env файл с GEMINI_API_KEY"
puts "   2. Запустить docker-compose build && docker-compose up -d"
puts "\nВыполнить оставшиеся шаги? (y/n): "
expect_user -re "(.*)\n"
set answer $expect_out(1,string)

if {[string tolower $answer] == "y"} {
    puts "\n🔑 Введите GEMINI_API_KEY: "
    expect_user -re "(.*)\n"
    set GEMINI_API_KEY $expect_out(1,string)
    
    puts "⚙️  Создаем .env файл..."
    set env_file "${APP_DIR}/.env"
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "echo 'GEMINI_API_KEY=$GEMINI_API_KEY' > $env_file"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    puts "🐳 Останавливаем старые контейнеры..."
    set app_dir "${APP_DIR}"
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose down || true"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    puts "🔨 Собираем Docker образы (это может занять несколько минут)..."
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose build --no-cache"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    puts "🚀 Запускаем контейнеры..."
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose up -d"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
    
    puts "\n✅ Развертывание завершено!"
    puts "🌐 Приложение доступно: http://${SERVER_HOST}"
    
    puts "\n📊 Статус контейнеров:"
    spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker-compose ps"
    expect {
        "password:" { send "${SERVER_PASS}\r"; exp_continue }
        "Password:" { send "${SERVER_PASS}\r"; exp_continue }
        eof { }
    }
    catch wait
}

puts "\n✅ Готово!"

