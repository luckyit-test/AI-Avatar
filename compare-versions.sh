#!/usr/bin/expect -f

set timeout 30
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"

set app_dir "${APP_DIR}"

puts "\n🔍 Сравниваем версии...\n"

puts "📊 Локальный git commit:"
spawn bash -c "cd /Users/ruslankuznetsov/AI-Avatar/AI-Avatar && git rev-parse HEAD"
expect eof
catch wait

puts "\n📊 Commit на сервере:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git rev-parse HEAD 2>/dev/null || echo 'Не git репозиторий'"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n📄 Последний коммит на сервере:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && git log -1 --oneline 2>/dev/null || echo 'Нет git истории'"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n📋 Проверка ключевых файлов на сервере:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && ls -la App.tsx package.json vite.config.ts 2>/dev/null | head -10"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

