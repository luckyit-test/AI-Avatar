@echo off
REM Скрипт для обновления паролей Robokassa на Windows (для локальной разработки)
REM Для продакшена используйте update-robokassa-passwords.sh на сервере

echo ==========================================
echo ОБНОВЛЕНИЕ ПАРОЛЕЙ ROBOKASSA
echo ==========================================
echo.
echo ВАЖНО: Этот скрипт предназначен для локальной разработки.
echo Для продакшена используйте update-robokassa-passwords.sh на сервере.
echo.
echo Новые пароли:
echo   Пароль 1: LUaP7t8lK2Wx1SUc1Oax
echo   Пароль 2: XZ5g281nZGqZdvNPlV8E
echo   Логин: newava.pro
echo.
echo Для обновления на сервере выполните:
echo   1. Скопируйте update-robokassa-passwords.sh на сервер
echo   2. Выполните: bash update-robokassa-passwords.sh
echo   3. Перезапустите контейнеры: docker compose restart backend
echo.
pause

