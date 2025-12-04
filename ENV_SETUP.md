# Настройка переменных окружения

## Проблема: 502 Bad Gateway

Если сервер возвращает 502 ошибку, это обычно означает, что:
1. Сервер не запускается из-за отсутствующих переменных окружения
2. Переменные окружения не передаются в Docker контейнер

## Обязательные переменные окружения

### Критически важные (без них сервер не запустится):
- `GEMINI_API_KEY` - API ключ для генерации изображений
- `GEMINI_API_KEY_ANALYSIS` - API ключ для анализа изображений

### Важные (для работы платежей):
- `ROBOKASSA_PASSWORD1` - Пароль #1 для Robokassa
- `ROBOKASSA_PASSWORD2` - Пароль #2 для Robokassa

### Опциональные (есть значения по умолчанию):
- `PORT` - Порт сервера (по умолчанию: 3001)
- `ALLOWED_ORIGINS` - Разрешенные домены для CORS (по умолчанию: *)
- `ROBOKASSA_LOGIN` - Логин Robokassa (по умолчанию: newava.pro)
- `ROBOKASSA_IS_TEST` - Тестовый режим (по умолчанию: 0)
- `ROBOKASSA_PAYMENT_AMOUNT` - Сумма платежа (по умолчанию: 100.00)

## Как проверить переменные на проде

### Вариант 1: Через SSH на сервер
```bash
ssh root@43.245.226.24
cd /opt/newava
cat .env
```

### Вариант 2: Через Docker logs
```bash
ssh root@43.245.226.24
cd /opt/newava
docker compose logs backend | grep -i "ERROR\|переменные\|GEMINI"
```

### Вариант 3: Проверить переменные в контейнере
```bash
ssh root@43.245.226.24
cd /opt/newava
docker compose exec backend env | grep GEMINI
```

## Как установить переменные на проде

### Вариант 1: Создать/обновить .env файл
```bash
ssh root@43.245.226.24
cd /opt/newava
nano .env
```

Добавьте или обновите:
```env
GEMINI_API_KEY=ваш_ключ_здесь
GEMINI_API_KEY_ANALYSIS=ваш_ключ_анализа_здесь
ROBOKASSA_PASSWORD1=ваш_пароль1
ROBOKASSA_PASSWORD2=ваш_пароль2
ROBOKASSA_IS_TEST=0
ALLOWED_ORIGINS=https://newava.pro,https://www.newava.pro
```

### Вариант 2: Обновить docker-compose.yml
Переменные можно установить напрямую в `docker-compose.yml` в секции `environment`:

```yaml
backend:
  environment:
    - GEMINI_API_KEY=${GEMINI_API_KEY}
    - GEMINI_API_KEY_ANALYSIS=${GEMINI_API_KEY_ANALYSIS}
    # ... и т.д.
```

### Вариант 3: Использовать переменные окружения системы
```bash
export GEMINI_API_KEY=ваш_ключ
export GEMINI_API_KEY_ANALYSIS=ваш_ключ_анализа
docker compose up -d --build
```

## После установки переменных

1. Перезапустите контейнеры:
```bash
cd /opt/newava
docker compose down
docker compose up -d --build
```

2. Проверьте логи:
```bash
docker compose logs -f backend
```

Вы должны увидеть:
```
✅ Переменные окружения загружены:
   - GEMINI_API_KEY: ✅ установлен
   - GEMINI_API_KEY_ANALYSIS: ✅ установлен
   ...
🚀 Сервер запущен на порту 3001
```

Если видите ошибки типа:
```
❌ ERROR: GEMINI_API_KEY не установлен в переменных окружения
```

Значит переменные не передаются в контейнер. Проверьте:
1. Существует ли файл `.env` в `/opt/newava/`
2. Правильно ли настроен `docker-compose.yml`
3. Перезапущены ли контейнеры после изменения переменных

## Быстрая проверка

Выполните на проде:
```bash
ssh root@43.245.226.24 "cd /opt/newava && docker compose exec backend node -e \"console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ установлен' : '❌ не установлен'); console.log('GEMINI_API_KEY_ANALYSIS:', process.env.GEMINI_API_KEY_ANALYSIS ? '✅ установлен' : '❌ не установлен')\""
```

