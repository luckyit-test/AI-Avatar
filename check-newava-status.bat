@echo off
chcp 65001 >nul
REM Проверка статуса проекта newava (avatar ветка)

echo ========================================
echo Проверка статуса newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/6] Статус контейнеров newava ===' && cd /opt/newava && docker compose ps && echo '' && echo '=== [2/6] Логи backend newava (последние 30 строк) ===' && docker compose logs --tail=30 backend 2>&1 | tail -30 && echo '' && echo '=== [3/6] Логи nginx (последние 20 строк) ===' && docker compose logs --tail=20 nginx 2>&1 | tail -20 && echo '' && echo '=== [4/6] Проверка конфигурации nginx ===' && docker compose exec -T nginx nginx -t 2>&1 && echo '' && echo '=== [5/6] Проверка доступности контейнеров из nginx ===' && docker exec newava_nginx getent hosts newava_backend && docker exec newava_nginx getent hosts newava_app && echo '' && echo '=== [6/6] Проверка сетей контейнеров ===' && docker network inspect newava_network 2>&1 | grep -A 3 'newava_backend\|newava_app\|newava_nginx' | head -20"

pause

