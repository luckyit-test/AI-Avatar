# 🚀 Быстрая справка для нового агента Cursor

**Проект:** newava.pro - Генерация профессиональных портретов  
**Последнее обновление:** 2025-12-06

---

## 📍 Основная информация

### Репозиторий
- **GitHub:** `https://github.com/luckyit-test/AI-Avatar.git`
- **Рабочая ветка:** `avatar`
- **Основная ветка:** `main`
- **Клонирование:** `git clone https://github.com/luckyit-test/AI-Avatar.git && cd AI-Avatar && git checkout avatar`

### Домены
- **Продакшн:** `https://newava.pro`
- **WWW:** `www.newava.pro` (редирект)
- **IP сервера:** `43.245.226.24`

---

## 🔐 SSH доступ к серверу

```bash
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB
```

**Путь к проекту на сервере:** `/opt/newava`

**Быстрые команды:**
```bash
# Подключение
ssh root@43.245.226.24

# Переход в проект
cd /opt/newava

# Обновление кода
git pull origin avatar

# Перезапуск контейнеров
docker compose restart backend

# Просмотр логов
docker compose logs -f backend
```

---

## 💳 Робокасса (Robokassa)

### Реквизиты
- **Merchant Login:** `newava.pro`
- **Password #1:** `LUaP7t8lK2Wx1SUc1Oax`
- **Password #2:** `XZ5g281nZGqZdvNPlV8E`
- **Test Mode:** `0` (продакшн)
- **Сумма платежа:** `100.00` рублей

### URL коллбэков
- **Result URL:** `https://newava.pro/api/robokassa/result` (POST)
- **Success URL:** `https://newava.pro/payment/success` (GET)
- **Fail URL:** `https://newava.pro/payment/fail` (GET)

### Переменные окружения
```bash
ROBOKASSA_LOGIN=newava.pro
ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax
ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E
ROBOKASSA_IS_TEST=0
ROBOKASSA_PAYMENT_AMOUNT=100.00
```

---

## 🔑 API ключи Gemini

### Где хранятся
- **На сервере:** `/opt/newava/.env`
- **Локально:** `.env.local` (не коммитится)

### Переменные окружения
```bash
GEMINI_API_KEY=<ключ для генерации>
GEMINI_API_KEY_ANALYSIS=<ключ для анализа>
```

**⚠️ ВАЖНО:** Ключи хранятся только в `.env` файле на сервере, не в репозитории!

**Где получить:** https://aistudio.google.com/app/apikey

---

## 🐳 Docker контейнеры

### Структура
1. **backend** - Node.js сервер (порт 3001)
2. **app** - Nginx с фронтендом (порт 80)
3. **nginx** - Reverse proxy (порты 80, 443)
4. **certbot** - SSL сертификаты Let's Encrypt

### Команды
```bash
# Статус контейнеров
docker compose ps

# Пересборка и перезапуск
docker compose up -d --build

# Логи бэкенда
docker compose logs -f backend

# Логи фронтенда
docker compose logs -f app

# Перезапуск конкретного сервиса
docker compose restart backend
```

---

## 📁 Структура проекта

```
avatar/
├── components/          # React компоненты
│   ├── GalleryPage.tsx  # Страница галереи портретов
│   └── GenerationActions.tsx  # Кнопка генерации и промокод
├── server/              # Node.js бэкенд
│   ├── routes/         # API маршруты
│   │   ├── payment.js  # Робокасса интеграция
│   │   └── generation.js  # Генерация портретов
│   ├── db/             # База данных SQLite
│   │   └── orders.js   # Работа с заказами
│   ├── services/       # Бизнес-логика
│   │   ├── portraitGeneration.js  # Генерация портретов
│   │   └── promptBuilder.js  # Построение промптов
│   ├── queues/         # Очереди обработки
│   │   ├── generationQueue.js  # Очередь генерации
│   │   └── analysisQueue.js    # Очередь анализа
│   ├── config/         # Конфигурация
│   │   └── index.js    # Все настройки и лимиты
│   └── index.js        # Главный файл сервера
├── public/              # Статические файлы
│   └── logo-variant-6.svg  # Логотип
├── deploy/             # Конфигурация деплоя
│   └── nginx/          # Nginx конфигурация
├── docker-compose.yml   # Docker Compose
├── Dockerfile          # Dockerfile фронтенда
└── Dockerfile.backend  # Dockerfile бэкенда
```

---

## 🔧 Основные API endpoints

### Генерация
- `POST /api/generate` - Запуск генерации портретов
- `GET /api/job/:id` - Статус задачи генерации
- `GET /api/gallery/orders` - Список портретов для галереи

