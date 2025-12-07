@echo off
chcp 65001 >nul
REM Финальное исправление hnyear.com

echo ========================================
echo Финальное исправление hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/6] Проверка подключения контейнеров к сети...' && docker network inspect newava_network 2>&1 | grep -E 'hnyear_backend|hnyear_app' && echo '' && echo '[3/6] Подключение контейнеров к сети (если не подключены)...' && docker network connect newava_network hnyear_backend 2>&1 || echo 'Backend уже подключен' && docker network connect newava_network hnyear_app 2>&1 || echo 'App уже подключен' && echo '' && echo '[4/6] Обновление конфигурации nginx...' && cd /opt/newava && rm -f deploy/nginx/conf.d/hnyear.conf && git fetch origin new-year && git checkout origin/new-year -- deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[5/6] Перезапуск nginx...' && docker compose restart nginx && echo 'Ожидание запуска nginx...' && sleep 8 && echo '' && echo '[6/6] Проверка DNS резолвинга из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

