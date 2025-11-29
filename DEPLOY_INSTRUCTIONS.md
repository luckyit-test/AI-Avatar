# Инструкции по деплою ветки avatar

## Статус синхронизации

✅ Локальная папка `C:\avatar` синхронизирована с веткой `avatar` из репозитория.

## Деплой на прод сервер

Для деплоя на сервер выполните следующие команды:

### Вариант 1: Использование скрипта (если установлен expect)

```bash
bash deploy-avatar-branch.sh
```

### Вариант 2: Ручной деплой через SSH

1. Подключитесь к серверу:
```bash
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB
```

2. Выполните команды на сервере:
```bash
cd /opt/newava

# Инициализируем git, если нужно
if [ ! -d .git ]; then
    git init
    git remote add origin https://github.com/luckyit-test/AI-Avatar.git
fi

# Обновляем код из ветки avatar
git fetch origin
git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
git pull origin avatar

# Проверяем текущий коммит
git log -1 --oneline
git branch --show-current

# Пересобираем и перезапускаем контейнеры
docker compose up -d --build

# Проверяем статус
docker compose ps
```

### Вариант 3: Использование PowerShell скрипта

Запустите `deploy-avatar-direct.ps1` и следуйте инструкциям.

## Проверка

После деплоя проверьте:
- Сайт доступен: https://newava.pro/
- Контейнеры запущены: `docker compose ps`
- Логи без ошибок: `docker compose logs`

