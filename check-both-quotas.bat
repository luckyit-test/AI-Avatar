@echo off
chcp 65001 >nul
REM Проверка квоты Gemini API на обоих сайтах

echo ========================================
echo Проверка квоты Gemini API
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/4] Логи backend newava (ошибки квоты) ===' && cd /opt/newava && docker compose logs --tail=100 backend 2>&1 | grep -i '429\|quota\|RESOURCE_EXHAUSTED' | tail -10 || echo 'Нет ошибок квоты в newava' && echo '' && echo '=== [2/4] Логи backend hnyear (ошибки квоты) ===' && cd /opt/hnyear && docker compose logs --tail=100 backend 2>&1 | grep -i '429\|quota\|RESOURCE_EXHAUSTED' | tail -10 || echo 'Нет ошибок квоты в hnyear' && echo '' && echo '=== [3/4] POST запросы newava (последние 5) ===' && cd /opt/newava && docker compose logs --tail=50 backend 2>&1 | grep -i 'evaluate-image\|POST.*evaluate' | tail -5 || echo 'Нет POST запросов в newava' && echo '' && echo '=== [4/4] Генерация изображений hnyear (последние 5) ===' && cd /opt/hnyear && docker compose logs --tail=50 backend 2>&1 | grep -i 'generate\|prompt\|image.*generation' | tail -5 || echo 'Нет логов генерации в hnyear' && echo '' && echo '=========================================' && echo 'Проверка завершена!' && echo '=========================================' && echo '' && echo 'Если видите ошибки 429 - проверьте квоту на:' && echo '  https://ai.dev/usage?tab=rate-limit'"

pause

