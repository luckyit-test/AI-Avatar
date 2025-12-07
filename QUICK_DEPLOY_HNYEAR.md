# Быстрый деплой hnyear.com

## Вариант 1: Автоматический деплой (PowerShell)

```powershell
.\quick-deploy-hnyear.ps1
```

Скрипт автоматически:
1. Подключится к серверу
2. Создаст директорию `/opt/hnyear`
3. Склонирует ветку `new-year`
4. Настроит docker-compose
5. Скопирует конфигурацию nginx в проект newava
6. Запустит контейнеры
7. Получит SSL сертификат
8. Перезагрузит nginx

**Важно:** После деплоя обновите `GEMINI_API_KEY` в файле `/opt/hnyear/.env` на сервере!

## Вариант 2: Ручной деплой

### Шаг 1: Подключитесь к серверу

```bash
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB
```

### Шаг 2: Выполните команды

```bash
# Создайте директорию
mkdir -p /opt/hnyear
cd /opt/hnyear

# Клонируйте репозиторий
git init
git remote add origin https://github.com/luckyit-test/AI-Avatar.git
git fetch origin
git checkout -b new-year origin/new-year
git pull origin new-year

# Создайте .env файл
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

# Используйте docker-compose.hnyear.yml
cp docker-compose.hnyear.yml docker-compose.yml

# Создайте директории
mkdir -p deploy/certbot/www deploy/certbot/conf data

# Убедитесь, что сеть существует
cd /opt/newava
docker compose up -d 2>/dev/null || true
docker network create newava_network 2>/dev/null || true

# Скопируйте конфигурацию nginx
cd /opt/hnyear
cp deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf

# Запустите контейнеры
docker compose up -d --build

# Получите SSL сертификат
cd /opt/newava
docker run --rm \
  -v /opt/newava/deploy/certbot/conf:/etc/letsencrypt \
  -v /opt/newava/deploy/certbot/www:/var/www/certbot \
  certbot/certbot:latest certonly --webroot \
  -w /var/www/certbot -d hnyear.com -d www.hnyear.com \
  -m admin@hnyear.com --agree-tos --no-eff-email

# Перезагрузите nginx
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

## Проверка

После деплоя проверьте:

1. **Контейнеры запущены:**
   ```bash
   docker ps | grep hnyear
   ```

2. **Сайт доступен:**
   - https://hnyear.com
   - https://www.hnyear.com

3. **Логи без ошибок:**
   ```bash
   cd /opt/hnyear
   docker compose logs
   ```

## Обновление кода

Для обновления кода выполните:

```bash
cd /opt/hnyear
git pull origin new-year
docker compose up -d --build
```

## Troubleshooting

### Проблема: Контейнеры не запускаются

Проверьте логи:
```bash
cd /opt/hnyear
docker compose logs
```

### Проблема: SSL сертификат не выдается

Убедитесь, что:
- Домен `hnyear.com` делегирован на IP `43.245.226.24`
- DNS записи настроены (A запись для hnyear.com и www.hnyear.com)
- Порты 80 и 443 открыты

### Проблема: Backend не отвечает

Проверьте:
- GEMINI_API_KEY установлен в `.env`
- Контейнер `hnyear_backend` запущен
- Сеть `newava_network` существует

### Проблема: Nginx не видит контейнеры

Убедитесь, что:
- Контейнеры находятся в сети `newava_network`
- Конфигурация nginx скопирована в `/opt/newava/deploy/nginx/conf.d/hnyear.conf`
- Nginx перезагружен после добавления конфигурации

