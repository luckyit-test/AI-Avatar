@echo off
chcp 65001 >nul
echo ========================================
echo Проверка логов галереи на проде
echo ========================================
echo.

REM Пробуем подключиться с SSH ключом (без пароля)
REM Если SSH ключ не настроен, можно использовать: ssh -o PasswordAuthentication=no root@43.245.226.24

echo [1/3] Проверка последних запросов к галерее...
ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'Gallery|Order|paymentType' | tail -50" 2>nul
if errorlevel 1 (
    echo Ошибка подключения. Возможно, нужен SSH ключ или пароль.
    echo.
    echo Альтернатива: выполните команды вручную через SSH:
    echo   ssh root@43.245.226.24
    echo   docker logs newava_backend --tail 200 ^| grep -E "Gallery^|Order^|paymentType" ^| tail -50
    echo.
    pause
    exit /b 1
)
echo.

echo [2/3] Проверка последних заказов в БД...
ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'generatePortraitsForOrder|saveOrder|completed' | tail -50" 2>nul
echo.

echo [3/3] Проверка ошибок...
ssh -o StrictHostKeyChecking=no root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'ERROR|Error|error|Failed|failed' | tail -30" 2>nul
echo.

echo ========================================
echo Проверка завершена
echo ========================================
echo.
echo Если не удалось подключиться, используйте команды вручную:
echo   ssh root@43.245.226.24
echo   docker logs newava_backend --tail 200 ^| grep -E "Gallery^|Order^|paymentType"
echo.
pause

