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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/6] Проверка конфигурации hnyear (IP адреса)...' && grep -E 'backend_upstream|app_upstream' deploy/nginx/conf.d/hnyear.conf | head -4 && echo '' && echo '[2/6] Проверка доступности backend hnyear через IP...' && docker exec newava_nginx wget -qO- --timeout=5 http://172.20.0.2:3001/health 2>&1 | head -3 || echo 'Backend не отвечает' && echo '' && echo '[3/6] Проверка доступности app hnyear через IP...' && docker exec newava_nginx wget -qO- --timeout=5 http://172.20.0.3:80/ 2>&1 | head -3 || echo 'App не отвечает' && echo '' && echo '[4/6] Логи nginx для hnyear (последние 5 строк)...' && docker compose logs --tail=20 nginx 2>&1 | grep -i 'hnyear\|502\|error' | tail -5 || echo 'Нет ошибок для hnyear' && echo '' && echo '[5/6] Проверка CORS для newava...' && docker compose exec -T backend printenv ALLOWED_ORIGINS 2>&1 && echo '' && echo '[6/6] Статус контейнеров...' && docker compose ps && cd /opt/hnyear && docker compose ps && echo '' && echo '=========================================' && echo 'Проверка завершена!' && echo '=========================================' && echo '' && echo 'Проверьте сайты в браузере:' && echo '  https://newava.pro/ - попробуйте загрузить фото' && echo '  https://hnyear.com/'"

pause

