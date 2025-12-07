@echo off
chcp 65001 >nul
REM Исправление 502 ошибки на hnyear.com

echo ========================================
echo Исправление 502 ошибки на hnyear.com
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo Выполнение диагностики и исправления...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/7] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/7] Проверка сети newava_network...' && docker network inspect newava_network 2>/dev/null | grep hnyear || echo 'Контейнеры hnyear не найдены в сети' && echo '' && echo '[3/7] Подключение контейнеров к сети newava_network...' && docker network connect newava_network hnyear_backend 2>/dev/null && echo 'Backend подключен к сети' || echo 'Backend уже подключен или ошибка' && docker network connect newava_network hnyear_app 2>/dev/null && echo 'App подключен к сети' || echo 'App уже подключен или ошибка' && echo '' && echo '[4/7] Проверка логов backend...' && docker compose logs --tail=15 backend && echo '' && echo '[5/7] Перезапуск контейнеров...' && docker compose restart backend app && echo 'Ожидание запуска контейнеров...' && sleep 8 && echo '' && echo '[6/7] Проверка доступности из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[7/7] Обновление конфигурации nginx...' && cd /opt/hnyear && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация скопирована'; else echo 'ОШИБКА: файл конфигурации не найден!'; fi && cd /opt/newava && echo 'Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && echo 'Перезагрузка nginx...' && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Финальный статус контейнеров:' && cd /opt/hnyear && docker compose ps && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Исправление завершено!
    echo ========================================
    echo.
    echo Проверьте сайт: https://hnyear.com/
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при исправлении!
    echo ========================================
)

echo.
pause

