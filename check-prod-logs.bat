@echo off
chcp 65001 >nul
REM Скрипт для проверки логов и окружения на проде

echo ========================================
echo Проверка логов и окружения на проде
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

echo [1/5] Проверка статуса контейнеров...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose ps"

echo.
echo [2/5] Проверка последних 50 строк логов backend...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose logs --tail=50 backend"

echo.
echo [3/5] Проверка переменных окружения в контейнере...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose exec -T backend env | grep -E 'GEMINI|ROBOKASSA|PORT|ALLOWED'"

echo.
echo [4/5] Проверка наличия .env файла...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && if [ -f .env ]; then echo 'Файл .env существует'; echo 'Первые строки (без значений):'; head -10 .env | sed 's/=.*/=***/'; else echo 'ФАЙЛ .env НЕ НАЙДЕН!'; fi"

echo.
echo [5/5] Проверка ошибок в логах...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && docker compose logs backend 2>&1 | grep -i 'error\|fail\|exit\|не установлен' | tail -20"

echo.
echo ========================================
echo Проверка завершена!
echo ========================================
echo.
echo Скопируйте весь вывод выше и отправьте мне
echo.
pause

