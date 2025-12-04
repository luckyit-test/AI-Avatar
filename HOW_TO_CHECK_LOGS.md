# Как проверить логи и окружение на проде

## Быстрый способ (автоматический)

### Вариант 1: Использовать готовый скрипт
1. Запустите `check-prod-logs.bat` - он автоматически проверит всё и выведет результаты
2. Скопируйте весь вывод из консоли и отправьте мне

### Вариант 2: Получить полные логи в файл
1. Запустите `get-full-logs.bat` - он сохранит все логи в файл
2. Откройте созданный файл `prod-logs-YYYYMMDD-HHMMSS.txt`
3. Скопируйте содержимое файла и отправьте мне

---

## Ручной способ (через SSH)

### Шаг 1: Подключиться к серверу

**Windows (PowerShell или CMD):**
```bash
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB
```

**Или через PuTTY:**
- Host: `43.245.226.24`
- Port: `22`
- Username: `root`
- Password: `Yd2Vc_Wejus0DlNB`

### Шаг 2: Перейти в директорию проекта
```bash
cd /opt/newava
```

### Шаг 3: Проверить статус контейнеров
```bash
docker compose ps
```

**Что смотреть:**
- Статус должен быть `Up` (не `Exited` или `Restarting`)
- Если статус `Exited`, значит контейнер упал

### Шаг 4: Посмотреть логи backend контейнера

**Последние 50 строк:**
```bash
docker compose logs --tail=50 backend
```

**Последние 200 строк (более подробно):**
```bash
docker compose logs --tail=200 backend
```

**Все логи с начала:**
```bash
docker compose logs backend
```

**Только ошибки:**
```bash
docker compose logs backend 2>&1 | grep -i "error\|fail\|exit\|не установлен"
```

**Следить за логами в реальном времени:**
```bash
docker compose logs -f backend
```
(Нажмите `Ctrl+C` чтобы выйти)

### Шаг 5: Проверить переменные окружения

**Проверить переменные в контейнере:**
```bash
docker compose exec backend env | grep -E "GEMINI|ROBOKASSA|PORT|ALLOWED"
```

**Проверить наличие .env файла:**
```bash
ls -la .env
cat .env
```

**Проверить docker-compose.yml:**
```bash
cat docker-compose.yml | grep -A 20 "backend:"
```

### Шаг 6: Проверить, запускается ли сервер

**Попробовать запустить вручную:**
```bash
docker compose exec backend node server/index.js
```

**Или проверить процесс:**
```bash
docker compose exec backend ps aux | grep node
```

---

## Что искать в логах

### ✅ Хорошие признаки:
```
✅ Переменные окружения загружены:
   - GEMINI_API_KEY: ✅ установлен
   - GEMINI_API_KEY_ANALYSIS: ✅ установлен
🚀 Сервер запущен на порту 3001
```

### ❌ Плохие признаки:

**Ошибка переменных окружения:**
```
❌ ERROR: GEMINI_API_KEY не установлен в переменных окружения
```

**Ошибка импорта модуля:**
```
Error: Cannot find module './routes/...'
Error: Cannot resolve './lib/utils'
```

**Ошибка синтаксиса:**
```
SyntaxError: Unexpected token
```

**Ошибка порта:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Контейнер падает:**
```
backend exited with code 1
```

---

## Как скопировать логи и отправить мне

### Способ 1: Через файл (рекомендуется)
1. Выполните команду для сохранения логов:
```bash
docker compose logs --tail=200 backend > /tmp/backend-logs.txt
```

2. Скопируйте файл на локальную машину:
```bash
# В другом терминале на вашей машине:
pscp.exe -pw Yd2Vc_Wejus0DlNB root@43.245.226.24:/tmp/backend-logs.txt ./
```

3. Откройте файл `backend-logs.txt` и отправьте содержимое мне

### Способ 2: Прямое копирование из консоли
1. Выполните команду:
```bash
docker compose logs --tail=200 backend
```

2. Выделите весь текст в консоли (обычно правой кнопкой мыши → Select All)
3. Скопируйте (Ctrl+C или правой кнопкой → Copy)
4. Вставьте в сообщение мне

### Способ 3: Использовать скрипт get-full-logs.bat
1. Запустите `get-full-logs.bat`
2. Откройте созданный файл `prod-logs-*.txt`
3. Скопируйте содержимое и отправьте мне

---

## Быстрая диагностика (одна команда)

Выполните эту команду, чтобы получить всю нужную информацию:

```bash
echo "=== Статус контейнеров ===" && \
docker compose ps && \
echo "" && \
echo "=== Последние 100 строк логов ===" && \
docker compose logs --tail=100 backend && \
echo "" && \
echo "=== Переменные окружения ===" && \
docker compose exec -T backend env | grep -E "GEMINI|ROBOKASSA|PORT" && \
echo "" && \
echo "=== Проверка .env ===" && \
if [ -f .env ]; then echo "Файл существует"; else echo "ФАЙЛ НЕ НАЙДЕН!"; fi
```

Скопируйте весь вывод и отправьте мне.

---

## Если контейнер не запускается

1. **Проверьте, что образ собран:**
```bash
docker images | grep newava-backend
```

2. **Попробуйте пересобрать:**
```bash
docker compose build --no-cache backend
docker compose up -d backend
```

3. **Проверьте логи сборки:**
```bash
docker compose build backend
```

4. **Проверьте, что файлы на месте:**
```bash
ls -la server/
ls -la server/routes/
ls -la server/config/
```

---

## Полезные команды для диагностики

**Перезапустить контейнер:**
```bash
docker compose restart backend
```

**Остановить и запустить заново:**
```bash
docker compose down
docker compose up -d --build
```

**Зайти внутрь контейнера:**
```bash
docker compose exec backend sh
```

**Проверить сеть:**
```bash
docker compose exec backend ping -c 3 google.com
```

**Проверить место на диске:**
```bash
df -h
```

