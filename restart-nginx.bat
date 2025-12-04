@echo off
chcp 65001 >nul
REM Перезапуск Nginx на продакшн сервере

echo ========================================
echo ПЕРЕЗАПУСК NGINX НА ПРОДАКШН СЕРВЕРЕ
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

echo Подключение к серверу и перезапуск Nginx...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Остановка Nginx...' && docker compose stop nginx && echo '[2/3] Запуск Nginx...' && docker compose up -d nginx && echo '[3/3] Статус Nginx:' && docker compose ps nginx && echo '' && echo '=========================================' && echo 'Nginx перезапущен успешно!' && echo '========================================='"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Nginx перезапущен успешно!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Ошибка при перезапуске Nginx!
    echo ========================================
)

echo.
pause

