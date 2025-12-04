@echo off
chcp 65001 >nul
echo ========================================
echo ПРОВЕРКА КОНФИГУРАЦИИ NGINX НА ПРОДЕ
echo ========================================
echo.
echo Скопируйте ВЕСЬ вывод ниже и отправьте мне
echo.
echo ========================================
echo.

plink.exe -batch -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== КОНФИГУРАЦИЯ NGINX ===' && cat deploy/nginx/conf.d/app.conf && echo '' && echo '=== ПРОВЕРКА СИНТАКСИСА NGINX ===' && docker compose exec -T nginx nginx -t 2>&1 && echo '' && echo '=== ЛОГИ NGINX (последние 50 строк) ===' && docker compose logs --tail=50 nginx 2>&1"

echo.
echo ========================================
echo ПРОВЕРКА ЗАВЕРШЕНА
echo ========================================
echo.
echo Скопируйте ВЕСЬ текст выше и отправьте мне
echo.
pause

