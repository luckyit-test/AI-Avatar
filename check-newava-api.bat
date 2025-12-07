@echo off
chcp 65001 >nul
REM Проверка API newava.pro - почему не приходят POST запросы

echo ========================================
echo Проверка API newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== Проверка доступности API ===' && docker exec newava_backend curl -s http://localhost:3001/api/health 2>&1 || echo 'Health endpoint не доступен' && echo '' && echo '=== Проверка CORS настроек ===' && docker compose logs --tail=20 backend | grep -i 'cors\|allowed_origins' || echo 'Нет логов CORS' && echo '' && echo '=== Проверка логов nginx для POST запросов ===' && docker compose logs --tail=100 nginx | grep -i 'POST.*evaluate\|POST.*api' | tail -10 || echo 'Нет POST запросов в логах' && echo '' && echo '=== Проверка логов backend для POST запросов ===' && docker compose logs --tail=100 backend | grep -i 'evaluate-image\|POST' | tail -10 || echo 'Нет POST запросов в логах backend' && echo '' && echo '=== Статус контейнеров ===' && docker compose ps"

pause

