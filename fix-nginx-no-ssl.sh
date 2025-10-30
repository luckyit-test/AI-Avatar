#!/usr/bin/expect -f

set timeout 30
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"

set app_dir "${APP_DIR}"

puts "\n🔧 Исправляем конфигурацию Nginx (без SSL для доступа по IP)...\n"

# Создаем конфигурацию только с HTTP (без SSL блока)
puts "📝 Обновляем конфигурацию Nginx..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cat > $app_dir/deploy/nginx/conf.d/app.conf << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Разрешаем доступ по IP
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

puts "🔄 Перезапускаем Nginx..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose restart nginx"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

sleep 3

puts "\n📊 Проверяем статус контейнеров:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cd $app_dir && docker compose ps"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n🌐 Проверяем доступность:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -I http://localhost 2>&1 | head -5"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"
puts "🌐 Приложение должно быть доступно по адресу: http://${SERVER_HOST}"

