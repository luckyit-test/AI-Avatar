@echo off
chcp 65001 >nul
REM Получение детальных логов сервера через SSH

echo ========================================
echo Получение детальных логов сервера
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

echo Получаю последние 500 строк логов бэкенда...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "docker logs newava_backend --tail 500 2>&1 | tail -200"

echo.
echo.
echo ========================================
echo Логи получены
echo ========================================
echo.
echo Скопируйте вывод выше и отправьте разработчику
echo.

pause

