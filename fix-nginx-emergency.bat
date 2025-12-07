@echo off
chcp 65001 >nul
REM Экстренное исправление nginx - остановка, обновление конфигурации, запуск

echo ========================================
echo Экстренное исправление nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/6] Остановка nginx контейнера...' && docker compose stop nginx && echo 'Nginx остановлен' && echo '' && echo '[2/6] Обновление конфигурации...' && rm -f deploy/nginx/conf.d/hnyear.conf && git fetch origin new-year && git checkout origin/new-year -- deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[3/6] Проверка конфигурации через временный контейнер...' && docker run --rm -v /opt/newava/deploy/nginx/conf.d:/etc/nginx/conf.d:ro nginx:1.27-alpine nginx -t && echo 'Конфигурация валидна' && echo '' && echo '[4/6] Запуск nginx...' && docker compose up -d nginx && echo 'Ожидание запуска nginx...' && sleep 5 && echo '' && echo '[5/6] Проверка статуса nginx...' && docker compose ps nginx && echo '' && echo '[6/6] Проверка DNS резолвинга...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  https://newava.pro/' && echo '  https://hnyear.com/'"

pause

