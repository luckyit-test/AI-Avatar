@echo off
chcp 65001 >nul
REM Скрипт для получения полных логов с прода

echo ========================================
echo Получение полных логов с прода
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

set LOGFILE=prod-logs-%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%.txt
set LOGFILE=%LOGFILE: =0%

echo Сохранение логов в файл: %LOGFILE%
echo.

echo [1/4] Получение статуса контейнеров...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose ps" > %LOGFILE%

echo [2/4] Получение логов backend (последние 200 строк)...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose logs --tail=200 backend" >> %LOGFILE%

echo [3/4] Получение переменных окружения...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== Переменные окружения ===' && docker compose exec -T backend env | grep -E 'GEMINI|ROBOKASSA|PORT|ALLOWED'" >> %LOGFILE%

echo [4/4] Получение информации о .env файле...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== Информация о .env ===' && if [ -f .env ]; then echo 'Файл существует'; ls -lh .env; echo 'Структура (без значений):'; cat .env | sed 's/=.*/=***/' | head -20; else echo 'ФАЙЛ НЕ НАЙДЕН!'; fi" >> %LOGFILE%

echo.
echo ========================================
echo Логи сохранены в файл: %LOGFILE%
echo ========================================
echo.
echo Откройте файл и отправьте его содержимое мне
echo.
pause

