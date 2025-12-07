@echo off
chcp 65001 >nul
REM Проверка логов backend hnyear

echo ========================================
echo Проверка логов backend hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Последние 50 строк логов backend ===' && cd /opt/hnyear && docker compose logs --tail=50 backend && echo '' && echo '=== Проверка статуса контейнера backend ===' && docker compose ps backend && echo '' && echo '=== Проверка доступности API ===' && docker exec hnyear_backend curl -s http://localhost:3001/health 2>&1 || echo 'Health endpoint не доступен'"

pause

