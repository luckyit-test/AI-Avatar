@echo off
chcp 65001 >nul
REM Восстановление конфигурации hnyear.com на сервере

echo ========================================
echo Восстановление конфигурации hnyear.com
echo ========================================
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ОШИБКА: plink.exe не найден!
    echo.
    echo Установите PuTTY: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo Восстановление конфигурации nginx для hnyear.com...
echo.

plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '[1/3] Проверка существующей конфигурации...' && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then echo 'Конфигурация hnyear.conf уже существует'; else echo '[2/3] Копирование конфигурации из ветки avatar...' && cd /opt/hnyear && if [ -f deploy/nginx/conf.d/hnyear.conf ]; then mkdir -p /opt/newava/deploy/nginx/conf.d && cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf && echo 'Конфигурация скопирована'; else echo 'ОШИБКА: Конфигурация не найдена в /opt/hnyear'; exit 1; fi; fi && cd /opt/newava && echo '[3/3] Проверка и перезагрузка nginx...' && docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload && echo '' && echo '=========================================' && echo 'Конфигурация восстановлена!' && echo '========================================='"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Конфигурация восстановлена успешно!
    echo ========================================
    echo.
    echo Проверьте сайт: https://hnyear.com/
) else (
    echo.
    echo ========================================
    echo Ошибка при восстановлении!
    echo ========================================
)

echo.
pause

