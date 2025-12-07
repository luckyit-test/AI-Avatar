@echo on
REM Отладочная версия deploy-hnyear.bat
REM Показывает все команды и не закрывается при ошибках

setlocal enabledelayedexpansion

set SERVER=root@43.245.226.24
set PASSWORD=Yd2Vc_Wejus0DlNB
set APP_DIR=/opt/hnyear
set NEWAVA_DIR=/opt/newava
set BRANCH=new-year
set DOMAIN=hnyear.com
set EMAIL=admin@hnyear.com

echo =========================================
echo Deploying new-year branch to hnyear.com
echo =========================================
echo.
echo Debug mode: All commands will be shown
echo.

REM Проверяем переменные
echo SERVER=%SERVER%
echo APP_DIR=%APP_DIR%
echo BRANCH=%BRANCH%
echo.

REM Создаем временный файл
set TEMP_SCRIPT=%TEMP%\deploy-hnyear-%RANDOM%.sh
echo TEMP_SCRIPT=%TEMP_SCRIPT%
echo.

REM Проверяем temp директорию
if not exist "%TEMP%" (
    echo ERROR: Cannot access temp directory: %TEMP%
    pause
    exit /b 1
)

echo Temp directory exists: %TEMP%
echo.

REM Создаем простой тестовый скрипт
echo Creating test script...
(
echo echo "Test script"
echo echo "APP_DIR=%APP_DIR%"
) > "%TEMP_SCRIPT%"

if not exist "%TEMP_SCRIPT%" (
    echo ERROR: Failed to create temporary script file!
    echo Path: %TEMP_SCRIPT%
    pause
    exit /b 1
)

echo Script file created successfully!
echo File: %TEMP_SCRIPT%
echo.

REM Проверяем plink
set PLINK_PATH=
where plink >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "delims=" %%i in ('where plink') do set PLINK_PATH=%%i
    echo Found plink in PATH: %PLINK_PATH%
) else (
    echo Plink not found in PATH
    if exist "C:\Program Files\PuTTY\plink.exe" (
        set PLINK_PATH=C:\Program Files\PuTTY\plink.exe
        echo Found plink at: %PLINK_PATH%
    ) else (
        echo Plink not found at C:\Program Files\PuTTY\plink.exe
    )
)

echo.
echo =========================================
echo Debug check completed
echo =========================================
echo.
echo PLINK_PATH=%PLINK_PATH%
echo TEMP_SCRIPT=%TEMP_SCRIPT%
echo.

REM Удаляем тестовый файл
if exist "%TEMP_SCRIPT%" del "%TEMP_SCRIPT%" >nul 2>&1

echo.
echo Press any key to exit...
pause

endlocal

