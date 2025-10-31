#!/usr/bin/expect -f

# Безопасное обновление сервера с исправлениями безопасности
# Используйте переменные окружения вместо захардкоженных значений

set timeout 600
set SERVER_HOST [env SERVER_HOST]
set SERVER_USER [env SERVER_USER]
set SERVER_PASS [env SERVER_PASSWORD]
set APP_DIR "/opt/newava"

if {$SERVER_HOST == "" || $SERVER_USER == "" || $SERVER_PASS == ""} {
    puts "❌ Ошибка: установите переменные окружения:"
    puts "  export SERVER_HOST=your-server-ip"
    puts "  export SERVER_USER=root"
    puts "  export SERVER_PASSWORD=your-password"
    exit 1
}

set app_dir "${APP_DIR}"

puts "\n🔒 Безопасное обновление сервера...\n"

puts "📥 Обновляем код:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git pull origin main"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🔨 Пересобираем бэкенд с исправлениями безопасности:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose build backend"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🔄 Перезапускаем контейнеры:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose up -d --force-recreate backend"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 3

puts "\n✅ Проверка:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -s http://localhost/api/health"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Обновление завершено!"


