@echo off
chcp 65001 >nul
REM Скрипт для проверки логов сервера через SSH
REM Использование: check-server-logs.bat [количество строк]

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

set LINES=%1
if "%LINES%"=="" set LINES=100

echo ========================================
echo Проверка логов сервера (последние %LINES% строк)
echo ========================================
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && LINES=%LINES% && echo '=== Логи бэкенда ===' && docker logs --tail $LINES newava_backend 2>&1 && echo '' && echo '=== Логи Nginx ===' && docker logs --tail $LINES newava_nginx 2>&1 && echo '' && echo '=== Логи приложения ===' && docker logs --tail $LINES newava_app 2>&1 && echo '' && echo '=== Поиск ошибок Robokassa ===' && docker logs newava_backend 2>&1 | grep -i 'robokassa\|payment\|error' | tail -20"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Логи успешно получены!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Ошибка при получении логов!
    echo ========================================
)

echo.
pause

