@echo off
chcp 65001 >nul
REM Простое исправление nginx - обновление конфигурации и запуск

echo ========================================
echo Простое исправление nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/5] Остановка nginx контейнера...' && docker compose stop nginx 2>&1 || echo 'Nginx уже остановлен' && echo '' && echo '[2/5] Обновление конфигурации hnyear.conf...' && rm -f deploy/nginx/conf.d/hnyear.conf && git fetch origin new-year && git checkout origin/new-year -- deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[3/5] Запуск nginx...' && docker compose up -d nginx && echo 'Ожидание запуска nginx...' && sleep 8 && echo '' && echo '[4/5] Проверка статуса nginx...' && docker compose ps nginx && echo '' && echo '[5/5] Проверка логов nginx (последние 10 строк)...' && docker compose logs --tail=10 nginx && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Если nginx запущен (Up) - все хорошо!' && echo 'Если Restarting - проверьте логи выше' && echo '' && echo 'Проверьте сайты:' && echo '  https://newava.pro/' && echo '  https://hnyear.com/'"

pause

