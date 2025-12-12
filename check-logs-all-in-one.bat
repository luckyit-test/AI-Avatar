@echo off
chcp 65001 >nul
echo ========================================
echo Проверка логов галереи - все команды
echo ========================================
echo.
echo Выполняю все команды одной строкой через SSH...
echo Пароль: Yd2Vc_Wejus0DlNB
echo.

REM Создаем временный скрипт на сервере и выполняем его
ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 300 2>&1 | grep -E 'Gallery|Order|paymentType|generatePortraitsForOrder|saveOrder|completed|ERROR|Error|error|Failed|failed' | tail -100"

echo.
echo ========================================
echo Проверка завершена
echo ========================================
pause

