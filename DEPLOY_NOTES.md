# Заметки по деплою hnyear.com

## Один API ключ Gemini на два сервиса

**Это нормально!** Один API ключ можно использовать для нескольких сервисов. Однако:

### Важные моменты:

1. **Лимиты API** - лимиты применяются ко всему ключу, а не к отдельному сервису
   - Если у вас лимит 1000 запросов/день, он делится между обоими сервисами
   - Следите за общим количеством запросов

2. **Рекомендации:**
   - Используйте один ключ для обоих сервисов (newava.pro и hnyear.com)
   - Следите за лимитами в Google Cloud Console
   - При необходимости можно создать отдельные ключи для каждого сервиса

3. **Безопасность:**
   - Храните ключ в `.env` файлах на сервере
   - Не коммитьте ключи в git
   - Используйте разные `.env` файлы для каждого проекта

## Домены

- **hnyear.com** - делегирован на `43.245.226.24` ✅
- **gnyear.com** - не существует (возможно опечатка?)

## SSL и редирект

Конфигурация уже настроена в `deploy/nginx/conf.d/hnyear.conf`:

### Что настроено:

1. **HTTP → HTTPS редирект:**
   - Все запросы на порт 80 редиректятся на HTTPS (кроме ACME challenge)
   - API запросы редиректятся через 307 (сохраняет POST body)

2. **SSL сертификат:**
   - Автоматическое получение через Let's Encrypt
   - Поддержка `hnyear.com` и `www.hnyear.com`

3. **Безопасность:**
   - TLS 1.2 и 1.3
   - Безопасные шифры
   - Security headers

### После деплоя проверьте:

1. **Конфигурация nginx скопирована:**
   ```bash
   ssh root@43.245.226.24
   ls -la /opt/newava/deploy/nginx/conf.d/hnyear.conf
   ```

2. **Nginx перезагружен:**
   ```bash
   cd /opt/newava
   docker compose exec nginx nginx -t
   docker compose exec nginx nginx -s reload
   ```

3. **SSL сертификат получен:**
   ```bash
   ls -la /opt/newava/deploy/certbot/conf/live/hnyear.com/
   ```

4. **Проверка сайта:**
   - HTTP: http://hnyear.com (должен редиректить на HTTPS)
   - HTTPS: https://hnyear.com (должен открываться)

## Troubleshooting

### Сайт не открывается

1. **Проверьте контейнеры:**
   ```bash
   cd /opt/hnyear
   docker compose ps
   ```

2. **Проверьте логи:**
   ```bash
   docker compose logs app
   docker compose logs backend
   ```

3. **Проверьте nginx:**
   ```bash
   cd /opt/newava
   docker compose logs nginx
   docker compose exec nginx nginx -t
   ```

4. **Проверьте конфигурацию:**
   ```bash
   cat /opt/newava/deploy/nginx/conf.d/hnyear.conf
   ```

### SSL сертификат не работает

1. **Проверьте DNS:**
   ```bash
   nslookup hnyear.com
   ```

2. **Получите сертификат вручную:**
   ```bash
   cd /opt/newava
   docker run --rm \
     -v /opt/newava/deploy/certbot/conf:/etc/letsencrypt \
     -v /opt/newava/deploy/certbot/www:/var/www/certbot \
     certbot/certbot:latest certonly --webroot \
     -w /var/www/certbot -d hnyear.com -d www.hnyear.com \
     -m admin@hnyear.com --agree-tos --no-eff-email
   ```

3. **Перезагрузите nginx:**
   ```bash
   docker compose exec nginx nginx -s reload
   ```

