@echo off
chcp 65001 >nul
REM Проверка статуса обоих сайтов

echo ========================================
echo Проверка статуса newava.pro и hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/8] Статус контейнеров newava ===' && cd /opt/newava && docker compose ps && echo '' && echo '=== [2/8] Статус контейнеров hnyear ===' && cd /opt/hnyear && docker compose ps && echo '' && echo '=== [3/8] Проверка сети newava_network ===' && docker network inspect newava_network 2>&1 | grep -E 'newava_backend|newava_app|newava_nginx|hnyear_backend|hnyear_app' | head -15 && echo '' && echo '=== [4/8] Логи backend newava (последние 15 строк) ===' && cd /opt/newava && docker compose logs --tail=15 backend 2>&1 | tail -15 && echo '' && echo '=== [5/8] Логи backend hnyear (последние 15 строк) ===' && cd /opt/hnyear && docker compose logs --tail=15 backend 2>&1 | tail -15 && echo '' && echo '=== [6/8] Логи nginx (последние 20 строк с ошибками) ===' && cd /opt/newava && docker compose logs --tail=50 nginx 2>&1 | grep -i 'error\|502\|503\|504\|failed\|hnyear\|newava' | tail -20 && echo '' && echo '=== [7/8] Проверка доступности контейнеров из nginx ===' && docker exec newava_nginx getent hosts newava_backend && docker exec newava_nginx getent hosts newava_app && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=== [8/8] Тест подключения к контейнерам ===' && docker exec newava_nginx wget -qO- --timeout=3 http://newava_backend:3001/health 2>&1 | head -2 && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_backend:3001/health 2>&1 | head -2"

pause

