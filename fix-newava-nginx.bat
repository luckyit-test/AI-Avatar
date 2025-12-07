@echo off
chcp 65001 >nul
REM Исправление проблем с nginx для newava.pro

echo ========================================
echo Исправление nginx для newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/5] Проверка конфигурации nginx для newava.pro...' && cd /opt/newava && cat deploy/nginx/conf.d/app.conf | grep -E 'proxy_pass|server_name' | head -10 && echo '' && echo '[2/5] Проверка имен контейнеров в docker-compose.yml...' && grep -E 'container_name|service:' docker-compose.yml | head -10 && echo '' && echo '[3/5] Проверка подключения контейнеров к сети...' && docker network inspect newava_network 2>&1 | grep -E 'newava_backend|newava_app|newava_nginx' | head -10 && echo '' && echo '[4/5] Перезапуск контейнеров newava...' && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[5/5] Проверка и перезагрузка nginx...' && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '========================================='"

pause

