@echo off
chcp 65001 >nul
REM Исправление 502 ошибки на hnyear.com (улучшенная версия)

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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "set -e; echo '[1/6] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/6] Подключение контейнеров к сети (если нужно)...' && docker network connect newava_network hnyear_backend 2>/dev/null || true && docker network connect newava_network hnyear_app 2>/dev/null || true && echo 'Контейнеры подключены к сети' && echo '' && echo '[3/6] Перезапуск контейнеров...' && docker compose restart backend app && echo 'Ожидание запуска...' && sleep 10 && echo '' && echo '[4/6] Обновление конфигурации nginx...' && cd /opt/hnyear && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация скопирована'; else echo 'ОШИБКА: файл конфигурации не найден!'; exit 1; fi && echo '' && echo '[5/6] Проверка и перезагрузка nginx...' && cd /opt/newava && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo 'Nginx перезагружен' && echo '' && echo '[6/6] Финальная проверка...' && cd /opt/hnyear && docker compose ps && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

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
    echo.
    echo Проверьте логи вручную:
    echo   ssh root@43.245.226.24
    echo   cd /opt/newava && docker compose logs nginx | tail -50
)

echo.
pause

