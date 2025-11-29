@echo off
chcp 65001 >nul
REM Получение логов сервера через SSH

echo ========================================
echo Получение логов сервера
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

echo Получаю последние логи бэкенда...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker logs newava_backend --tail 300 2>&1 | grep -E '(intermediate|Intermediate|finishReason|IMAGE_OTHER|GENERATION|processJob|POST /generate-image)' | tail -100"

echo.
echo.
echo ========================================
echo Логи получены
echo ========================================
echo.
echo Скопируйте вывод выше и отправьте разработчику
echo.

pause

