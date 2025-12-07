@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM Обновление GEMINI_API_KEY на сервере

echo ========================================
echo Обновление GEMINI_API_KEY для hnyear
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo ВАЖНО: Убедитесь, что у вас есть реальный GEMINI_API_KEY!
echo.
set /p API_KEY="Введите ваш GEMINI_API_KEY: "

if "!API_KEY!"=="" (
    echo ОШИБКА: API ключ не может быть пустым!
    pause
    exit /b 1
)

echo.
echo Обновление .env файла на сервере...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/hnyear && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=!API_KEY!|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=!API_KEY!|' .env && echo 'API ключи обновлены в .env файле' && echo '' && echo 'Текущие значения:' && grep 'GEMINI_API_KEY' .env | sed 's/=.*/=***/' && echo '' && echo 'Перезапуск backend контейнера...' && docker compose restart backend && echo 'Ожидание запуска backend...' && sleep 5 && echo '' && echo 'Проверка статуса backend...' && docker compose ps backend"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo API ключ успешно обновлен!
    echo ========================================
    echo.
    echo Backend перезапущен. Попробуйте загрузить фото снова.
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при обновлении ключа!
    echo ========================================
    echo.
)

pause
endlocal

