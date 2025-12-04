@echo off
echo ========================================
echo ПРОВЕРКА ОШИБОК ЗАПУСКА СЕРВЕРА
echo ========================================
echo.
echo Скопируйте ВЕСЬ вывод ниже и отправьте мне
echo.
echo ========================================
echo === СТАТУС КОНТЕЙНЕРОВ ===
docker-compose ps
echo.
echo ========================================
echo === ПОСЛЕДНИЕ 200 СТРОК ЛОГОВ BACKEND (с фильтром ошибок) ===
docker-compose logs --tail=200 backend 2>&1 | findstr /i /c:"error" /c:"Error" /c:"ERROR" /c:"SyntaxError" /c:"TypeError" /c:"ReferenceError" /c:"Cannot" /c:"failed" /c:"Failed" /c:"FAILED" /c:"exit" /c:"Exit" /c:"EXIT" /c:"🚀" /c:"✅" /c:"❌"
echo.
echo ========================================
echo === ВСЕ ЛОГИ BACKEND (последние 50 строк) ===
docker-compose logs --tail=50 backend
echo.
echo ========================================
echo ПРОВЕРКА ЗАВЕРШЕНА
echo ========================================
echo Скопируйте ВЕСЬ текст выше и отправьте мне

