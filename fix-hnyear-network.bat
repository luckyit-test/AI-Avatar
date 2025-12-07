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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/6] Проверка статуса контейнеров hnyear...' && cd /opt/hnyear && docker compose ps && echo '' && echo '[2/6] Проверка сети newava_network...' && docker network ls | grep newava_network && echo '' && echo '[3/6] Проверка подключения контейнеров к сети...' && docker network inspect newava_network --format '{{range \$key, \$value := .Containers}}{{printf \"%s\\n\" \$value.Name}}{{end}}' 2>&1 | grep -E 'hnyear|newava' || echo 'Контейнеры не найдены в сети' && echo '' && echo '[4/6] Подключение контейнеров к сети newava_network...' && docker network connect newava_network hnyear_backend 2>&1 && echo 'hnyear_backend подключен' || echo 'hnyear_backend уже подключен или ошибка' && docker network connect newava_network hnyear_app 2>&1 && echo 'hnyear_app подключен' || echo 'hnyear_app уже подключен или ошибка' && echo '' && echo '[5/6] Проверка доступности из nginx...' && docker exec newava_nginx getent hosts hnyear_backend && docker exec newava_nginx getent hosts hnyear_app && echo '' && echo '[6/6] Перезагрузка nginx...' && cd /opt/newava && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Исправление завершено!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

