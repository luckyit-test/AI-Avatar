@echo off
chcp 65001 >nul
REM Получение логов заказов и серверной генерации портретов через SSH

echo ========================================
echo ЛОГИ ЗАКАЗОВ И ГЕНЕРАЦИИ ПОРТРЕТОВ
echo ========================================
echo.

REM Проверяем наличие plink.exe (PuTTY)
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Получаю логи контейнера backend (Robokassa, заказы, генерация портретов)...
echo.

REM Логи по основным этапам:
REM - /api/robokassa/result     -- подтверждение оплаты
REM - generatePortraitsForOrder -- серверная генерация портретов после оплаты
REM - Intermediate image        -- создание промежуточного изображения
REM - Order ... completed/failed -- финальный статус заказа

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB ^
  "docker logs newava_backend --tail 1000 2>&1 | grep -E '(/api/robokassa/result|Robokassa|generatePortraitsForOrder|Intermediate image generated|Order .* completed|Order .* failed)'"

echo.
echo ========================================
echo Логи получены
echo ========================================
echo.
echo Скопируйте вывод выше и отправьте разработчику при необходимости.
echo.

pause


