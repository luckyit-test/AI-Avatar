@echo off
chcp 65001 >nul
REM Тест доступности контейнеров hnyear из nginx

echo ========================================
echo Тест доступности контейнеров hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/6] Проверка что контейнеры в сети newava_network ===' && docker network inspect newava_network 2>&1 | grep -A 5 'hnyear_app\|hnyear_backend' && echo '' && echo '=== [2/6] Проверка IP адресов контейнеров ===' && docker inspect hnyear_backend --format 'IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' && echo '' && docker inspect hnyear_app --format 'IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' && echo '' && echo '=== [3/6] Проверка DNS резолвинга из nginx ===' && docker exec newava_nginx nslookup hnyear_backend 2>&1 | head -10 && echo '' && docker exec newava_nginx nslookup hnyear_app 2>&1 | head -10 && echo '' && echo '=== [4/6] Проверка доступности через getent ===' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=== [5/6] Тест подключения к backend (curl) ===' && docker exec newava_nginx wget -qO- --timeout=5 http://hnyear_backend:3001/health 2>&1 || docker exec newava_nginx wget -qO- --timeout=5 http://hnyear_backend:3001/ 2>&1 | head -5 && echo '' && echo '=== [6/6] Тест подключения к app (curl) ===' && docker exec newava_nginx wget -qO- --timeout=5 http://hnyear_app:80/ 2>&1 | head -10 && echo '' && echo '=== Проверка nginx конфигурации ===' && cd /opt/newava && docker compose exec -T nginx nginx -t 2>&1"

pause

