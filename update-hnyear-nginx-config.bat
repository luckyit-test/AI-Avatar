@echo off
chcp 65001 >nul
REM Обновление конфигурации nginx для hnyear.com

echo ========================================
echo Обновление конфигурации nginx для hnyear.com
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '[1/4] Копирование новой конфигурации...' && cd /opt/newava && git pull origin new-year && echo '' && echo '[2/4] Копирование hnyear.conf в nginx...' && cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация скопирована' && echo '' && echo '[3/4] Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && echo '' && echo '[4/4] Перезагрузка конфигурации nginx...' && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Конфигурация обновлена!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause


