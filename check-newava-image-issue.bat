@echo off
chcp 65001 >nul
REM Проверка проблемы с загрузкой фото на newava.pro

echo ========================================
echo Проверка проблемы с загрузкой фото
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== [1/5] Проверка переменных окружения CORS ===' && docker compose exec -T backend printenv | grep -i 'ALLOWED_ORIGINS\|CORS' || echo 'Переменные не найдены' && echo '' && echo '=== [2/5] Логи backend (последние 50 строк) ===' && docker compose logs --tail=50 backend && echo '' && echo '=== [3/5] Логи nginx для POST запросов (последние 30 строк) ===' && docker compose logs --tail=100 nginx | grep -i 'POST.*evaluate\|POST.*api' | tail -10 || echo 'Нет POST запросов в логах' && echo '' && echo '=== [4/5] Проверка доступности API ===' && docker compose exec -T backend node -e \"const http = require('http'); http.get('http://localhost:3001/api/health', (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => console.log(d)); });\" 2>&1 || echo 'Health check не выполнен' && echo '' && echo '=== [5/5] Статус контейнеров ===' && docker compose ps"

pause

