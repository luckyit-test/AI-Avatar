@echo off
chcp 65001 >nul
REM Проверка проблемы с загрузкой изображений на newava.pro

echo ========================================
echo Проверка проблемы с загрузкой изображений
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== Логи backend (последние 50 строк) ===' && docker compose logs --tail=50 backend && echo '' && echo '=== Логи nginx (последние 30 строк) ===' && docker compose logs --tail=30 nginx | grep -i 'evaluate\|POST\|error\|502\|503' || docker compose logs --tail=30 nginx && echo '' && echo '=== Статус контейнеров ===' && docker compose ps"

pause

