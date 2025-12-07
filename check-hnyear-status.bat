@echo off
chcp 65001 >nul
REM Проверка статуса контейнеров hnyear

echo ========================================
echo Проверка статуса hnyear.com
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Проверка контейнеров и логов...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Статус контейнеров hnyear ===' && cd /opt/hnyear && docker compose ps && echo '' && echo '=== Проверка сети ===' && docker network inspect newava_network | grep -A 5 hnyear && echo '' && echo '=== Логи backend (последние 20 строк) ===' && docker compose logs --tail=20 backend && echo '' && echo '=== Логи app (последние 20 строк) ===' && docker compose logs --tail=20 app && echo '' && echo '=== Проверка доступности контейнеров из nginx ===' && docker exec newava_nginx ping -c 2 hnyear_backend 2>&1 | head -5 && echo '' && echo '=== Проверка портов ===' && docker exec hnyear_backend netstat -tlnp 2>/dev/null | grep 3001 || echo 'Порт 3001 не слушается'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Проверка завершена
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Ошибка при проверке!
    echo ========================================
)

echo.
pause

