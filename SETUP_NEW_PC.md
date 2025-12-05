# Инструкция по развертыванию проекта на новом ПК в Cursor

Эта инструкция поможет быстро настроить проект на новом компьютере с Cursor IDE.

## 📋 Содержание

1. [Репозиторий и доступы](#репозиторий-и-доступы)
2. [Настройка Git и SSH](#настройка-git-и-ssh)
3. [Переменные окружения](#переменные-окружения)
4. [Реквизиты Робокассы](#реквизиты-робокассы)
5. [API ключи](#api-ключи)
6. [Сервер и деплой](#сервер-и-деплой)
7. [Локальная разработка](#локальная-разработка)

---

## 🔗 Репозиторий и доступы

### GitHub репозиторий
- **URL**: `https://github.com/luckyit-test/AI-Avatar.git`
- **Основная ветка**: `main`
- **Рабочая ветка**: `avatar`
- **Ветка для продакшена**: `avatar`

### Клонирование репозитория
```bash
git clone https://github.com/luckyit-test/AI-Avatar.git
cd AI-Avatar
git checkout avatar
```

---

## 🔐 Настройка Git и SSH

### 1. Настройка Git (если еще не настроен)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. Настройка SSH ключа для GitHub

#### Генерация SSH ключа (если нет)
```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
# Нажмите Enter для сохранения в стандартное место (~/.ssh/id_ed25519)
# Введите пароль для ключа (или оставьте пустым)
```

#### Добавление SSH ключа в GitHub
1. Скопируйте публичный ключ:
   ```bash
   # Windows (PowerShell)
   cat ~/.ssh/id_ed25519.pub | clip
   
   # Linux/Mac
   cat ~/.ssh/id_ed25519.pub | pbcopy
   ```

2. Перейдите на GitHub: Settings → SSH and GPG keys → New SSH key
3. Вставьте ключ и сохраните

#### Проверка подключения
```bash
ssh -T git@github.com
# Должно вывести: Hi luckyit-test! You've successfully authenticated...
```

---

## 🌐 Сервер и деплой

### SSH доступ к продакшн серверу

**Сервер:**
- **IP**: `43.245.226.24`
- **Пользователь**: `root`
- **Пароль**: `Yd2Vc_Wejus0DlNB`
- **Порт SSH**: `22` (по умолчанию)

**Подключение:**
```bash
ssh root@43.245.226.24
# Введите пароль при запросе
```

**Путь к проекту на сервере:**
```bash
/opt/newava
```

### Настройка SSH ключа для сервера (опционально, для удобства)

Если хотите подключаться без пароля:

1. Скопируйте публичный ключ на сервер:
   ```bash
   ssh-copy-id root@43.245.226.24
   ```

2. Или вручную:
   ```bash
   cat ~/.ssh/id_ed25519.pub | ssh root@43.245.226.24 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
   ```

---

## 🔑 Переменные окружения

### Файл `.env` на сервере

Создайте файл `/opt/newava/.env` на сервере со следующим содержимым:

```bash
# Gemini API ключи
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY_ANALYSIS=your_gemini_analysis_api_key_here

# CORS настройки
ALLOWED_ORIGINS=*

# Robokassa настройки
ROBOKASSA_LOGIN=newava.pro
ROBOKASSA_PASSWORD1=your_robokassa_password1_here
ROBOKASSA_PASSWORD2=your_robokassa_password2_here
ROBOKASSA_IS_TEST=0
ROBOKASSA_PAYMENT_AMOUNT=100.00

# Порт бэкенда
PORT=3001
```

### Локальный файл `.env.local` (для разработки)

Создайте файл `.env.local` в корне проекта:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

**⚠️ ВАЖНО**: Не коммитьте файлы `.env` и `.env.local` в Git! Они уже в `.gitignore`.

---

## 💳 Реквизиты Робокассы

### Основные параметры

- **Merchant Login**: `newava.pro`
- **Password #1**: (см. ниже - секретные данные)
- **Password #2**: (см. ниже - секретные данные)
- **Test Mode**: `0` (продакшн) или `1` (тест)
- **Сумма платежа**: `100.00` рублей

### URL для коллбэков

- **Result URL**: `https://newava.pro/api/robokassa/result`
- **Success URL**: `https://newava.pro/payment/success`
- **Fail URL**: `https://newava.pro/payment/fail`

### Метод отправки данных

- **Result URL**: `GET` или `POST` (настроено на `POST` с `express.urlencoded`)
- **Success URL**: `GET`
- **Fail URL**: `GET`

### ⚠️ Секретные данные Робокассы

**Password #1** и **Password #2** должны быть получены из:
1. Личного кабинета Робокассы
2. Раздела "Технические настройки"
3. Или у администратора проекта

**Эти данные НЕ должны храниться в открытом виде в репозитории!**

---

## 🔑 API ключи

### Gemini API

Проект использует два ключа Gemini API:

1. **GEMINI_API_KEY** - для генерации портретов
2. **GEMINI_API_KEY_ANALYSIS** - для анализа изображений

**Где получить:**
- Google AI Studio: https://aistudio.google.com/app/apikey
- Или у администратора проекта

**⚠️ ВАЖНО**: API ключи хранятся только на сервере в `.env` файле и НЕ передаются во фронтенд.

---

## 🐳 Docker и деплой

### Структура Docker Compose

Проект использует 4 контейнера:

1. **backend** - Node.js сервер (порт 3001)
2. **app** - Nginx с фронтендом (порт 80)
3. **nginx** - Reverse proxy (порты 80, 443)
4. **certbot** - SSL сертификаты Let's Encrypt

### Команды для деплоя на сервер

```bash
# Подключение к серверу
ssh root@43.245.226.24

# Переход в директорию проекта
cd /opt/newava

# Обновление кода из ветки avatar
git fetch origin
git checkout avatar
git pull origin avatar

# Пересборка и перезапуск контейнеров
docker compose up -d --build

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f backend
```

### Локальный запуск с Docker

```bash
# Создайте .env файл с переменными окружения
cp .env.example .env
# Отредактируйте .env файл

# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f
```

---

## 💻 Локальная разработка

### Требования

- **Node.js**: версия 20 или выше
- **npm**: версия 9 или выше
- **Git**: последняя версия

### Установка зависимостей

```bash
# Установка зависимостей фронтенда и бэкенда
npm install
```

### Запуск в режиме разработки

```bash
# Запуск фронтенда (Vite dev server)
npm run dev
# Откроется на http://localhost:5173

# Запуск бэкенда (в отдельном терминале)
cd server
node index.js
# Запустится на http://localhost:3001
```

### Структура проекта

```
avatar/
├── components/          # React компоненты
├── server/              # Node.js бэкенд
│   ├── routes/         # API маршруты
│   ├── db/             # База данных SQLite
│   ├── services/        # Бизнес-логика
│   └── config/          # Конфигурация
├── public/              # Статические файлы
├── deploy/               # Конфигурация деплоя
│   └── nginx/           # Nginx конфигурация
├── docker-compose.yml    # Docker Compose конфигурация
├── Dockerfile            # Dockerfile для фронтенда
└── Dockerfile.backend    # Dockerfile для бэкенда
```

---

## 🌍 Домены и порты

### Продакшн

- **Домен**: `newava.pro`
- **WWW**: `www.newava.pro` (редирект на основной домен)
- **HTTP**: `http://newava.pro` (редирект на HTTPS)
- **HTTPS**: `https://newava.pro`
- **IP**: `43.245.226.24`

### Локальная разработка

- **Фронтенд**: `http://localhost:5173`
- **Бэкенд API**: `http://localhost:3001`
- **API префикс**: `/api`

---

## 📝 Полезные команды

### Git команды

```bash
# Проверка текущей ветки
git branch --show-current

# Переключение на ветку avatar
git checkout avatar

# Обновление кода
git pull origin avatar

# Просмотр изменений
git status
git log --oneline -10
```

### Docker команды

```bash
# Пересборка конкретного сервиса
docker compose build backend
docker compose build app

# Перезапуск сервиса
docker compose restart backend

# Просмотр логов
docker compose logs -f backend
docker compose logs -f app
docker compose logs -f nginx

# Остановка всех контейнеров
docker compose down

# Удаление всех контейнеров и образов
docker compose down --rmi all
```

### Проверка статуса на сервере

```bash
# Статус контейнеров
docker compose ps

# Последние логи бэкенда
docker compose logs --tail=100 backend

# Проверка переменных окружения
docker compose exec backend env | grep -E "ROBOKASSA|GEMINI"
```

---

## 🔒 Безопасность

### ⚠️ Важные напоминания

1. **НЕ коммитьте** файлы с секретными данными (`.env`, `.env.local`)
2. **НЕ публикуйте** SSH ключи, пароли, API ключи
3. **Используйте** `.gitignore` для исключения чувствительных файлов
4. **Храните** секретные данные только в переменных окружения на сервере
5. **Регулярно обновляйте** пароли и ключи

### Файлы, которые НЕ должны попадать в Git

- `.env`
- `.env.local`
- `*.pem` (приватные ключи)
- `id_rsa`, `id_ed25519` (приватные SSH ключи)
- `*.key` (приватные ключи)

---

## 🆘 Решение проблем

### Проблема: Не могу подключиться к серверу

```bash
# Проверка доступности сервера
ping 43.245.226.24

# Проверка SSH подключения
ssh -v root@43.245.226.24
```

### Проблема: Ошибка при деплое

```bash
# Проверка логов на сервере
docker compose logs backend
docker compose logs nginx

# Проверка переменных окружения
docker compose exec backend env
```

### Проблема: Git не работает

```bash
# Проверка настроек Git
git config --list

# Проверка SSH ключа для GitHub
ssh -T git@github.com
```

---

## 📞 Контакты и поддержка

- **Email поддержки**: `kuznetsov@i-integrator.com`
- **GitHub репозиторий**: `https://github.com/luckyit-test/AI-Avatar`
- **Домен**: `newava.pro`

---

## ✅ Чеклист для нового ПК

- [ ] Установлен Node.js 20+
- [ ] Установлен Git
- [ ] Установлен Docker (для локального запуска)
- [ ] Настроен SSH ключ для GitHub
- [ ] Репозиторий склонирован
- [ ] Ветка `avatar` проверена
- [ ] Создан файл `.env.local` с API ключами
- [ ] Зависимости установлены (`npm install`)
- [ ] Проект запускается локально (`npm run dev`)
- [ ] SSH доступ к серверу настроен
- [ ] Переменные окружения на сервере настроены

---

**Последнее обновление**: 2025-01-04

