@echo off
REM Simple deployment script using SSH
REM This will prompt for password

echo ========================================
echo Deploying avatar branch to production
echo ========================================
echo.

echo Connecting to server...
echo You will be prompted for password: Yd2Vc_Wejus0DlNB
echo.

ssh root@43.245.226.24 "cd /opt/newava && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && docker compose up -d --build"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Deployment completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Deployment failed!
    echo ========================================
    exit /b 1
)

