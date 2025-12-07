@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM Упрощенная версия: подключение nginx к сети newava_network

echo ========================================
echo Подключение nginx к сети newava_network
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Выполнение команды...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB docker network connect newava_network newava_nginx

if %ERRORLEVEL% EQU 0 (
    echo nginx подключен к сети newava_network
) else (
    echo nginx уже подключен или ошибка
)

echo.
echo Перезапуск nginx...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose restart nginx"

echo.
echo Ожидание запуска nginx...
timeout /t 8 /nobreak >nul

echo.
echo Проверка DNS резолвинга из nginx...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker exec newava_nginx getent hosts hnyear_backend"
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker exec newava_nginx getent hosts hnyear_app"

echo.
echo ========================================
echo Исправление завершено!
echo ========================================
echo.
echo Проверьте сайт: https://hnyear.com/
echo.
pause
endlocal

