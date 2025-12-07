# Инструкция по деплою ветки new-year на домен hnyear.com

## Предварительные требования

1. Домен `hnyear.com` должен быть делегирован на IP сервера `43.245.226.24`
2. DNS записи должны быть настроены (A запись для hnyear.com и www.hnyear.com)
3. SSH доступ к серверу (пароль: `Yd2Vc_Wejus0DlNB`)

## Структура на сервере

- `/opt/newava` - проект для ветки `avatar` (домен `newava.pro`)
- `/opt/hnyear` - проект для ветки `new-year` (домен `hnyear.com`)

## Важно: Конфликт портов

Оба проекта используют порты 80 и 443. Есть два варианта решения:

### Вариант 1: Отдельные порты (рекомендуется для начала)

Nginx для hnyear.com будет использовать порты 8080 (HTTP) и 8443 (HTTPS), а затем настроить основной nginx как reverse proxy.

### Вариант 2: Общий Nginx (более правильное решение)

Использовать один nginx контейнер для обоих доменов, объединив конфигурации.

## Деплой (Вариант 1 - отдельные порты)

### Шаг 1: Подключитесь к серверу

```bash
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB
```

### Шаг 2: Создайте директорию проекта

```bash
mkdir -p /opt/hnyear
cd /opt/hnyear
```

### Шаг 3: Клонируйте репозиторий

```bash
git init
git remote add origin https://github.com/luckyit-test/AI-Avatar.git
git fetch origin
git checkout -b new-year origin/new-year
git pull origin new-year
```

### Шаг 4: Создайте .env файл

```bash
cat > .env << 'EOF'
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY_ANALYSIS=your_gemini_api_key_here
ALLOWED_ORIGINS=https://hnyear.com,https://www.hnyear.com
ROBOKASSA_LOGIN=hnyear.com
ROBOKASSA_PASSWORD1=LUaP7t8lK2Wx1SUc1Oax
ROBOKASSA_PASSWORD2=XZ5g281nZGqZdvNPlV8E
ROBOKASSA_IS_TEST=0
ROBOKASSA_PAYMENT_AMOUNT=100.00
EOF

# Отредактируйте GEMINI_API_KEY
nano .env
```

### Шаг 5: Обновите docker-compose.yml для уникальных имен

```bash
# Создайте backup
cp docker-compose.yml docker-compose.yml.bak

# Обновите имена контейнеров и порты
sed -i 's/newava_backend/hnyear_backend/g' docker-compose.yml
sed -i 's/newava_app/hnyear_app/g' docker-compose.yml
sed -i 's/newava_nginx/hnyear_nginx/g' docker-compose.yml
sed -i 's/newava_certbot/hnyear_certbot/g' docker-compose.yml
sed -i 's/newava_network/hnyear_network/g' docker-compose.yml
sed -i 's/newava-backend/hnyear-backend/g' docker-compose.yml
sed -i 's/newava:latest/hnyear:latest/g' docker-compose.yml

# Измените порты nginx (временно, для тестирования)
sed -i 's/"80:80"/"8080:80"/g' docker-compose.yml
sed -i 's/"443:443"/"8443:443"/g' docker-compose.yml
```

### Шаг 6: Создайте необходимые директории

```bash
mkdir -p deploy/certbot/www deploy/certbot/conf
mkdir -p deploy/nginx/conf.d
mkdir -p data
```

### Шаг 7: Скопируйте конфигурацию nginx

```bash
# Используйте конфигурацию из репозитория
cp deploy/nginx/conf.d/hnyear.conf deploy/nginx/conf.d/app.conf
```

### Шаг 8: Запустите контейнеры (HTTP только)

```bash
docker compose up -d --build app backend nginx
```

### Шаг 9: Получите SSL сертификат

