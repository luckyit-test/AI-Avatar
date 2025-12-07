@echo off
chcp 65001 >nul
REM Обновление конфигурации nginx на сервере

echo ========================================
echo Обновление конфигурации nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/3] Обновление кода...' && cd /opt/hnyear && git pull origin new-year && echo '' && echo '[2/3] Копирование конфигурации nginx...' && cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация скопирована' && echo '' && echo '[3/3] Проверка и перезагрузка nginx...' && cd /opt/newava && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Конфигурация обновлена!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Конфигурация обновлена успешно!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Ошибка при обновлении!
    echo ========================================
)

echo.
pause

