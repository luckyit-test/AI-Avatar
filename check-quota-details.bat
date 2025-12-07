@echo off
chcp 65001 >nul
REM Детальная проверка ошибок квоты

echo ========================================
echo Детальная проверка ошибок квоты
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Типы квот в ошибке...' && docker compose logs --tail=20 backend 2>&1 | grep -o 'quotaId:[^,}]*' | sort -u && echo '' && echo '[2/3] Метрики квот...' && docker compose logs --tail=20 backend 2>&1 | grep -o 'Quota exceeded for metric:[^\\\\]*' | sort -u && echo '' && echo '[3/3] Время восстановления...' && docker compose logs --tail=20 backend 2>&1 | grep -o 'Please retry in [0-9.]*s' | tail -1 && echo '' && echo '=========================================' && echo 'ВАЖНО:' && echo '  - Если видите FreeTier - проверьте настройки проекта' && echo '  - Проверьте биллинг в Google Cloud Console' && echo '  - Убедитесь что API ключ привязан к платному плану' && echo '========================================='"

pause

