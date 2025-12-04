@echo off
chcp 65001 >nul
echo ========================================
echo ПРОВЕРКА СТАТУСА ГЕНЕРАЦИИ
echo ========================================
echo.
echo Скопируйте ВЕСЬ вывод ниже и отправьте мне
echo.
echo ========================================
echo.

plink.exe -batch -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && echo '=== ПОСЛЕДНИЕ 500 СТРОК ЛОГОВ BACKEND (с фильтром генерации) ===' && docker compose logs --tail=500 backend 2>&1 | grep -E 'generation|Generation|generate|Generate|order|Order|1764874549738' | tail -100 && echo '' && echo '=== ВСЕ ЛОГИ BACKEND (последние 100 строк) ===' && docker compose logs --tail=100 backend 2>&1"

echo.
echo ========================================
echo ПРОВЕРКА ЗАВЕРШЕНА
echo ========================================
echo.
echo Скопируйте ВЕСЬ текст выше и отправьте мне
echo.
pause

