@echo off
chcp 65001 >nul
REM Исправление доступа nginx к контейнерам hnyear

echo ========================================
echo Исправление доступа nginx к hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/5] Проверка сети nginx контейнера...' && docker inspect newava_nginx --format 'Сети: {{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && echo '[2/5] Убеждаемся что все контейнеры в одной сети...' && docker network connect newava_network newava_nginx 2>&1 && echo 'nginx подключен к сети' || echo 'nginx уже в сети' && echo '' && echo '[3/5] Перезапуск nginx для применения изменений...' && cd /opt/newava && docker compose restart nginx && echo 'Ожидание запуска nginx...' && sleep 5 && echo '' && echo '[4/5] Проверка доступности контейнеров из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[5/5] Тест подключения...' && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_app:80/ 2>&1 | head -3 && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

