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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/4] Обновление ключей hnyear.com...' && cd /opt/hnyear && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=AIzaSyAJbZrYV58Z5HqrljjjmH3rX3rRDoxySQU|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=AIzaSyDvB7OMOxuOBu-s4FG5aijzr_R_2ec-cp8|' .env && echo 'hnyear.com ключи обновлены' && echo '' && echo '[2/4] Обновление ключей newava.pro...' && cd /opt/newava && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=AIzaSyCnfC8NVdq1Tf-bgWR0zqRwKd-DVIOm95A|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=AIzaSyB5UipaYsdRqrxs0d0AMygfKJA7KnucGjQ|' .env && echo 'newava.pro ключи обновлены' && echo '' && echo '[3/4] Перезапуск backend контейнеров...' && cd /opt/hnyear && docker compose restart backend && sleep 3 && cd /opt/newava && docker compose restart backend && sleep 3 && echo 'Контейнеры перезапущены' && echo '' && echo '[4/4] Проверка статуса...' && cd /opt/hnyear && docker compose ps backend && cd /opt/newava && docker compose ps backend && echo '' && echo '=========================================' && echo 'Ключи успешно обновлены!' && echo '=========================================' && echo '' && echo 'Проверьте сайты:' && echo '  - https://hnyear.com/' && echo '  - https://newava.pro/'"

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

