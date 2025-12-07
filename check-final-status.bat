@echo off
chcp 65001 >nul
REM Финальная проверка статуса обоих сайтов

echo ========================================
echo Финальная проверка статуса сайтов
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/5] Проверка DNS для hnyear...' && docker exec newava_nginx getent hosts hnyear_backend 2>&1 && docker exec newava_nginx getent hosts hnyear_app 2>&1 && echo '' && echo '[2/5] Проверка CORS в backend newava...' && docker compose exec -T backend printenv | grep -i 'ALLOWED_ORIGINS' && echo '' && echo '[3/5] Проверка доступности backend hnyear...' && docker exec newava_nginx wget -qO- --timeout=3 http://hnyear_backend:3001/health 2>&1 | head -2 || echo 'Backend hnyear не доступен' && echo '' && echo '[4/5] Логи nginx (последние 10 строк с ошибками)...' && docker compose logs --tail=50 nginx 2>&1 | grep -i 'error\|502\|503\|504' | tail -10 || echo 'Нет ошибок в логах' && echo '' && echo '[5/5] Статус всех контейнеров...' && docker compose ps && cd /opt/hnyear && docker compose ps && echo '' && echo '=========================================' && echo 'Проверка завершена!' && echo '=========================================' && echo '' && echo 'Проверьте сайты в браузере:' && echo '  https://newava.pro/ - попробуйте загрузить фото' && echo '  https://hnyear.com/'"

pause

