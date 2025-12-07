@echo off
chcp 65001 >nul
REM Проверка статуса обоих сайтов

echo ========================================
echo Проверка статуса newava.pro и hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Статус контейнеров newava...' && cd /opt/newava && docker compose ps && echo '' && echo '[2/6] Статус контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[3/6] Проверка DNS резолвинга из nginx...' && cd /opt/newava && docker exec newava_nginx getent hosts newava_backend && docker exec newava_nginx getent hosts newava_app && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[4/6] Проверка доступности backend newava...' && docker exec newava_nginx wget -qO- --timeout=3 http://newava_backend:3001/health 2>&1 | head -2 || echo 'Backend newava не доступен' && echo '' && echo '[5/6] Проверка доступности backend hnyear...' && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_backend:3001/health 2>&1 | head -2 || echo 'Backend hnyear не доступен' && echo '' && echo '[6/6] Логи nginx (последние 5 строк с ошибками)...' && docker compose logs --tail=50 nginx 2>&1 | grep -i 'error\|502\|503\|504' | tail -5 || echo 'Нет ошибок в логах nginx' && echo '' && echo '=========================================' && echo 'Проверка завершена!' && echo '=========================================' && echo '' && echo 'Проверьте сайты в браузере:' && echo '  https://newava.pro/' && echo '  https://hnyear.com/'"

pause

