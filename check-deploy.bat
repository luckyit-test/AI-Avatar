@echo off
chcp 65001 >nul
REM Проверка статуса деплоя на сервере

echo ========================================
echo Проверка статуса деплоя
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Используется PuTTY plink...
    echo.
    plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== ТЕКУЩАЯ ВЕТКА ===' && git branch --show-current && echo '' && echo '=== ПОСЛЕДНИЙ КОММИТ ===' && git log -1 --oneline && echo '' && echo '=== СТАТУС КОНТЕЙНЕРОВ ===' && docker compose ps 2>/dev/null || echo 'Docker Compose не запущен или файл не найден'"
) else (
    echo PuTTY не найден. Используется обычный SSH.
    echo Введите пароль когда попросит: Yd2Vc_Wejus0DlNB
    echo.
    ssh root@43.245.226.24 "cd /opt/newava && echo '=== ТЕКУЩАЯ ВЕТКА ===' && git branch --show-current && echo '' && echo '=== ПОСЛЕДНИЙ КОММИТ ===' && git log -1 --oneline && echo '' && echo '=== СТАТУС КОНТЕЙНЕРОВ ===' && docker compose ps 2>/dev/null || echo 'Docker Compose не запущен или файл не найден'"
)

echo.
echo ========================================
echo Проверка завершена
echo ========================================
echo.
echo Также проверьте сайт: https://newava.pro/
echo.
pause

