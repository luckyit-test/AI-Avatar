@echo off
chcp 65001 >nul
REM Простая проверка логов - выводит всё в консоль

echo ========================================
echo ПРОВЕРКА ЛОГОВ И ОКРУЖЕНИЯ НА ПРОДЕ
echo ========================================
echo.
echo Скопируйте ВЕСЬ вывод ниже и отправьте мне
echo.
echo ========================================
echo.

plink.exe -batch -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== СТАТУС КОНТЕЙНЕРОВ ===' && docker compose ps && echo '' && echo '=== ПОСЛЕДНИЕ 100 СТРОК ЛОГОВ BACKEND ===' && docker compose logs --tail=100 backend 2>&1 && echo '' && echo '=== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (без значений) ===' && docker compose exec -T backend env 2>/dev/null | grep -E 'GEMINI|ROBOKASSA|PORT|ALLOWED' | sed 's/=.*/=***/' && echo '' && echo '=== ПРОВЕРКА .env ФАЙЛА ===' && if [ -f .env ]; then echo 'Файл существует'; ls -lh .env; echo 'Переменные (без значений):'; cat .env | sed 's/=.*/=***/' | head -15; else echo 'ФАЙЛ .env НЕ НАЙДЕН!'; fi"

echo.
echo ========================================
echo ПРОВЕРКА ЗАВЕРШЕНА
echo ========================================
echo.
echo Скопируйте ВЕСЬ текст выше (от === СТАТУС КОНТЕЙНЕРОВ === до конца)
echo и отправьте мне в сообщении
echo.
pause

