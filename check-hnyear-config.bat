@echo off
chcp 65001 >nul
REM Проверка конфигурации hnyear

echo ========================================
echo Проверка конфигурации hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Проверка переменных окружения ===' && cd /opt/hnyear && docker compose exec -T backend env | grep -E 'GEMINI|ALLOWED|PORT' && echo '' && echo '=== Проверка .env файла ===' && cat .env | grep -v 'PASSWORD' && echo '' && echo '=== Проверка статуса контейнеров ===' && docker compose ps && echo '' && echo '=== Проверка доступности backend изнутри контейнера ===' && docker exec hnyear_backend curl -s http://localhost:3001/health 2>&1 || echo 'Health endpoint не доступен' && echo '' && echo '=== Проверка доступности backend из nginx ===' && docker exec newava_nginx curl -s http://hnyear_backend:3001/health 2>&1 || echo 'Backend не доступен из nginx'"

pause

