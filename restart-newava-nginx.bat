@echo off
chcp 65001 >nul
REM Перезапуск nginx для newava.pro

echo ========================================
echo Перезапуск nginx для newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Перезапуск nginx через docker compose...' && docker compose restart nginx && echo 'Ожидание запуска...' && sleep 5 && echo '' && echo '[2/3] Проверка конфигурации nginx...' && docker compose exec -T nginx nginx -t && echo '' && echo '[3/3] Перезагрузка nginx...' && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Nginx перезапущен!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://newava.pro/'"

pause

