@echo off
chcp 65001 >nul
REM Сырые логи backend-контейнера без фильтрации (для поиска ошибок старта сервера)

echo ========================================
echo СЫРЫЕ ЛОГИ BACKEND (newava_backend)
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Получаю последние 200 строк логов контейнера newava_backend...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB ^
  "docker logs newava_backend --tail 200 2>&1"

echo.
echo ========================================
echo Логи получены
echo ========================================
echo.
echo Скопируйте вывод выше и отправьте разработчику при необходимости.
echo.

pause


