@echo off
chcp 65001 >nul
echo ========================================
echo Быстрая проверка деплоя
echo ========================================
echo.

echo [1/3] Проверка доступности сайта...
curl -s -o nul -w "HTTP Status: %{http_code}\n" https://newava.pro/
if %ERRORLEVEL% EQU 0 (
    echo [OK] Сайт доступен!
) else (
    echo [ERROR] Сайт недоступен
)
echo.

echo [2/3] Проверка локального коммита...
git log -1 --oneline
echo.

echo [3/3] Для полной проверки запустите: check-deploy.bat
echo.
echo Или откройте в браузере: https://newava.pro/
echo.

pause

