@echo off
chcp 65001 >nul
REM Скрипт для обновления API ключей на сервере

echo ========================================
echo Обновление API ключей Gemini
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo Обновление ключей на сервере...
echo.

REM ВАЖНО: НЕ ХРАНИТЕ API КЛЮЧИ В GIT!
REM Используйте переменные окружения или вводите ключи вручную
REM 
REM Пример использования (замените YOUR_KEY на реальный ключ):
REM plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/hnyear && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=YOUR_KEY|' .env"
REM
echo ОШИБКА: Этот скрипт был обновлен для безопасности.
echo API ключи не должны храниться в git!
echo Используйте скрипт вручную или обновите ключи через SSH напрямую.
pause
exit /b 1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Ключи успешно обновлены!
    echo ========================================
    echo.
    echo Проверьте сайты:
    echo   - https://hnyear.com/
    echo   - https://newava.pro/
    echo.
) else (
    echo.
    echo ========================================
    echo Ошибка при обновлении ключей!
    echo ========================================
    echo.
)

pause

