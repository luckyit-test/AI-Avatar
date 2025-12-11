@echo off
REM Скрипт для установки Telegram бота на продакшн сервере
REM Использует plink для автоматического подключения по SSH

echo ==========================================
echo УСТАНОВКА TELEGRAM БОТА НА СЕРВЕРЕ
echo ==========================================
echo.

set SERVER_IP=43.245.226.24
set SERVER_USER=root
set SERVER_PASSWORD=Yd2Vc_Wejus0DlNB
set TELEGRAM_TOKEN=8492025442:AAGPLjnXzd7WXlHbxTRNdBthKyntmRAri_M

echo [1/5] Добавление токена в .env файл...
plink.exe -batch -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASSWORD% "cd /opt/newava && echo '' >> .env && echo 'TELEGRAM_BOT_TOKEN=%TELEGRAM_TOKEN%' >> .env && echo 'Токен добавлен'"

if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: Не удалось добавить токен
    pause
    exit /b 1
)

echo [2/5] Проверка наличия telegraf...
plink.exe -batch -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASSWORD% "cd /opt/newava && docker compose exec backend npm list telegraf 2>&1 | grep -q telegraf && echo 'telegraf уже установлен' || echo 'telegraf не найден, требуется установка'"

echo [3/5] Установка telegraf в контейнер...
plink.exe -batch -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASSWORD% "cd /opt/newava && docker compose exec backend npm install telegraf"

if %ERRORLEVEL% NEQ 0 (
    echo ПРЕДУПРЕЖДЕНИЕ: Возможны ошибки при установке telegraf, продолжаем...
)

echo [4/5] Перезапуск backend контейнера...
plink.exe -batch -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASSWORD% "cd /opt/newava && docker compose restart backend"

if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: Не удалось перезапустить контейнер
    pause
    exit /b 1
)

echo [5/5] Ожидание запуска и проверка логов...
timeout /t 5 /nobreak >nul
plink.exe -batch -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASSWORD% "cd /opt/newava && docker compose logs backend --tail=50 | grep -E 'Telegram Bot|TELEGRAM|Bot initialized|Bot started|ERROR' | tail -10"

echo.
echo ==========================================
echo УСТАНОВКА ЗАВЕРШЕНА
echo ==========================================
echo.
echo Проверьте логи выше. Должны быть строки:
echo   - "Telegram Bot] Bot initialized successfully"
echo   - "Telegram Bot] Bot started successfully"
echo.
echo Если бот запустился успешно, найдите его в Telegram
echo и отправьте команду /start для тестирования.
echo.
pause

