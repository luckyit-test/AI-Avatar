@echo off
chcp 65001 >nul
REM Прямое обновление конфигурации nginx для hnyear.com

echo ========================================
echo Прямое обновление конфигурации nginx
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

echo Выполнение команд на сервере...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Удаление старой конфигурации...' && rm -f deploy/nginx/conf.d/hnyear.conf && echo '[2/3] Клонирование новой конфигурации из репозитория...' && git fetch origin new-year && git checkout origin/new-year -- deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация обновлена' && echo '' && echo '[3/3] Проверка и перезагрузка nginx...' && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Конфигурация обновлена!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://hnyear.com/'"

pause

