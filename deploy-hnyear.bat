@echo off
REM Быстрый деплой ветки new-year на домен hnyear.com
REM Использует общий nginx контейнер из проекта newava

setlocal enabledelayedexpansion
set "ERROR_OCCURRED=0"

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

REM Создаем временный файл со скриптом деплоя
set TEMP_SCRIPT=%TEMP%\deploy-hnyear-%RANDOM%.sh

REM Проверяем, что можем создать временный файл
if not exist "%TEMP%" (
    echo ERROR: Cannot access temp directory: %TEMP%
    pause
    exit /b 1
)

(
echo set -e
echo.
echo echo "Creating app directory: %APP_DIR%"
echo mkdir -p %APP_DIR%
echo cd %APP_DIR%
echo.
echo # Initialize git if needed
echo if [ ! -d .git ]; then
echo     echo "Initializing git repository..."
echo     git init
echo     git remote add origin https://github.com/luckyit-test/AI-Avatar.git
echo fi
echo.
echo # Fetch and checkout new-year branch
echo echo "Fetching and checking out new-year branch..."
echo git fetch origin
echo git checkout %BRANCH% 2^>/dev/null ^|^| git checkout -b %BRANCH% origin/%BRANCH%
echo git pull origin %BRANCH%
echo.
echo echo ""
echo echo "Code updated!"
echo echo "Current branch: $\(git branch --show-current\)"
echo echo "Current commit: $\(git rev-parse --short HEAD\)"
echo echo ""
echo.
echo # Create .env file if it doesn't exist
echo if [ ! -f .env ]; then
echo     echo "Creating .env file..."
echo     cat ^> .env ^<< 'ENVEOF'
echo GEMINI_API_KEY=your_key_here
echo GEMINI_API_KEY_ANALYSIS=your_key_here
echo ALLOWED_ORIGINS=https://hnyear.com,https://www.hnyear.com
echo ROBOKASSA_LOGIN=hnyear.com
echo ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax
echo ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E
echo ROBOKASSA_IS_TEST=0
echo ROBOKASSA_PAYMENT_AMOUNT=100.00
echo ENVEOF
echo     echo ".env file created. Please update GEMINI_API_KEY!"
echo fi
echo.
echo # Create necessary directories
echo echo "Creating directories..."
echo mkdir -p deploy/certbot/www deploy/certbot/conf
echo mkdir -p data
echo.
echo # Use docker-compose.hnyear.yml if it exists
echo if [ -f docker-compose.hnyear.yml ]; then
echo     echo "Using docker-compose.hnyear.yml"
echo     cp docker-compose.hnyear.yml docker-compose.yml
echo else
echo     echo "Updating docker-compose.yml..."
echo     # Backup
echo     cp docker-compose.yml docker-compose.yml.bak 2^>/dev/null ^|^| true
echo     # Update container names
echo     sed -i 's/newava_backend/hnyear_backend/g' docker-compose.yml
echo     sed -i 's/newava_app/hnyear_app/g' docker-compose.yml
echo     sed -i 's/newava_nginx/hnyear_nginx/g' docker-compose.yml
echo     sed -i 's/newava_certbot/hnyear_certbot/g' docker-compose.yml
echo     sed -i 's/newava_network/hnyear_network/g' docker-compose.yml
echo     sed -i 's/newava-backend/hnyear-backend/g' docker-compose.yml
echo     sed -i 's/newava:latest/hnyear:latest/g' docker-compose.yml
echo fi
echo.
echo # Ensure newava_network exists
echo echo "Ensuring network exists..."
echo cd %NEWAVA_DIR%
echo docker compose up -d 2^>/dev/null ^|^| true
echo docker network create newava_network 2^>/dev/null ^|^| true
echo.
echo # Copy nginx config to newava project
echo echo "Copying nginx configuration..."
echo cd %APP_DIR%
echo if [ -f deploy/nginx/conf.d/hnyear.conf ]; then
echo     cp deploy/nginx/conf.d/hnyear.conf %NEWAVA_DIR%/deploy/nginx/conf.d/hnyear.conf
echo     echo "Nginx config copied to newava project"
echo fi
echo.
echo # Build and start containers (without nginx)
echo echo ""
echo echo "Building and starting containers..."
echo cd %APP_DIR%
echo docker compose up -d --build app backend
echo.
echo # Wait for containers
echo echo "Waiting for containers to start..."
echo sleep 5
echo.
echo # Issue SSL certificate (using newava nginx)
echo echo ""
echo echo "Issuing SSL certificate..."
echo cd %NEWAVA_DIR%
echo docker run --rm \
echo   -v %NEWAVA_DIR%/deploy/certbot/conf:/etc/letsencrypt \
echo   -v %NEWAVA_DIR%/deploy/certbot/www:/var/www/certbot \
echo   certbot/certbot:latest certonly --webroot \
echo   -w /var/www/certbot -d %DOMAIN% -d www.%DOMAIN% \
echo   -m %EMAIL% --agree-tos --no-eff-email --non-interactive ^|^| echo "Certificate issue failed, will retry later"
echo.
echo # Reload nginx
echo echo ""
echo echo "Reloading nginx..."
echo docker compose exec -T nginx nginx -t ^&^& docker compose exec -T nginx nginx -s reload ^|^| echo "Nginx reload failed"
echo.
echo echo ""
echo echo "========================================="
echo echo "Deployment complete!"
echo echo "========================================="
echo echo ""
echo echo "Check status:"
echo cd %APP_DIR%
echo docker compose ps
echo echo ""
echo echo "Check logs:"
echo echo "  cd %APP_DIR% ^&^& docker compose logs"
echo echo ""
echo echo "IMPORTANT: Update GEMINI_API_KEY in .env file!"
echo echo "  nano %APP_DIR%/.env"
) > "%TEMP_SCRIPT%"

