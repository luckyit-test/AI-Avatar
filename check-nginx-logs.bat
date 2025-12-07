@echo off
chcp 65001 >nul
REM Проверка логов nginx для диагностики 502 ошибки

echo ========================================
echo Проверка логов nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Последние ошибки nginx ===' && cd /opt/newava && docker compose logs nginx 2>&1 | grep -i 'error\|502\|bad gateway\|upstream' | tail -30 && echo '' && echo '=== Последние 50 строк логов nginx ===' && docker compose logs nginx --tail=50 && echo '' && echo '=== Проверка доступности контейнеров из nginx ===' && docker exec newava_nginx ping -c 2 hnyear_backend 2>&1 && echo '' && docker exec newava_nginx ping -c 2 hnyear_app 2>&1 && echo '' && echo '=== Проверка конфигурации hnyear.conf ===' && cat /opt/newava/deploy/nginx/conf.d/hnyear.conf | head -80"

pause

