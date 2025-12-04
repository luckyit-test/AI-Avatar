@echo off
echo ========================================
echo ПЕРЕЗАПУСК NGINX НА ПРОДАКШН СЕРВЕРЕ
echo ========================================
echo.

echo Подключение к серверу и перезапуск Nginx...
echo.

ssh root@43.245.226.24 "cd /opt/newava && docker compose restart nginx && echo 'Nginx перезапущен успешно' && docker compose ps nginx"

echo.
echo ========================================
echo ГОТОВО
echo ========================================
pause

