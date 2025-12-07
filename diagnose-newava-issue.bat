@echo off
chcp 65001 >nul
REM Детальная диагностика проблемы newava.pro

echo ========================================
echo Детальная диагностика newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/8] Статус всех контейнеров newava ===' && cd /opt/newava && docker compose ps && echo '' && echo '=== [2/8] Проверка сетей контейнеров ===' && docker inspect newava_backend --format 'Сети backend: {{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && docker inspect newava_app --format 'Сети app: {{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && docker inspect newava_nginx --format 'Сети nginx: {{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s \" \$net}}{{end}}' && echo '' && echo '=== [3/8] Проверка DNS резолвинга из nginx ===' && docker exec newava_nginx getent hosts backend 2>&1 && docker exec newava_nginx getent hosts app 2>&1 && docker exec newava_nginx getent hosts newava_backend 2>&1 && docker exec newava_nginx getent hosts newava_app 2>&1 && echo '' && echo '=== [4/8] Проверка конфигурации nginx на сервере ===' && docker compose exec -T nginx cat /etc/nginx/conf.d/app.conf | grep -E 'proxy_pass|server_name' | head -10 && echo '' && echo '=== [5/8] Проверка конфигурации nginx (синтаксис) ===' && docker compose exec -T nginx nginx -t 2>&1 && echo '' && echo '=== [6/8] Логи nginx (последние 30 строк) ===' && docker compose logs --tail=30 nginx 2>&1 | tail -30 && echo '' && echo '=== [7/8] Логи backend (последние 20 строк) ===' && docker compose logs --tail=20 backend 2>&1 | tail -20 && echo '' && echo '=== [8/8] Тест подключения к контейнерам из nginx ===' && docker exec newava_nginx wget -qO- --timeout=3 http://backend:3001/health 2>&1 | head -3 || echo 'Не удалось подключиться к backend:3001' && docker exec newava_nginx wget -qO- --timeout=3 http://app:80/ 2>&1 | head -3 || echo 'Не удалось подключиться к app:80'"

pause

