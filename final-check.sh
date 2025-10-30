#!/usr/bin/expect -f

set timeout 10
set SERVER_HOST "43.245.226.24"
set SERVER_USER "root"
set SERVER_PASS "Yd2Vc_Wejus0DlNB"
set APP_DIR "/opt/newava"

set app_dir "${APP_DIR}"

puts "\n🔍 Финальная проверка развертывания...\n"

puts "📊 Статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🌐 Проверка доступности приложения:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -I http://localhost 2>&1 | head -5"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n📄 Проверка содержимого главной страницы:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -s http://localhost | grep -o '<title>.*</title>' | head -1"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Проверка завершена!"
puts "🌐 Приложение доступно: http://${SERVER_HOST}"

