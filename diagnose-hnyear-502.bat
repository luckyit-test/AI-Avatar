@echo off
chcp 65001 >nul
REM Детальная диагностика проблемы 502

echo ========================================
echo Детальная диагностика hnyear 502
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/10] Статус контейнеров hnyear ===' && cd /opt/hnyear && docker compose ps && echo '' && echo '=== [2/10] Логи backend (последние 20 строк) ===' && docker compose logs --tail=20 backend && echo '' && echo '=== [3/10] Логи app (последние 20 строк) ===' && docker compose logs --tail=20 app && echo '' && echo '=== [4/10] Проверка что контейнеры запущены ===' && docker ps | grep hnyear && echo '' && echo '=== [5/10] Проверка портов контейнеров ===' && docker port hnyear_backend 2>&1 && docker port hnyear_app 2>&1 && echo '' && echo '=== [6/10] Проверка сети newava_network ===' && docker network inspect newava_network 2>&1 | head -30 && echo '' && echo '=== [7/10] Проверка подключения контейнеров к сети ===' && docker inspect hnyear_backend --format '{{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && docker inspect hnyear_app --format '{{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && echo '=== [8/10] Проверка доступности из nginx контейнера ===' && docker exec newava_nginx ping -c 1 hnyear_backend 2>&1 | head -3 && docker exec newava_nginx ping -c 1 hnyear_app 2>&1 | head -3 && echo '' && echo '=== [9/10] Проверка DNS резолвинга из nginx ===' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=== [10/10] Проверка nginx конфигурации ===' && cd /opt/newava && docker compose exec -T nginx nginx -t 2>&1 && echo '' && echo '=== Последние ошибки nginx (последние 10 строк) ===' && docker compose logs nginx 2>&1 | tail -10"

pause

