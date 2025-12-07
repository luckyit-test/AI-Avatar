@echo off
chcp 65001 >nul
REM Пересоздание контейнеров hnyear с правильной сетью

echo ========================================
echo Пересоздание контейнеров hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/7] Остановка и удаление старых контейнеров...' && cd /opt/hnyear && docker compose down && echo '' && echo '[2/7] Проверка существования сети newava_network...' && docker network inspect newava_network >/dev/null 2>&1 && echo 'Сеть существует' || (echo 'Сеть не существует, создаем...' && cd /opt/newava && docker compose up -d 2>/dev/null || true && docker network create newava_network 2>/dev/null || true && echo 'Сеть создана') && echo '' && echo '[3/7] Проверка docker-compose.hnyear.yml...' && cd /opt/hnyear && if [ ! -f docker-compose.hnyear.yml ]; then echo 'ОШИБКА: docker-compose.hnyear.yml не найден!' && exit 1; fi && cp docker-compose.hnyear.yml docker-compose.yml && echo 'docker-compose.yml обновлен' && echo '' && echo '[4/7] Пересборка и запуск контейнеров...' && docker compose up -d --build && echo '' && echo '[5/7] Ожидание запуска контейнеров...' && sleep 8 && echo '' && echo '[6/7] Проверка подключения к сети...' && docker network inspect newava_network --format '{{range \$key, \$value := .Containers}}{{printf \"%s\\n\" \$value.Name}}{{end}}' 2>&1 | grep hnyear && echo '' && echo '[7/7] Проверка доступности из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '=========================================' && echo 'Пересоздание завершено!' && echo '=========================================' && echo '' && echo 'Статус контейнеров:' && docker compose ps && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

