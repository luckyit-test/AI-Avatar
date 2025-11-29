@echo off
REM Локальный скрипт для деплоя ветки avatar на прод сервер
REM Использование: просто запустите этот файл

echo ========================================
echo Деплой ветки avatar на прод сервер
echo ========================================
echo.
echo Сервер: 43.245.226.24
echo Пользователь: root
echo.
echo ========================================
echo ВАЖНО: Пароль НЕ будет виден при вводе!
echo ========================================
echo.
echo Это нормальное поведение SSH для безопасности.
echo Просто введите пароль (ничего не будет видно)
echo и нажмите Enter.
echo.
echo Пароль: Yd2Vc_Wejus0DlNB
echo.
echo ========================================
echo.
echo Нажмите любую клавишу для продолжения...
pause >nul
echo.
echo Подключение к серверу...
echo.
echo >>> СЕЙЧАС ВВЕДИТЕ ПАРОЛЬ (символы не будут видны):
echo >>> Yd2Vc_Wejus0DlNB
echo >>> Затем нажмите Enter
echo.

echo.
echo Подключение к серверу и выполнение деплоя...
echo.

ssh root@43.245.226.24 "cd /opt/newava && if [ ! -d .git ]; then echo 'Инициализация git...' && git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && echo 'Обновление кода...' && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && echo '' && echo '=========================================' && echo 'Код обновлен!' && echo 'Ветка: '$(git branch --show-current) && echo 'Коммит: '$(git rev-parse --short HEAD) && echo '=========================================' && echo '' && if [ -f docker-compose.yml ]; then echo 'Перезапуск контейнеров...' && docker compose up -d --build && echo '' && echo 'Статус контейнеров:' && docker compose ps; else echo 'docker-compose.yml не найден'; fi"

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
    echo.
    echo Проверьте:
    echo 1. Правильность пароля
    echo 2. Доступность сервера
    echo 3. Наличие SSH клиента
)

pause

