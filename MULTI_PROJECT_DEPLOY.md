# Деплой нескольких проектов на одном сервере

## Проблема

Два проекта используют один сервер и один nginx контейнер:
- **avatar** (newava.pro) - деплоится в `/opt/newava`
- **new-year** (hnyear.com) - деплоится в `/opt/hnyear`

Оба проекта используют общий nginx контейнер из `/opt/newava`, который читает конфигурации из `/opt/newava/deploy/nginx/conf.d/`.

При деплое одного проекта, конфигурация nginx перезаписывалась и удалялись настройки для другого домена.

## Решение

### Структура конфигураций nginx

В директории `/opt/newava/deploy/nginx/conf.d/` должны быть два файла:
- `app.conf` - конфигурация для `newava.pro`
- `hnyear.conf` - конфигурация для `hnyear.com`

### Скрипты деплоя

Оба скрипта деплоя были обновлены для сохранения и восстановления конфигураций:

#### `deploy-avatar-to-prod.bat`
1. Сохраняет `hnyear.conf` перед деплоем
2. Деплоит ветку `avatar`
3. Восстанавливает `hnyear.conf` после деплоя
4. Проверяет и перезагружает nginx

#### `deploy-new-year-to-prod.bat`
1. Сохраняет `app.conf` перед деплоем
2. Деплоит ветку `new-year`
3. Копирует `hnyear.conf` в `/opt/newava/deploy/nginx/conf.d/`
4. Восстанавливает `app.conf` после деплоя
5. Проверяет и перезагружает nginx

### Восстановление конфигурации

Если конфигурация была случайно удалена, используйте:
```bash
.\restore-hnyear-config.bat
```

Этот скрипт скопирует конфигурацию `hnyear.conf` из `/opt/hnyear` в `/opt/newava/deploy/nginx/conf.d/` и перезагрузит nginx.

## Важные моменты

1. **Конфигурация hnyear.conf в ветке avatar**: Файл `deploy/nginx/conf.d/hnyear.conf` добавлен в ветку `avatar`, чтобы он всегда был доступен при деплое.

2. **Сохранение конфигураций**: Оба скрипта деплоя сохраняют конфигурацию другого проекта перед деплоем и восстанавливают её после.

3. **Проверка nginx**: После каждого деплоя выполняется проверка конфигурации nginx (`nginx -t`) и перезагрузка (`nginx -s reload`).

4. **Docker сети**: Проект `hnyear` использует сеть `newava_network` для подключения к общему nginx контейнеру.

## Проверка работы

После деплоя проверьте:
- https://newava.pro/ - должен показывать проект из ветки `avatar`
- https://hnyear.com/ - должен показывать проект из ветки `new-year`

## Откат изменений

Если что-то пошло не так:
1. Используйте `restore-hnyear-config.bat` для восстановления конфигурации hnyear.com
2. Или вручную скопируйте конфигурацию:
   ```bash
   cp /opt/hnyear/deploy/nginx/conf.d/hnyear.conf /opt/newava/deploy/nginx/conf.d/hnyear.conf
   docker compose -f /opt/newava/docker-compose.yml exec nginx nginx -s reload
   ```

