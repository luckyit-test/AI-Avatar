@echo off
chcp 65001 >nul
REM Исправление DNS резолвинга для hnyear.com

echo ========================================
echo Исправление DNS для hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/5] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/5] Перезапуск контейнеров hnyear...' && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[3/5] Подключение контейнеров к сети newava_network...' && docker network connect newava_network hnyear_backend 2>&1 || echo 'Backend уже подключен' && docker network connect newava_network hnyear_app 2>&1 || echo 'App уже подключен' && echo '' && echo '[4/5] Проверка DNS резолвинга из nginx...' && cd /opt/newava && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[5/5] Перезапуск nginx...' && docker compose restart nginx && sleep 5 && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

