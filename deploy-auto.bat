@echo off
chcp 65001 >nul
REM Автоматический деплой БЕЗ ввода пароля
REM Использует PuTTY plink если доступен, иначе создает SSH ключ

echo ========================================
echo Автоматический деплой ветки avatar
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Найден PuTTY plink - используем автоматический деплой
    echo.
    echo Выполнение деплоя...
    echo.
    
    plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && if [ ! -d .git ]; then echo '[1/5] Инициализация git...' && git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo '[2/5] Получение изменений...' && git fetch origin && echo '[3/5] Переключение на ветку avatar...' && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && echo '[4/5] Обновление кода...' && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git rev-parse --short HEAD) && echo '=========================================' && echo '' && if [ -f docker-compose.yml ]; then echo '[5/5] Перезапуск контейнеров...' && docker compose up -d --build && echo '' && echo 'Статус контейнеров:' && docker compose ps; else echo '[5/5] docker-compose.yml не найден'; fi"
    
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
) else (
    echo [INFO] PuTTY plink не найден
    echo.
    echo Установите PuTTY для автоматического деплоя:
    echo https://www.putty.org/
    echo.
    echo Или используйте deploy-with-password.bat
    echo (там нужно будет ввести пароль вручную)
    echo.
    pause
    exit /b 1
)

echo.
pause

