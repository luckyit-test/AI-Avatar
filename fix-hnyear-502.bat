@echo off
chcp 65001 >nul
REM Исправление 502 ошибки на hnyear.com

echo ========================================
echo Исправление 502 ошибки на hnyear.com
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo Выполнение диагностики и исправления...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Проверка статуса контейнеров...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/6] Проверка сети...' && docker network inspect newava_network --format '{{range .Containers}}{{.Name}} {{end}}' | grep -o hnyear || echo 'Контейнеры hnyear не найдены в сети' && echo '' && echo '[3/6] Переподключение контейнеров к сети...' && docker network connect newava_network hnyear_backend 2>/dev/null || echo 'Backend уже в сети' && docker network connect newava_network hnyear_app 2>/dev/null || echo 'App уже в сети' && echo '' && echo '[4/6] Проверка логов backend...' && docker compose logs --tail=10 backend && echo '' && echo '[5/6] Перезапуск контейнеров...' && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[6/6] Проверка доступности из nginx...' && docker exec newava_nginx sh -c 'getent hosts hnyear_backend' && docker exec newava_nginx sh -c 'getent hosts hnyear_app' && echo '' && echo 'Перезагрузка nginx...' && cd /opt/newava && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Проверка завершена!' && echo '=========================================' && echo '' && echo 'Статус контейнеров:' && cd /opt/hnyear && docker compose ps"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Исправление завершено!
    echo ========================================
    echo.
    echo Проверьте сайт: https://hnyear.com/
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при исправлении!
    echo ========================================
)

echo.
pause

