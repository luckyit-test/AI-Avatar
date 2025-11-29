# Прямой деплой без GitHub Actions

Если у вас нет доступа к настройке GitHub Secrets, используйте этот метод для деплоя.

## Метод 1: Использование готового скрипта (рекомендуется)

### Вариант A: Через Git Bash (если установлен Git for Windows)

1. Откройте Git Bash
2. Перейдите в папку проекта:
   ```bash
   cd /c/avatar
   ```
3. Запустите скрипт:
   ```bash
   bash deploy-avatar-branch.sh
   ```

### Вариант B: Через WSL (если установлен)

1. Откройте WSL
2. Установите expect (если не установлен):
   ```bash
   sudo apt-get update
   sudo apt-get install -y expect
   ```
3. Перейдите в папку проекта:
   ```bash
   cd /mnt/c/avatar
   ```
4. Запустите скрипт:
   ```bash
   bash deploy-avatar-branch.sh
   ```

### Вариант C: Ручной деплой через SSH

1. Откройте терминал (PowerShell, CMD, или Git Bash)
2. Подключитесь к серверу:
   ```bash
   ssh root@43.245.226.24
   ```
   Пароль: `Yd2Vc_Wejus0DlNB`

3. Выполните команды на сервере:
   ```bash
   cd /opt/newava
   
   # Инициализация git (если нужно)
   if [ ! -d .git ]; then
       git init
       git remote add origin https://github.com/luckyit-test/AI-Avatar.git
   fi
   
   # Обновление кода из ветки avatar
   git fetch origin
   git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
   git pull origin avatar
   
   # Проверка
   echo "Branch: $(git branch --show-current)"
   echo "Commit: $(git rev-parse --short HEAD)"
   
   # Перезапуск контейнеров
   if [ -f docker-compose.yml ]; then
       docker compose up -d --build
       docker compose ps
   fi
   ```

## Метод 2: Автоматизация через локальный скрипт

Создайте файл `local-deploy.bat`:

```batch
@echo off
echo Deploying avatar branch to production...
echo.
echo You will be prompted for password: Yd2Vc_Wejus0DlNB
echo.

ssh root@43.245.226.24 "cd /opt/newava && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && docker compose up -d --build && docker compose ps"
```

Запустите: `local-deploy.bat`

## Метод 3: Использование PuTTY (plink.exe)

1. Скачайте и установите PuTTY: https://www.putty.org/
2. Создайте файл `deploy-putty.bat`:

```batch
@echo off
echo Deploying to production...
plink.exe -ssh root@43.245.226.24 -pw Yd2Vc_Wejus0DlNB "cd /opt/newava && if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi && git fetch origin && git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar && git pull origin avatar && docker compose up -d --build && docker compose ps"
```

3. Запустите `deploy-putty.bat`

## Проверка деплоя

После выполнения любого из методов:

1. Проверьте сайт: https://newava.pro/
2. Проверьте статус контейнеров на сервере:
   ```bash
   ssh root@43.245.226.24
   cd /opt/newava
   docker compose ps
   docker compose logs --tail 50
   ```

