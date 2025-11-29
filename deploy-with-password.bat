@echo off
chcp 65001 >nul
REM Деплой с автоматической передачей пароля через PuTTY plink
REM Если PuTTY не установлен, будет использован обычный SSH

echo ========================================
echo Деплой ветки avatar на прод сервер
echo ========================================
echo.
echo Сервер: 43.245.226.24
echo.
echo ВАЖНО: Пароль не отображается при вводе!
echo Это нормально - просто введите пароль и нажмите Enter
echo Пароль: Yd2Vc_Wejus0DlNB
echo.
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Используется PuTTY plink (пароль уже встроен)...
    echo.
    plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && if [ ! -d .git ]; then echo 'Инициализация git...' && git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo 'Обновление кода из ветки avatar...' && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git rev-parse --short HEAD) && echo '=========================================' && echo '' && if [ -f docker-compose.yml ]; then echo 'Перезапуск контейнеров...' && docker compose up -d --build && echo '' && echo 'Статус контейнеров:' && docker compose ps; else echo 'docker-compose.yml не найден'; fi"
    
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
    echo PuTTY plink не найден. Используется обычный SSH.
    echo.
    echo ВНИМАНИЕ: При подключении пароль НЕ будет виден при вводе!
    echo Это нормально - просто введите пароль и нажмите Enter.
    echo Пароль: Yd2Vc_Wejus0DlNB
    echo.
    pause
    echo.
    echo Подключение к серверу...
    echo.
    ssh root@43.245.226.24 "cd /opt/newava && if [ ! -d .git ]; then echo 'Инициализация git...' && git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo 'Обновление кода из ветки avatar...' && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git rev-parse --short HEAD) && echo '=========================================' && echo '' && if [ -f docker-compose.yml ]; then echo 'Перезапуск контейнеров...' && docker compose up -d --build && echo '' && echo 'Статус контейнеров:' && docker compose ps; else echo 'docker-compose.yml не найден'; fi"
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo Деплой завершен успешно!
        echo ========================================
    ) else (
        echo.
        echo ========================================
        echo Ошибка при деплое!
        echo ========================================
    )
)

echo.
pause

