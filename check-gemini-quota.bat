@echo off
chcp 65001 >nul
REM Проверка проблемы с квотой Gemini API

echo ========================================
echo Проверка проблемы с квотой Gemini API
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Проверка логов backend на ошибки 429 (квота)...' && docker compose logs --tail=100 backend 2>&1 | grep -i '429\|quota\|RESOURCE_EXHAUSTED' | tail -5 || echo 'Нет ошибок квоты' && echo '' && echo '[2/3] Проверка POST запросов к evaluate-image...' && docker compose logs --tail=100 backend 2>&1 | grep -i 'evaluate-image\|POST.*evaluate' | tail -5 || echo 'Нет POST запросов' && echo '' && echo '[3/3] Проверка логов nginx для POST запросов...' && docker compose logs --tail=100 nginx 2>&1 | grep -i 'POST.*evaluate\|POST.*api' | tail -5 || echo 'Нет POST запросов в nginx' && echo '' && echo '=========================================' && echo 'ВАЖНО: Если видите ошибки 429 - это проблема с квотой Gemini API' && echo 'Нужно проверить квоту на https://ai.dev/usage?tab=rate-limit' && echo '========================================='"

pause


