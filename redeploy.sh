#!/usr/bin/expect -f

set timeout 600
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"
set GIT_REPO "https://github.com/luckyit-test/AI-Avatar.git"

set app_dir "${APP_DIR}"
set git_repo "${GIT_REPO}"

puts "\n🔄 Переразвертывание с актуальной версией кода...\n"

puts "📥 Обновляем код из репозитория..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git fetch origin && git reset --hard origin/main"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n📊 Проверяем текущий коммит на сервере:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git log -1 --oneline"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🐳 Останавливаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose down"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🔨 Пересобираем Docker образы с актуальным кодом..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose build --no-cache"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🚀 Запускаем контейнеры..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose up -d"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 3

puts "\n📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🌐 Проверяем доступность:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -I http://localhost 2>&1 | head -3"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Переразвертывание завершено!"
puts "🌐 Приложение доступно: http://${SERVER_HOST}"

