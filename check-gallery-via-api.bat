@echo off
chcp 65001 >nul
echo ========================================
echo Проверка галереи через API (без пароля)
echo ========================================
echo.

echo Открываю диагностический эндпоинт в браузере...
echo.
echo URL: https://newava.pro/api/diagnostics/gallery
echo.

start https://newava.pro/api/diagnostics/gallery

echo.
echo Также можно проверить через curl:
echo curl https://newava.pro/api/diagnostics/gallery
echo.

REM Пробуем получить данные через curl, если установлен
where curl >nul 2>&1
if %errorlevel% == 0 (
    echo.
    echo Получаю данные через curl...
    curl -s https://newava.pro/api/diagnostics/gallery | python -m json.tool 2>nul
    if errorlevel 1 (
        curl -s https://newava.pro/api/diagnostics/gallery
    )
) else (
    echo curl не установлен. Откройте URL в браузере для просмотра данных.
)

echo.
echo ========================================
echo Проверка завершена
echo ========================================
pause

