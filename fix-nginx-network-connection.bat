@echo off
chcp 65001 >nul
REM Исправление подключения nginx к сети newava_network

echo ========================================
echo Исправление подключения nginx к сети
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/4] Проверка текущих сетей nginx...' && docker inspect newava_nginx --format '{{range \$k, \$v := .NetworkSettings.Networks}}{{printf \"%s: %s\\n\" \$k \$v.IPAddress}}{{end}}' && echo '' && echo '[2/4] Подключение nginx к сети newava_network...' && docker network connect newava_network newava_nginx 2>&1 || echo 'Nginx уже подключен или ошибка' && echo '' && echo '[3/4] Проверка сетей nginx после подключения...' && docker inspect newava_nginx --format '{{range \$k, \$v := .NetworkSettings.Networks}}{{printf \"%s: %s\\n\" \$k \$v.IPAddress}}{{end}}' && echo '' && echo '[4/4] Проверка доступности hnyear_backend...' && sleep 3 && docker exec newava_nginx ping -c 2 172.20.0.2 2>&1 | head -5 && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

