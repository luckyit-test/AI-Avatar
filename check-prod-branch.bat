@echo off
chcp 65001 >nul
REM Проверка какая ветка на проде

echo ========================================
echo Проверка ветки на проде
echo ========================================
echo.

echo Локальная информация:
echo Ветка: avatar
git log -1 --oneline
echo.

REM Проверяем наличие plink.exe
where plink.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Найден PuTTY plink
    echo.
    echo Проверка ветки на сервере...
    echo.
    plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== ВЕТКА НА ПРОДЕ ===' && git branch --show-current && echo '' && echo '=== ПОСЛЕДНИЙ КОММИТ ===' && git log -1 --oneline && echo '' && echo '=== ХЕШ КОММИТА ===' && git rev-parse HEAD"
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo Проверка завершена успешно!
        echo ========================================
    ) else (
        echo.
        echo ========================================
        echo Ошибка: пароль не подходит или сервер недоступен
        echo ========================================
    )
) else (
    echo [INFO] PuTTY plink не найден
    echo.
    echo Для проверки ветки на проде:
    echo 1. Установите PuTTY: https://www.putty.org/
    echo 2. Или используйте ручное подключение (см. ниже)
    echo.
    echo ========================================
    echo РУЧНАЯ ПРОВЕРКА:
    echo ========================================
    echo.
    echo 1. Откройте PowerShell
    echo 2. Выполните: ssh root@43.245.226.24
    echo 3. Введите пароль (если попросит)
    echo 4. На сервере выполните:
    echo    cd /opt/newava
    echo    git branch --show-current
    echo    git log -1 --oneline
    echo.
)

echo.
echo ========================================
echo СРАВНЕНИЕ:
echo ========================================
echo.
echo Локально:
echo   Ветка: avatar
git log -1 --oneline
echo.
echo На проде: (см. выше)
echo.
echo Если ветка на проде = "avatar" и коммит совпадает - деплой успешен!
echo.

pause

