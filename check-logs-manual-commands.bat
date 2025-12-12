@echo off
chcp 65001 >nul
echo ========================================
echo Команды для проверки логов галереи
echo ========================================
echo.
echo Подключитесь к серверу:
echo   ssh root@43.245.226.24
echo.
echo Пароль: Yd2Vc_Wejus0DlNB
echo.
echo Затем выполните следующие команды:
echo.
echo [1] Проверка последних запросов к галерее:
echo docker logs newava_backend --tail 200 ^| grep -E "Gallery^|Order^|paymentType" ^| tail -50
echo.
echo [2] Проверка последних заказов в БД:
echo docker logs newava_backend --tail 200 ^| grep -E "generatePortraitsForOrder^|saveOrder^|completed" ^| tail -50
echo.
echo [3] Проверка ошибок:
echo docker logs newava_backend --tail 200 ^| grep -E "ERROR^|Error^|error^|Failed^|failed" ^| tail -30
echo.
echo ========================================
echo.
echo Или выполните все команды одной строкой:
echo.
echo docker logs newava_backend --tail 200 ^| grep -E "Gallery^|Order^|paymentType^|generatePortraitsForOrder^|saveOrder^|completed" ^| tail -100
echo.
pause

