@echo off
chcp 65001 >nul
REM Проверка ошибок в логах nginx

echo ========================================
echo Проверка ошибок nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Последние ошибки nginx (последние 30 строк) ===' && cd /opt/newava && docker compose logs nginx 2>&1 | tail -30 && echo '' && echo '=== Проверка доступности контейнеров ===' && docker exec newava_nginx ping -c 1 hnyear_backend 2>&1 | head -5 && echo '' && docker exec newava_nginx ping -c 1 hnyear_app 2>&1 | head -5 && echo '' && echo '=== Проверка что контейнеры в сети ===' && docker network inspect newava_network --format '{{range .Containers}}{{.Name}} {{end}}' 2>&1 | grep hnyear"

pause

