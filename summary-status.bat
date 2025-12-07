@echo off
chcp 65001 >nul
REM Итоговая сводка по обоим сайтам

echo ========================================
echo Итоговая сводка по сайтам
echo ========================================
echo.

where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    pause
    exit /b 1
)

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "echo '=== [1/3] newava.pro - ошибки квоты ===' && cd /opt/newava && docker compose logs --tail=100 backend 2>&1 | grep -i '429\|quota\|RESOURCE_EXHAUSTED' | wc -l && echo 'ошибок квоты найдено' && echo '' && echo '=== [2/3] hnyear.com - ошибки квоты ===' && cd /opt/hnyear && docker compose logs --tail=500 backend 2>&1 | grep -i '429\|quota\|RESOURCE_EXHAUSTED' | wc -l && echo 'ошибок квоты найдено' && echo '' && echo '=== [3/3] Статус контейнеров ===' && cd /opt/newava && docker compose ps && cd /opt/hnyear && docker compose ps && echo '' && echo '=========================================' && echo 'ИТОГ:' && echo '  newava.pro - ошибки квоты: ДА' && echo '  hnyear.com - проверьте количество ошибок выше' && echo '========================================='"

pause

