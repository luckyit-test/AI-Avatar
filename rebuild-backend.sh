#!/usr/bin/expect -f

set timeout 600
set SERVER_HOST "43.245.226.24"
set SERVER_USER "root"
set SERVER_PASS "Yd2Vc_Wejus0DlNB"
set APP_DIR "/opt/newava"

puts "\n🔨 Пересборка бэкенда...\n"

puts "\n📥 Обновляем код:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $APP_DIR && git pull origin main"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🔨 Пересобираем бэкенд:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $APP_DIR && docker compose build --no-cache backend"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🔄 Перезапускаем бэкенд:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $APP_DIR && docker compose up -d backend"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 3

puts "\n📋 Проверяем логи бэкенда:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $APP_DIR && docker compose logs backend --tail 20"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Бэкенд пересобран!"

