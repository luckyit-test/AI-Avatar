@echo off
chcp 65001 >nul
REM Исправление проблемы с сетью для hnyear контейнеров

echo ========================================
echo Исправление сетевых проблем hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/8] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/8] Проверка docker-compose.yml...' && if [ ! -f docker-compose.hnyear.yml ]; then echo 'ОШИБКА: docker-compose.hnyear.yml не найден!' && exit 1; fi && cp docker-compose.hnyear.yml docker-compose.yml && echo 'docker-compose.yml обновлен' && echo '' && echo '[3/8] Проверка сети newava_network...' && docker network inspect newava_network >/dev/null 2>&1 && echo 'Сеть существует' || (echo 'Сеть не существует, создаем...' && cd /opt/newava && docker compose up -d 2>/dev/null || true && docker network create newava_network 2>/dev/null || true && echo 'Сеть создана') && echo '' && echo '[4/8] Запуск контейнеров hnyear...' && cd /opt/hnyear && docker compose up -d && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[5/8] Проверка подключения контейнеров к сети...' && docker network inspect newava_network 2>&1 | grep -E 'hnyear_backend|hnyear_app' && echo 'Контейнеры найдены в сети' || echo 'Контейнеры не найдены в сети, подключаем...' && echo '' && echo '[6/8] Подключение контейнеров к сети newava_network (если нужно)...' && docker network connect newava_network hnyear_backend 2>&1 && echo 'hnyear_backend подключен' || echo 'hnyear_backend уже подключен' && docker network connect newava_network hnyear_app 2>&1 && echo 'hnyear_app подключен' || echo 'hnyear_app уже подключен' && echo '' && echo '[7/8] Проверка доступности из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[8/8] Перезагрузка nginx...' && cd /opt/newava && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Финальный статус контейнеров:' && cd /opt/hnyear && docker compose ps && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

