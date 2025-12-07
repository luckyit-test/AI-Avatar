@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM Финальное исправление: подключение nginx к сети newava_network

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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/7] Проверка текущих сетей nginx контейнера...' && docker inspect newava_nginx --format '{{range \$net, \$v := .NetworkSettings.Networks}}{{printf \"%s\\n\" \$net}}{{end}}' && echo '' && echo '[2/7] Проверка сети newava_network...' && docker network inspect newava_network --format '{{.Name}}' && echo '' && echo '[3/7] Подключение nginx к сети newava_network...' && docker network connect newava_network newava_nginx 2>&1 && echo 'nginx подключен к сети newava_network' || echo 'nginx уже подключен или ошибка' && echo '' && echo '[4/7] Проверка что nginx теперь в сети...' && docker network inspect newava_network 2>&1 | grep -A 3 'newava_nginx' && echo '' && echo '[5/7] Перезапуск nginx...' && cd /opt/newava && docker compose restart nginx && echo 'Ожидание запуска nginx...' && sleep 8 && echo '' && echo '[6/7] Проверка DNS резолвинга из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[7/7] Тест подключения к контейнерам...' && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_backend:3001/ 2>&1 && echo '' && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_app:80/ 2>&1 && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

set EXIT_CODE=%ERRORLEVEL%

echo.
echo ========================================
if %EXIT_CODE% EQU 0 (
    echo Команда выполнена успешно!
) else (
    echo Команда завершилась с ошибкой: %EXIT_CODE%
)
echo ========================================
echo.
echo Проверьте сайт: https://hnyear.com/
echo.
pause
endlocal

