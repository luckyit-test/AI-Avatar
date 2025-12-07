@echo off
chcp 65001 >nul
REM Проверка статуса генерации на hnyear.com

echo ========================================
echo Проверка статуса генерации hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/hnyear && echo '[1/4] Логи после создания джоба (18:07)...' && docker compose logs --since='2025-12-07T18:07:00' backend 2>&1 | grep -i 'processJob\|PROCESSJOB\|starting.*generation\|calling.*gemini\|completed\|failed\|error\|replaceBackground' | tail -20 && echo '' && echo '[2/4] Все ошибки в логах...' && docker compose logs --since='2025-12-07T18:07:00' backend 2>&1 | grep -i 'error\|failed\|exception' | tail -10 && echo '' && echo '[3/4] Статус очереди генерации...' && docker compose logs --tail=50 backend 2>&1 | grep -i 'queue\|activeJobs\|generationQueue' | tail -5 && echo '' && echo '[4/4] Проверка моделей...' && echo 'newava.pro использует: gemini-2.0-flash (анализ)' && echo 'hnyear.com использует: gemini-2.5-flash-image (генерация)' && echo '' && echo '=========================================' && echo 'ВАЖНО:' && echo '  - Разные модели могут иметь разные квоты' && echo '  - gemini-2.0-flash (анализ) - квота исчерпана' && echo '  - gemini-2.5-flash-image (генерация) - может иметь другую квоту' && echo '========================================='"

pause