### Платежи
- `POST /api/payment/create` - Создание платежа
- `POST /api/robokassa/result` - Коллбэк от Робокассы
- `GET /payment/success` - Страница успешной оплаты
- `GET /payment/fail` - Страница ошибки оплаты

### Анализ изображений
- `POST /api/validate-image` - Валидация изображения
- `POST /api/evaluate-image` - Оценка изображения

---

## ⚙️ Лимиты и ограничения

### Генерация изображений
- **Одновременно:** 6 задач (`MAX_CONCURRENT_GENERATIONS`)
- **Размер очереди:** 100 задач (`MAX_QUEUE_SIZE`)
- **RPM лимит:** 15 запросов/минуту (`GEMINI_RPM_LIMIT`)
- **RPS лимит:** 6 запросов/секунду (`MAX_REQUESTS_PER_SECOND`)
- **Размер пакета:** 6 задач (`BATCH_SIZE`)
- **Задержка между пакетами:** 2 секунды

### Анализ изображений
- **Одновременно:** 7 задач (`MAX_CONCURRENT_ANALYSIS`)
- **RPM лимит:** 500 запросов/минуту (`GEMINI_ANALYSIS_RPM_LIMIT`)

**Подробнее:** См. `API_LIMITS_DOCUMENTATION.md`

---

## 🎯 Модель генерации

- **Текущая модель:** `gemini-2.5-flash-image`
- **Конфигурация:** `server/index.js` → `processJob()` → `model: 'gemini-2.5-flash-image'`
- **Альтернативы (тестировались):**
  - `gemini-2.5-pro-image` - не доступна для генерации
  - `gemini-3-pro-image-preview` - требует доработки промптов

**Подробнее:** См. `GEMINI_MODELS_FINDINGS.md`

---

## 🛠️ Локальная разработка

### Требования
- Node.js 20+
- npm 9+
- Git

### Запуск
```bash
# Установка зависимостей
npm install

# Запуск фронтенда (Vite)
npm run dev
# Откроется на http://localhost:5173

# Запуск бэкенда (в отдельном терминале)
cd server
node index.js
# Запустится на http://localhost:3001
```

### Переменные окружения (локально)
Создайте `.env.local` в корне проекта:
```bash
GEMINI_API_KEY=your_key_here
GEMINI_API_KEY_ANALYSIS=your_key_here
```

---

## 📝 Полезные команды Git

```bash
# Проверка текущей ветки
git branch --show-current

# Переключение на рабочую ветку
git checkout avatar

# Обновление кода
git pull origin avatar

# Просмотр изменений
git status
git log --oneline -10

# Коммит и пуш
git add .
git commit -m "Описание изменений"
git push origin avatar
```

---

## 🚨 Частые проблемы и решения

### Проблема: 502 Bad Gateway
**Причина:** Сервер не запускается из-за отсутствующих переменных окружения  
**Решение:**
```bash
ssh root@43.245.226.24
cd /opt/newava
cat .env  # Проверить переменные
docker compose restart backend
docker compose logs backend  # Проверить ошибки
```

### Проблема: Ошибка 400 от Робокассы
**Причина:** Неправильный invoice ID (должен быть числовым)  
**Решение:** Проверить `server/db/orders.js` → `createNextInvId()` - должен возвращать числовой ID

### Проблема: Rate limit ошибки
**Причина:** Превышен лимит запросов к Gemini API  
**Решение:** Проверить `GEMINI_RPM_LIMIT` в `server/config/index.js`, увеличить если нужно

### Проблема: Кнопка "Сгенерировать" не работает на iPhone
**Причина:** Проблемы с touch событиями в iOS Safari  
**Решение:** Проверить `components/GenerationActions.tsx` - должны быть обработчики `onTouchStart`, `onTouchMove`, `onTouchEnd`

---

## 📞 Контакты

- **Email поддержки:** `kuznetsov@i-integrator.com`
- **GitHub:** `https://github.com/luckyit-test/AI-Avatar`

---

## 📚 Дополнительная документация

- **Полная инструкция по настройке:** `SETUP_NEW_PC.md`
- **Лимиты API:** `API_LIMITS_DOCUMENTATION.md`
- **Модели Gemini:** `GEMINI_MODELS_FINDINGS.md`

---

## ✅ Чеклист для нового агента

- [ ] Прочитал `QUICK_REFERENCE.md` (этот файл)
- [ ] Понял структуру проекта
- [ ] Знаю где хранятся пароли и ключи
- [ ] Умею подключаться к серверу по SSH
- [ ] Знаю как обновить код на продакшене
- [ ] Понимаю систему лимитов и очередей
- [ ] Знаю основные API endpoints
- [ ] Умею проверять логи и диагностировать проблемы

---

**💡 Совет:** Начните с чтения `SETUP_NEW_PC.md` для полного понимания проекта, затем используйте этот файл как быструю справку.

