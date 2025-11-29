@echo off
REM Деплой через PuTTY plink.exe
REM Требуется установленный PuTTY

echo ========================================
echo Деплой через PuTTY
echo ========================================
echo.

REM Проверка наличия plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY:
    echo https://www.putty.org/
    echo.
    echo Или добавьте путь к PuTTY в PATH
    echo.
    pause
    exit /b 1
)

echo Выполнение деплоя...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && if [ ! -d .git ]; then echo 'Инициализация git...' && git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo 'Обновление кода из ветки avatar...' && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен успешно!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git rev-parse --short HEAD) && echo '=========================================' && echo '' && if [ -f docker-compose.yml ]; then echo 'Перезапуск контейнеров...' && docker compose up -d --build && echo '' && echo 'Статус контейнеров:' && docker compose ps; else echo 'docker-compose.yml не найден'; fi"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Деплой завершен успешно!
    echo ========================================
    echo.
    echo Проверьте сайт: https://newava.pro/
) else (
    echo.
    echo ========================================
    echo Ошибка при деплое!
    echo ========================================
)

pause

