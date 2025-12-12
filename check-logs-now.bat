@echo off
chcp 65001 >nul
echo ========================================
echo Проверка логов галереи (с паролем)
echo ========================================
echo.
echo Выполняю команды через SSH...
echo Пароль: Yd2Vc_Wejus0DlNB
echo.

REM Используем plink (PuTTY) или ssh с expect, или просто выполняем команды
REM Для Windows лучше использовать PowerShell или plink

echo [1/3] Проверка последних запросов к галерее...
plink -ssh -pw Yd2Vc_Wejus0DlNB root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'Gallery|Order|paymentType' | tail -50" 2>nul
if errorlevel 1 (
    echo plink не найден, используйте SSH вручную или установите PuTTY
    echo.
    echo Выполните вручную:
    echo ssh root@43.245.226.24
    echo docker logs newava_backend --tail 200 ^| grep -E "Gallery^|Order^|paymentType" ^| tail -50
)
echo.

echo [2/3] Проверка последних заказов в БД...
plink -ssh -pw Yd2Vc_Wejus0DlNB root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'generatePortraitsForOrder|saveOrder|completed' | tail -50" 2>nul
echo.

echo [3/3] Проверка ошибок...
plink -ssh -pw Yd2Vc_Wejus0DlNB root@43.245.226.24 "docker logs newava_backend --tail 200 2>&1 | grep -E 'ERROR|Error|error|Failed|failed' | tail -30" 2>nul
echo.

echo ========================================
echo Проверка завершена
echo ========================================
pause

