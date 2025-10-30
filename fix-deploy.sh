#!/usr/bin/expect -f

set timeout 600
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"
set DOMAIN "newava.pro"

puts "\n🔧 Исправляем развертывание...\n"

set app_dir "${APP_DIR}"
set domain "${DOMAIN}"

# Проверяем какая команда docker compose доступна
puts "🔍 Проверяем версию Docker Compose..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo 'NOT_FOUND'"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

# Определяем команду
puts "🐳 Останавливаем старые контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && (docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true)"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🔨 Собираем Docker образы..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose build --no-cache 2>/dev/null || docker-compose build --no-cache"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🚀 Запускаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose up -d 2>/dev/null || docker-compose up -d"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 5

puts "🔒 Обновляем конфигурацию nginx для домена..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "sed -i 's/server_name _;/server_name $domain;/g' $app_dir/deploy/nginx/conf.d/app.conf"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "🔄 Перезапускаем nginx..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose restart nginx 2>/dev/null || docker-compose restart nginx"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Исправление завершено!"
puts "🌐 Приложение доступно: https://${DOMAIN}"
puts "\n📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose ps 2>/dev/null || docker-compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"

