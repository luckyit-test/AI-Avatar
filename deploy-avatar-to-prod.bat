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

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/6] Инициализация git (если нужно)...' && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo '[2/6] Получение всех веток...' && git fetch origin && echo '[3/6] Переключение на ветку avatar...' && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && echo '[4/6] Обновление кода из ветки avatar...' && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git log -1 --oneline) && echo '=========================================' && echo '' && echo '[5/6] Пересборка и перезапуск контейнеров...' && docker compose down && docker compose up -d --build && echo '' && echo '[6/6] Статус контейнеров:' && docker compose ps"

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

