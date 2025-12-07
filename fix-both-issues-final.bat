@echo off
chcp 65001 >nul
REM Финальное исправление обеих проблем

echo ========================================
echo Исправление hnyear.com и newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/7] Перезапуск контейнеров hnyear...' && cd /opt/hnyear && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 8 && echo '' && echo '[2/7] Подключение контейнеров hnyear к сети...' && docker network connect newava_network hnyear_backend 2>&1 || echo 'Backend уже подключен' && docker network connect newava_network hnyear_app 2>&1 || echo 'App уже подключен' && echo '' && echo '[3/7] Перезапуск nginx...' && cd /opt/newava && docker compose restart nginx && echo 'Ожидание запуска nginx...' && sleep 8 && echo '' && echo '[4/7] Проверка DNS резолвинга...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[5/7] Проверка переменных CORS для newava...' && docker compose exec -T backend printenv | grep -i 'ALLOWED_ORIGINS' || echo 'Переменная ALLOWED_ORIGINS не найдена' && echo '' && echo '[6/7] Проверка статуса контейнеров...' && docker compose ps && echo '' && echo '[7/7] Логи nginx (последние 5 строк с ошибками)...' && docker compose logs --tail=50 nginx 2>&1 | grep -i 'error\|502\|503' | tail -5 || echo 'Нет ошибок в логах' && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  https://newava.pro/ - попробуйте загрузить фото' && echo '  https://hnyear.com/'"

pause

