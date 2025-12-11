@echo off
chcp 65001 >nul
REM Деплой ветки avatar на прод (исправление)

echo ========================================
echo Деплой ветки avatar на прод
echo ========================================
echo.

echo ТЕКУЩАЯ СИТУАЦИЯ:
echo - На проде: ветка MAIN (старая версия)
echo - Нужно: ветка AVATAR (новая версия)
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

echo Выполнение деплоя ветки avatar...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/7] Инициализация git (если нужно)...' && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo '[2/7] Получение всех веток...' && git fetch origin && echo '[3/7] Сохранение конфигурации hnyear.com (если существует)...' && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then cp deploy/nginx/conf.d/hnyear.conf /tmp/hnyear.conf.backup && echo 'Конфигурация hnyear.com сохранена'; fi && echo '[4/7] Переключение на ветку avatar...' && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && echo '[5/7] Принудительное обновление кода из ветки avatar...' && git reset --hard origin/avatar && echo '[6/7] Восстановление конфигурации hnyear.com (если была сохранена)...' && if [ -f /tmp/hnyear.conf.backup ]; then mkdir -p deploy/nginx/conf.d && cp /tmp/hnyear.conf.backup deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация hnyear.com восстановлена'; elif [ -f deploy/nginx/conf.d/hnyear.conf ]; then echo 'Конфигурация hnyear.com уже существует в ветке avatar'; else echo 'ВНИМАНИЕ: Конфигурация hnyear.com не найдена!'; fi && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git log -1 --oneline) && echo '=========================================' && echo '' && echo '[7/7] Пересборка и перезапуск контейнеров...' && docker compose down && docker compose up -d --build && echo '' && echo 'Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo 'Статус контейнеров:' && docker compose ps"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Деплой завершен успешно!
    echo ========================================
    echo.
    echo Теперь на проде должна быть ветка AVATAR
    echo Проверьте: запустите check-prod-branch.bat
    echo.
    echo Также проверьте сайт: https://newava.pro/
) else (
    echo.
    echo ========================================
    echo Ошибка при деплое!
    echo ========================================
)

echo.
pause

