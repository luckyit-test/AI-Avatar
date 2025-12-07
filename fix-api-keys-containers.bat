@echo off
chcp 65001 >nul
REM Исправление проблемы с API ключами в контейнерах

echo ========================================
echo Исправление API ключей в контейнерах
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo Проблема: Контейнеры не подхватили новые ключи из .env файла
echo Решение: Пересоздаем контейнеры с новыми переменными окружения
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/4] Пересоздание контейнера hnyear_backend...' && cd /opt/hnyear && docker compose down backend && docker compose up -d backend && sleep 5 && echo 'hnyear_backend пересоздан' && echo '' && echo '[2/4] Пересоздание контейнера newava_backend...' && cd /opt/newava && docker compose down backend && docker compose up -d backend && sleep 5 && echo 'newava_backend пересоздан' && echo '' && echo '[3/4] Проверка ключей в контейнерах...' && cd /opt/hnyear && echo 'hnyear_backend:' && docker compose exec -T backend env | grep GEMINI && echo '' && cd /opt/newava && echo 'newava_backend:' && docker compose exec -T backend env | grep GEMINI && echo '' && echo '[4/4] Проверка статуса контейнеров...' && cd /opt/hnyear && docker compose ps backend && cd /opt/newava && docker compose ps backend && echo '' && echo '=========================================' && echo 'Контейнеры пересозданы!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  - https://hnyear.com/' && echo '  - https://newava.pro/'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Контейнеры успешно пересозданы!
    echo ========================================
    echo.
    echo Проверьте сайты:
    echo   - https://hnyear.com/
    echo   - https://newava.pro/
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при пересоздании контейнеров!
    echo ========================================
    echo.
)

pause