```bash
docker run --rm \
  -v /opt/hnyear/deploy/certbot/conf:/etc/letsencrypt \
  -v /opt/hnyear/deploy/certbot/www:/var/www/certbot \
  certbot/certbot:latest certonly --webroot \
  -w /var/www/certbot -d hnyear.com -d www.hnyear.com \
  -m admin@hnyear.com --agree-tos --no-eff-email
```

### Шаг 10: Настройте основной nginx как reverse proxy

Нужно добавить конфигурацию в `/opt/newava/deploy/nginx/conf.d/` для проксирования запросов с hnyear.com на контейнер hnyear_nginx.

Или лучше: использовать один nginx контейнер для обоих доменов (см. Вариант 2).

## Деплой (Вариант 2 - общий Nginx)

Это более правильное решение - использовать один nginx контейнер для обоих доменов.

### Шаг 1-4: Аналогично Варианту 1

### Шаг 5: Обновите docker-compose.yml

```bash
# Удалите nginx и certbot из docker-compose.yml
# Они будут использоваться из проекта newava
```

Или создайте docker-compose.yml без nginx:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    image: hnyear-backend:latest
    container_name: hnyear_backend
    env_file:
      - .env
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_API_KEY_ANALYSIS=${GEMINI_API_KEY_ANALYSIS}
      - PORT=3001
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}
      - ROBOKASSA_LOGIN=${ROBOKASSA_LOGIN:-hnyear.com}
      - ROBOKASSA_PASSWORD1=${ROBOKASSA_PASSWORD1:-LUaP7t8lK2Wx1SUc1Oax}
      - ROBOKASSA_PASSWORD2=${ROBOKASSA_PASSWORD2:-XZ5g281nZGqZdvNPlV8E}
      - ROBOKASSA_IS_TEST=${ROBOKASSA_IS_TEST:-0}
      - ROBOKASSA_PAYMENT_AMOUNT=${ROBOKASSA_PAYMENT_AMOUNT:-100.00}
    restart: unless-stopped
    volumes:
      - ./data:/data
    networks:
      - newava_network  # Используем общую сеть

  app:
    build: .
    image: hnyear:latest
    container_name: hnyear_app
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    restart: unless-stopped
    networks:
      - newava_network  # Используем общую сеть

networks:
  newava_network:
    external: true  # Используем существующую сеть
```

### Шаг 6: Добавьте конфигурацию в основной nginx

Скопируйте `deploy/nginx/conf.d/hnyear.conf` в `/opt/newava/deploy/nginx/conf.d/hnyear.conf`

### Шаг 7: Перезапустите основной nginx

```bash
cd /opt/newava
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

### Шаг 8: Запустите контейнеры hnyear

```bash
cd /opt/hnyear
docker compose up -d --build
```

## Автоматический деплой

Используйте скрипт `deploy-new-year.ps1` для автоматического деплоя:

```powershell
.\deploy-new-year.ps1
```

## Проверка

После деплоя проверьте:

1. Контейнеры запущены:
   ```bash
   docker ps | grep hnyear
   ```

2. Сайт доступен:
   - HTTP: http://hnyear.com (должен редиректить на HTTPS)
   - HTTPS: https://hnyear.com

3. Логи без ошибок:
   ```bash
   cd /opt/hnyear
   docker compose logs app
   docker compose logs backend
   ```

## Обновление кода

Для обновления кода выполните:

```bash
cd /opt/hnyear
git pull origin new-year
docker compose up -d --build
```

## Troubleshooting

### Проблема: Порт уже занят

Если порты 80/443 заняты, используйте Вариант 2 (общий nginx).

### Проблема: SSL сертификат не выдается

Убедитесь, что:
- Домен делегирован правильно
- DNS записи настроены
- Порты 80 и 443 открыты в firewall

### Проблема: Контейнеры не запускаются

Проверьте логи:
```bash
docker compose logs
```

### Проблема: Backend не отвечает

Проверьте:
- GEMINI_API_KEY установлен в .env
- Контейнер backend запущен
- Сеть настроена правильно

