@echo off
chcp 65001 >nul
REM Проверка логов генерации изображений

echo ========================================
echo Проверка логов генерации изображений
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== Последние 100 строк логов backend ===' && cd /opt/hnyear && docker compose logs --tail=100 backend && echo '' && echo '=== Активные задачи генерации ===' && docker compose exec -T backend node -e \"const { generationQueue, activeJobs } = require('./server/queues/generationQueue.js'); console.log('Queue size:', generationQueue.length); console.log('Active jobs:', activeJobs.size);\" 2>&1 || echo 'Не удалось проверить очередь'"

pause

