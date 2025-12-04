@echo off
REM Скрипт для проверки логов сервера через Docker
REM Использование: check-server-logs.bat [количество строк]

set LINES=%1
if "%LINES%"=="" set LINES=100

echo ========================================
echo Проверка логов бэкенда (последние %LINES% строк)
echo ========================================
docker logs --tail %LINES% newava_backend

echo.
echo ========================================
echo Проверка логов Nginx (последние %LINES% строк)
echo ========================================
docker logs --tail %LINES% newava_nginx

echo.
echo ========================================
echo Проверка логов приложения (последние %LINES% строк)
echo ========================================
docker logs --tail %LINES% newava_app

echo.
echo ========================================
echo Поиск ошибок Robokassa в логах бэкенда
echo ========================================
docker logs newava_backend 2>&1 | findstr /i "robokassa payment error"

echo.
echo ========================================
echo Готово! Для просмотра всех логов используйте:
echo   docker logs -f newava_backend
echo ========================================
pause

