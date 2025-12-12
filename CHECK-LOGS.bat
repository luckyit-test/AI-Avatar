@echo off
chcp 65001 >nul
cls
echo ========================================
echo ПРОВЕРКА ЛОГОВ ГАЛЕРЕИ
echo ========================================
echo.
echo Выполните следующие команды вручную:
echo.
echo 1. Откройте командную строку или PowerShell
echo 2. Подключитесь к серверу:
echo    ssh root@43.245.226.24
echo.
echo 3. Введите пароль: Yd2Vc_Wejus0DlNB
echo.
echo 4. Выполните команды:
echo.
echo ========================================
echo КОМАНДА 1: Проверка галереи и заказов
echo ========================================
echo docker logs newava_backend --tail 300 ^| grep -E "Gallery Recent^|Order.*paymentType^|saveOrder.*completed^|generatePortraitsForOrder.*saved" ^| tail -50
echo.
echo ========================================
echo КОМАНДА 2: Все логи галереи
echo ========================================
echo docker logs newava_backend --tail 200 ^| grep -E "Gallery" ^| tail -30
echo.
echo ========================================
echo КОМАНДА 3: Последние завершенные заказы
echo ========================================
echo docker logs newava_backend --tail 200 ^| grep -E "generatePortraitsForOrder.*completed^|saveOrder.*completed" ^| tail -20
echo.
echo ========================================
echo КОМАНДА 4: Проверка paymentType
echo ========================================
echo docker logs newava_backend --tail 200 ^| grep -E "paymentType" ^| tail -20
echo.
echo ========================================
echo КОМАНДА 5: Ошибки
echo ========================================
echo docker logs newava_backend --tail 200 ^| grep -E "ERROR^|Error^|Failed" ^| tail -20
echo.
echo ========================================
echo.
echo Или выполните все одной командой:
echo docker logs newava_backend --tail 300 ^| grep -E "Gallery^|Order.*paymentType^|saveOrder^|generatePortraitsForOrder^|completed^|ERROR" ^| tail -100
echo.
pause

