@echo off
chcp 65001 >nul
REM Исправление hnyear.com через прямое использование IP адресов

echo ========================================
echo Исправление hnyear.com через IP адреса
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/5] Получение IP адресов контейнеров hnyear...' && BACKEND_IP=$(docker inspect hnyear_backend --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}') && APP_IP=$(docker inspect hnyear_app --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}') && echo 'Backend IP: '$BACKEND_IP && echo 'App IP: '$APP_IP && echo '' && echo '[2/5] Обновление конфигурации nginx с IP адресами...' && cd /opt/newava && sed -i 's|set \$backend_upstream hnyear_backend:3001|set \$backend_upstream '$BACKEND_IP':3001|g' deploy/nginx/conf.d/hnyear.conf && sed -i 's|set \$app_upstream hnyear_app:80|set \$app_upstream '$APP_IP':80|g' deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[3/5] Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && echo '' && echo '[4/5] Перезагрузка конфигурации nginx...' && docker compose exec -T nginx nginx -s reload && echo '' && echo '[5/5] Проверка доступности через IP...' && docker exec newava_nginx wget -qO- --timeout=3 http://$BACKEND_IP:3001/health 2>&1 | head -2 || echo 'Backend не доступен' && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

