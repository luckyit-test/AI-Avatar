@echo off
chcp 65001 >nul
echo ========================================
echo Получение логов сервера
echo ========================================
echo.

echo Получаю логи с сервера...
echo.

curl -s "https://newava.pro/api/logs?limit=200&filter=intermediate" | python -m json.tool

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Ошибка при получении логов.
    echo Убедитесь, что curl и python установлены.
)

echo.
pause

