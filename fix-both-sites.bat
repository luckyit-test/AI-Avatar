@echo off
chcp 65001 >nul
REM Исправление проблем с обоими сайтами

echo ========================================
echo Исправление newava.pro и hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/6] Перезапуск контейнеров hnyear...' && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[3/6] Проверка подключения контейнеров hnyear к сети...' && docker network connect newava_network hnyear_backend 2>&1 || echo 'Backend уже в сети' && docker network connect newava_network hnyear_app 2>&1 || echo 'App уже в сети' && echo '' && echo '[4/6] Перезапуск контейнеров newava...' && cd /opt/newava && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[5/6] Перезапуск nginx...' && docker compose restart nginx && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[6/6] Проверка и перезагрузка конфигурации nginx...' && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  https://newava.pro/' && echo '  https://hnyear.com/'"

pause

