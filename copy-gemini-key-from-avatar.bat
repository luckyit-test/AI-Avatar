@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM Копирование GEMINI_API_KEY из проекта avatar (newava) в hnyear

echo ========================================
echo Копирование GEMINI_API_KEY из avatar
echo ========================================
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

echo Копирование GEMINI_API_KEY из /opt/newava/.env в /opt/hnyear/.env...
echo.
echo Выполнение команды на сервере...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/5] Проверка наличия файла .env в проекте avatar...' && if [ ! -f /opt/newava/.env ]; then echo 'ОШИБКА: Файл /opt/newava/.env не найден!' && exit 1; fi && echo 'Файл найден' && echo '' && echo '[2/5] Извлечение GEMINI_API_KEY из /opt/newava/.env...' && AVATAR_KEY=$(grep '^GEMINI_API_KEY=' /opt/newava/.env | cut -d'=' -f2- | head -1) && if [ -z \"$AVATAR_KEY\" ] || [ \"$AVATAR_KEY\" = \"your_key_here\" ]; then echo 'ОШИБКА: GEMINI_API_KEY не найден или равен your_key_here в проекте avatar!' && exit 1; fi && echo 'Ключ найден' && echo '' && echo '[3/5] Обновление /opt/hnyear/.env...' && cd /opt/hnyear && sed -i \"s|GEMINI_API_KEY=.*|GEMINI_API_KEY=$AVATAR_KEY|\" .env && sed -i \"s|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=$AVATAR_KEY|\" .env && echo 'API ключи обновлены' && echo '' && echo '[4/5] Проверка обновленных значений...' && grep 'GEMINI_API_KEY' .env | sed 's/=.*/=***/' && echo '' && echo '[5/5] Перезапуск backend контейнера...' && docker compose restart backend && echo 'Ожидание запуска backend...' && sleep 5 && echo '' && echo 'Проверка статуса backend...' && docker compose ps backend && echo '' && echo '=========================================' && echo 'Ключ успешно скопирован!' && echo '========================================='"

set EXIT_CODE=%ERRORLEVEL%

echo.
echo ========================================
if %EXIT_CODE% EQU 0 (
    echo GEMINI_API_KEY успешно скопирован!
    echo ========================================
    echo.
    echo Backend перезапущен. Попробуйте загрузить фото снова.
    echo.
) else (
    echo Ошибка при копировании ключа!
    echo ========================================
    echo.
    echo Код ошибки: %EXIT_CODE%
    echo.
    echo Возможные причины:
    echo - Файл /opt/newava/.env не существует
    echo - GEMINI_API_KEY не настроен в проекте avatar
    echo - Ошибка подключения к серверу
    echo.
    echo Попробуйте выполнить команду вручную через SSH:
    echo   ssh root@43.245.226.24
    echo   cd /opt/hnyear
    echo   grep GEMINI_API_KEY /opt/newava/.env
    echo.
)

pause
endlocal

