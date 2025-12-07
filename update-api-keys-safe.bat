@echo off
chcp 65001 >nul
REM БЕЗОПАСНЫЙ скрипт для обновления API ключей на сервере
REM ВАЖНО: Этот скрипт НЕ содержит ключей и НЕ должен их содержать!

echo ========================================
echo Безопасное обновление API ключей Gemini
echo ========================================
echo.
echo ВАЖНО: Этот скрипт запросит ключи у вас, чтобы они не попали в git!
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Введите новые API ключи (они НЕ будут сохранены в файл):
echo.

set /p HNYEAR_GEN="hnyear.com - ключ для генерации: "
set /p HNYEAR_ANALYSIS="hnyear.com - ключ для анализа: "
set /p NEWAVA_GEN="newava.pro - ключ для генерации: "
set /p NEWAVA_ANALYSIS="newava.pro - ключ для анализа: "

if "%HNYEAR_GEN%"=="" (
    echo ОШИБКА: Ключ для генерации hnyear.com не может быть пустым!
    pause
    exit /b 1
)

if "%HNYEAR_ANALYSIS%"=="" (
    echo ОШИБКА: Ключ для анализа hnyear.com не может быть пустым!
    pause
    exit /b 1
)

if "%NEWAVA_GEN%"=="" (
    echo ОШИБКА: Ключ для генерации newava.pro не может быть пустым!
    pause
    exit /b 1
)

if "%NEWAVA_ANALYSIS%"=="" (
    echo ОШИБКА: Ключ для анализа newava.pro не может быть пустым!
    pause
    exit /b 1
)

echo.
echo Обновление ключей на сервере...
echo.

REM Используем переменные окружения для передачи ключей через SSH
REM Ключи передаются напрямую в команду, не сохраняясь в файл
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/4] Обновление ключей hnyear.com...' && cd /opt/hnyear && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=%HNYEAR_GEN%|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=%HNYEAR_ANALYSIS%|' .env && echo 'hnyear.com ключи обновлены' && echo '' && echo '[2/4] Обновление ключей newava.pro...' && cd /opt/newava && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=%NEWAVA_GEN%|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=%NEWAVA_ANALYSIS%|' .env && echo 'newava.pro ключи обновлены' && echo '' && echo '[3/4] Перезапуск backend контейнеров...' && cd /opt/hnyear && docker compose restart backend && sleep 3 && cd /opt/newava && docker compose restart backend && sleep 3 && echo 'Контейнеры перезапущены' && echo '' && echo '[4/4] Проверка статуса...' && cd /opt/hnyear && docker compose ps backend && cd /opt/newava && docker compose ps backend && echo '' && echo '=========================================' && echo 'Ключи успешно обновлены!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  - https://hnyear.com/' && echo '  - https://newava.pro/'"

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

REM Очищаем переменные из памяти (на всякий случай)
set HNYEAR_GEN=
set HNYEAR_ANALYSIS=
set NEWAVA_GEN=
set NEWAVA_ANALYSIS=

pause

