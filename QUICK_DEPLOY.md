# Быстрый деплой - пошаговая инструкция

## ✅ Что уже сделано:

1. ✅ Локальная папка синхронизирована с веткой `avatar`
2. ✅ GitHub Actions workflow обновлен для автоматического деплоя ветки `avatar`
3. ✅ Изменения запушены в репозиторий

## 🚀 Варианты деплоя:

### Вариант 1: Через GitHub Actions (автоматический, требует настройки секретов)

**Где настраивать секреты:**
- ❌ НЕ в ветке
- ✅ В настройках **репозитория**: https://github.com/luckyit-test/AI-Avatar/settings/secrets/actions

**Шаги:**
1. Откройте: https://github.com/luckyit-test/AI-Avatar
2. Нажмите **Settings** (вверху справа, рядом с "Code")
3. В левом меню: **Secrets and variables** → **Actions**
4. Нажмите **New repository secret**
5. Добавьте секреты (см. `DEPLOY_SETUP_GUIDE.md`)

**После настройки:**
- Каждый коммит и пуш в ветку `avatar` автоматически запустит деплой
- Проверьте: https://github.com/luckyit-test/AI-Avatar/actions

### Вариант 2: Прямой деплой (без GitHub Actions)

#### Способ A: Через готовый .bat файл (самый простой)

1. Дважды кликните на файл `local-deploy.bat`
2. Введите пароль когда попросит: `Yd2Vc_Wejus0DlNB`
3. Готово!

#### Способ B: Через PuTTY (если установлен)

1. Дважды кликните на файл `deploy-putty.bat`
2. Готово! (пароль уже в скрипте)

#### Способ C: Через Git Bash (если установлен Git)

1. Откройте Git Bash
2. Выполните:
   ```bash
   cd /c/avatar
   bash deploy-avatar-branch.sh
   ```

#### Способ D: Ручной деплой через SSH

1. Откройте PowerShell или CMD
2. Выполните:
   ```bash
   ssh root@43.245.226.24
   ```
   Пароль: `Yd2Vc_Wejus0DlNB`

3. На сервере выполните:
   ```bash
   cd /opt/newava
   if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi
   git fetch origin
   git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
   git pull origin avatar
   docker compose up -d --build
   docker compose ps
   ```

## 📋 Проверка после деплоя:

1. **Проверьте сайт:** https://newava.pro/
2. **Проверьте статус на сервере:**
   ```bash
   ssh root@43.245.226.24
   cd /opt/newava
   docker compose ps
   docker compose logs --tail 50
   ```

## 🔄 Автоматический деплой в будущем:

После настройки GitHub Secrets (Вариант 1):
- Просто делайте `git commit` и `git push` в ветку `avatar`
- Деплой запустится автоматически через GitHub Actions

Без GitHub Secrets (Вариант 2):
- Используйте `local-deploy.bat` или `deploy-putty.bat` после каждого пуша

