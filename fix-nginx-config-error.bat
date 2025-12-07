@echo off
chcp 65001 >nul
REM Исправление ошибки конфигурации nginx

echo ========================================
echo Исправление ошибки конфигурации nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/4] Обновление конфигурации...' && rm -f deploy/nginx/conf.d/hnyear.conf && git fetch origin new-year && git checkout origin/new-year -- deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[2/4] Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && echo '' && echo '[3/4] Перезагрузка конфигурации nginx...' && docker compose exec -T nginx nginx -s reload && echo '' && echo '[4/4] Проверка статуса nginx...' && sleep 3 && docker compose ps nginx && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  https://newava.pro/' && echo '  https://hnyear.com/'"

pause

