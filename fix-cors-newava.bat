@echo off
chcp 65001 >nul
REM Исправление CORS для newava.pro

echo ========================================
echo Исправление CORS для newava.pro
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/4] Проверка текущего .env файла...' && grep -i 'ALLOWED_ORIGINS' .env || echo 'ALLOWED_ORIGINS не найдена' && echo '' && echo '[2/4] Добавление ALLOWED_ORIGINS в .env...' && if ! grep -q '^ALLOWED_ORIGINS=' .env 2>/dev/null; then echo 'ALLOWED_ORIGINS=https://newava.pro,https://www.newava.pro' >> .env && echo 'Добавлено в .env'; else sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://newava.pro,https://www.newava.pro|' .env && echo 'Обновлено в .env'; fi && echo '' && echo '[3/4] Проверка обновленного .env...' && grep -i 'ALLOWED_ORIGINS' .env && echo '' && echo '[4/4] Перезапуск backend...' && docker compose restart backend && echo 'Ожидание запуска backend...' && sleep 5 && echo '' && echo '=========================================' && echo 'CORS исправлен!' && echo '=========================================' && echo '' && echo 'Проверьте сайт: https://newava.pro/' && echo 'Попробуйте загрузить фото'"

pause

