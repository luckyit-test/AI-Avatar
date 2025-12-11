@echo off
chcp 65001 >nul
REM Деплой ветки new-year на прод (hnyear.com)

echo ========================================
echo Деплой ветки new-year на прод (hnyear.com)
echo ========================================
echo.

echo ТЕКУЩАЯ СИТУАЦИЯ:
echo - Домен: hnyear.com
echo - Ветка: new-year
echo - Директория: /opt/hnyear
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Выполнение деплоя ветки new-year...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "set -e && echo '[0/11] Создание директории /opt/hnyear...' && mkdir -p /opt/hnyear && cd /opt/hnyear && echo '[1/11] Инициализация git (если нужно)...' && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo '[2/11] Получение всех веток...' && git fetch origin && echo '[3/11] Сохранение конфигурации newava.pro (если существует)...' && cd /opt/newava && if [ -f deploy/nginx/conf.d/app.conf ]; then cp deploy/nginx/conf.d/app.conf /tmp/app.conf.backup && echo 'Конфигурация newava.pro сохранена'; fi && cd /opt/hnyear && echo '[4/11] Переключение на ветку new-year...' && git checkout new-year 2>/dev/null || git checkout -b new-year origin/new-year && echo '[5/11] Принудительное обновление кода из ветки new-year...' && git reset --hard origin/new-year && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git log -1 --oneline) && echo '=========================================' && echo '' && echo '[6/11] Создание .env файла (если нужно)...' && if [ ! -f .env ]; then echo 'GEMINI_API_KEY=your_key_here' > .env && echo 'GEMINI_API_KEY_ANALYSIS=your_key_here' >> .env && echo 'ALLOWED_ORIGINS=https://hnyear.com,https://www.hnyear.com' >> .env && echo 'ROBOKASSA_LOGIN=hnyear.com' >> .env && echo 'ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax' >> .env && echo 'ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E' >> .env && echo 'ROBOKASSA_IS_TEST=0' >> .env && echo 'ROBOKASSA_PAYMENT_AMOUNT=100.00' >> .env && echo '.env файл создан. Обновите GEMINI_API_KEY!'; fi && echo '[7/11] Настройка docker-compose и копирование nginx конфига...' && mkdir -p deploy/certbot/www deploy/certbot/conf deploy/nginx/conf.d data && if [ -f docker-compose.hnyear.yml ]; then cp docker-compose.hnyear.yml docker-compose.yml && echo 'Используется docker-compose.hnyear.yml'; else if [ -f docker-compose.yml ]; then cp docker-compose.yml docker-compose.yml.bak 2>/dev/null || true && sed -i 's/newava_backend/hnyear_backend/g' docker-compose.yml && sed -i 's/newava_app/hnyear_app/g' docker-compose.yml && sed -i 's/newava_nginx/hnyear_nginx/g' docker-compose.yml && sed -i 's/newava_certbot/hnyear_certbot/g' docker-compose.yml && sed -i 's/newava_network/hnyear_network/g' docker-compose.yml && sed -i 's/newava-backend/hnyear-backend/g' docker-compose.yml && sed -i 's/newava:latest/hnyear:latest/g' docker-compose.yml && echo 'docker-compose.yml обновлен'; else echo 'ОШИБКА: docker-compose.yml не найден!'; exit 1; fi; fi && cd /opt/newava && echo 'Проверка сети newava_network...' && docker compose up -d 2>/dev/null || true && docker network create newava_network 2>/dev/null || true && echo '[8/11] Восстановление конфигурации newava.pro (если была сохранена)...' && if [ -f /tmp/app.conf.backup ]; then mkdir -p deploy/nginx/conf.d && cp /tmp/app.conf.backup deploy/nginx/conf.d/app.conf && echo 'Конфигурация newava.pro восстановлена'; fi && cd /opt/hnyear && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then mkdir -p /opt/newava/deploy/nginx/conf.d && cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация nginx скопирована в /opt/newava/deploy/nginx/conf.d/hnyear.conf'; else echo 'ВНИМАНИЕ: deploy/nginx/conf.d/hnyear.conf не найден!'; fi && echo '[9/11] Пересборка и перезапуск контейнеров hnyear...' && docker compose up -d --build app backend && echo 'Ожидание запуска контейнеров...' && sleep 10 && echo 'Проверка статуса контейнеров...' && docker ps | grep hnyear && echo '[10/11] Получение SSL сертификата...' && cd /opt/newava && docker run --rm -v /opt/newava/deploy/certbot/conf:/etc/letsencrypt -v /opt/newava/deploy/certbot/www:/var/www/certbot certbot/certbot:latest certonly --webroot -w /var/www/certbot -d hnyear.com -d www.hnyear.com -m admin@hnyear.com --agree-tos --no-eff-email --non-interactive 2>&1 || echo 'Сертификат будет получен позже (возможно уже существует)' && echo '[11/11] Подключение nginx к сети newava_network и перезагрузка...' && docker network connect newava_network newava_nginx 2>&1 && echo 'nginx подключен к сети' || echo 'nginx уже в сети' && echo 'Проверка и перезагрузка nginx...' && sleep 5 && docker compose exec -T nginx nginx -t 2>&1 && docker compose exec -T nginx nginx -s reload 2>&1 && echo '' && echo '=========================================' && echo 'Деплой завершен!' && echo '=========================================' && cd /opt/hnyear && echo '' && echo 'Статус контейнеров hnyear:' && docker compose ps"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Деплой завершен успешно!
    echo ========================================
    echo.
    echo Теперь на проде должна быть ветка NEW-YEAR
    echo Проверьте сайт: https://hnyear.com/
    echo.
    echo ВАЖНО: Обновите GEMINI_API_KEY в файле /opt/hnyear/.env на сервере!
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при деплое!
    echo ========================================
)

echo.
pause
