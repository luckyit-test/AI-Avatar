@echo off
chcp 65001 >nul
REM Получение логов для конкретного jobId

echo ========================================
echo Получение логов для jobId
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Получаю логи для промежуточного изображения...
echo JobId: job_1764451159791_033ufobwn
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker logs newava_backend --tail 1000 2>&1 | grep -E '(job_1764451159791_033ufobwn|Simple neutral|isIntermediatePrompt.*true|POST /generate-image.*033ufobwn)' | head -50"

echo.
echo.
echo Получаю все логи с finishReason и safetyRatings...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker logs newava_backend --tail 500 2>&1 | grep -E '(finishReason|safetyRatings|IMAGE_OTHER|GENERATION FAILED|GENERATION ERROR)' | tail -30"

echo.
echo.
echo ========================================
echo Логи получены
echo ========================================
echo.
echo Скопируйте вывод выше и отправьте разработчику
echo.

pause

