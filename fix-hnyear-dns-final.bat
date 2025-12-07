@echo off
chcp 65001 >nul
REM Финальное исправление DNS для hnyear.com

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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Проверка IP адресов контейнеров hnyear...' && docker inspect hnyear_backend --format 'Backend IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' && docker inspect hnyear_app --format 'App IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' && echo '' && echo '[2/6] Проверка подключения к сети...' && docker network inspect newava_network 2>&1 | grep -E 'hnyear_backend|hnyear_app' && echo '' && echo '[3/6] Отключение и повторное подключение контейнеров к сети...' && docker network disconnect newava_network hnyear_backend 2>&1 || echo 'Backend не был подключен' && docker network disconnect newava_network hnyear_app 2>&1 || echo 'App не был подключен' && sleep 2 && docker network connect newava_network hnyear_backend && echo 'Backend подключен' && docker network connect newava_network hnyear_app && echo 'App подключен' && echo '' && echo '[4/6] Перезапуск контейнеров hnyear...' && cd /opt/hnyear && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 8 && echo '' && echo '[5/6] Проверка DNS резолвинга из nginx...' && cd /opt/newava && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[6/6] Перезапуск nginx...' && docker compose restart nginx && sleep 5 && echo '' && echo '=========================================' && echo 'DNS исправлен!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

