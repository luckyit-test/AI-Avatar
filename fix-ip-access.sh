#!/usr/bin/expect -f

set timeout 30
set SERVER_HOST "94.198.221.161"
set SERVER_USER "root"
set SERVER_PASS "oJ@MQ+vvmo,G2G"
set APP_DIR "/opt/newava"

set app_dir "${APP_DIR}"

puts "\n🔧 Настраиваем доступ по IP адресу...\n"

# Создаем временную конфигурацию, которая позволит доступ по IP
puts "📝 Обновляем конфигурацию Nginx..."
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "cat > $app_dir/deploy/nginx/conf.d/app.conf << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Разрешаем доступ по IP без редиректа на HTTPS
    location / {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://app:80;
    }
}

server {
    listen 443 ssl;
    server_name newava.pro;

    ssl_certificate /etc/letsencrypt/live/newava.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/newava.pro/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
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

sleep 2

puts "\n✅ Настройка завершена!"
puts "🌐 Приложение доступно по IP: http://${SERVER_HOST}"
puts "🌐 Или по домену (когда DNS обновится): https://newava.pro"

puts "\n📊 Проверка доступности:"
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "curl -I http://localhost 2>/dev/null | head -3"
expect {
    "password:" { send "${SERVER_PASS}\r"; exp_continue }
    "Password:" { send "${SERVER_PASS}\r"; exp_continue }
    eof { }
}
catch wait

puts "\n✅ Готово!"

