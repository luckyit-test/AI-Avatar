@echo off
chcp 65001 >nul
echo ========================================
echo Проверка логов галереи на проде
echo ========================================
echo.
echo Выполняю команды через SSH...
echo Пароль будет запрошен автоматически
echo.

echo [1/3] Проверка последних запросов к галерее...
echo Yd2Vc_Wejus0DlNB | ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'Gallery|Order|paymentType' | tail -50"
echo.

echo [2/3] Проверка последних заказов в БД...
echo Yd2Vc_Wejus0DlNB | ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'generatePortraitsForOrder|saveOrder|completed' | tail -50"
echo.

echo [3/3] Проверка ошибок...
echo Yd2Vc_Wejus0DlNB | ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'ERROR|Error|error|Failed|failed' | tail -30"
echo.

echo ========================================
echo Проверка завершена
echo ========================================
pause
