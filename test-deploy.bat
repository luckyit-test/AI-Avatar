@echo off
REM Тестовый скрипт для проверки работы

echo =========================================
echo Test script
echo =========================================
echo.

echo Checking plink...
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
echo Temp directory: %TEMP%
echo.

if defined PLINK_PATH (
    echo PLINK_PATH is set: %PLINK_PATH%
) else (
    echo PLINK_PATH is NOT set
)

echo.
echo =========================================
echo Test completed
echo =========================================
pause