if not exist "%TEMP_SCRIPT%" (
    echo ERROR: Failed to create temporary script file!
    echo Path: %TEMP_SCRIPT%
    pause
    exit /b 1
)

echo SSH script created: %TEMP_SCRIPT%
echo.

REM Проверяем наличие plink в разных местах
set PLINK_PATH=
where plink >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "delims=" %%i in ('where plink') do set PLINK_PATH=%%i
) else (
    REM Проверяем стандартные пути установки PuTTY
    if exist "C:\Program Files\PuTTY\plink.exe" (
        set PLINK_PATH=C:\Program Files\PuTTY\plink.exe
    ) else if exist "C:\Program Files (x86)\PuTTY\plink.exe" (
        set PLINK_PATH=C:\Program Files (x86)\PuTTY\plink.exe
    ) else if exist "%ProgramFiles%\PuTTY\plink.exe" (
        set PLINK_PATH=%ProgramFiles%\PuTTY\plink.exe
    ) else if exist "%ProgramFiles(x86)%\PuTTY\plink.exe" (
        set PLINK_PATH=%ProgramFiles(x86)%\PuTTY\plink.exe
    )
)

if defined PLINK_PATH (
    echo Found plink.exe at: %PLINK_PATH%
    echo Attempting automatic deployment...
    echo.
    set /p DEPLOY_NOW="Do you want to deploy now? (y/n): "
    if /i "!DEPLOY_NOW!"=="y" (
        echo.
        echo Connecting to server and deploying...
        "%PLINK_PATH%" -ssh %SERVER% -pw %PASSWORD% -m "%TEMP_SCRIPT%"
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo =========================================
            echo Deployment completed successfully!
            echo =========================================
            echo.
            echo Check https://%DOMAIN%
        ) else (
            echo.
            echo =========================================
            echo Deployment failed!
            echo =========================================
            echo.
            echo Please check the error messages above.
            echo You can also try manual deployment (see QUICK_DEPLOY_HNYEAR.md)
        )
    ) else (
        echo Deployment cancelled.
    )
) else (
    echo Plink not found in PATH or standard locations.
    echo.
    echo Searched locations:
    echo   - PATH environment variable
    echo   - C:\Program Files\PuTTY\plink.exe
    echo   - C:\Program Files (x86)\PuTTY\plink.exe
    echo.
    echo Option 1: Add PuTTY to PATH or install from:
    echo   https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
    echo.
    echo Option 2: Manual deployment:
    echo   1. ssh %SERVER%
    echo   2. Password: %PASSWORD%
    echo   3. Copy and paste commands from: %TEMP_SCRIPT%
    echo.
    echo Option 3: Use PowerShell script:
    echo   .\quick-deploy-hnyear.ps1
    echo.
    echo Option 4: Use simple batch file:
    echo   .\deploy-hnyear-simple.bat
    echo.
    pause
)

REM Удаляем временный файл
del "%TEMP_SCRIPT%" >nul 2>&1

echo.
echo =========================================
echo Script finished.
echo =========================================
echo.
pause

endlocal

