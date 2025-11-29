# 🚀 ИНСТРУКЦИЯ ПО ДЕПЛОЮ - НАЧНИТЕ ЗДЕСЬ

## Проблема: 404 при настройке секретов

**Важно:** Секреты настраиваются НЕ в ветке, а в **настройках репозитория**!

## 📍 Где настраивать GitHub Secrets:

1. Откройте: **https://github.com/luckyit-test/AI-Avatar**
2. Нажмите вкладку **Settings** (вверху, рядом с "Code", "Issues" и т.д.)
3. В левом меню выберите: **Secrets and variables** → **Actions**
4. Нажмите кнопку **New repository secret**

**Если не видите Settings:**
- У вас нет прав администратора репозитория
- Обратитесь к владельцу репозитория для настройки секретов
- Или используйте прямой деплой (см. ниже)

## 🎯 Самый простой способ деплоя ПРЯМО СЕЙЧАС:

### Вариант 1: Через .bat файл (Windows)

1. Найдите файл `local-deploy.bat` в папке `C:\avatar`
2. Дважды кликните на него
3. Введите пароль когда попросит: `Yd2Vc_Wejus0DlNB`
4. Дождитесь завершения

### Вариант 2: Через PuTTY (если установлен)

1. Найдите файл `deploy-putty.bat` в папке `C:\avatar`
2. Дважды кликните на него
3. Готово! (пароль уже в скрипте)

### Вариант 3: Ручной деплой

Откройте PowerShell и выполните:

```powershell
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB
```

Затем на сервере:

```bash
cd /opt/newava
if [ ! -d .git ]; then git init && git remote add origin https://github.com/luckyit-test/AI-Avatar.git; fi
git fetch origin
git checkout avatar 2>/dev/null || git checkout -b avatar origin/avatar
git pull origin avatar
docker compose up -d --build
docker compose ps
```

## ✅ Что уже настроено:

- ✅ GitHub Actions workflow обновлен для ветки `avatar`
- ✅ При пуше в `avatar` будет автоматический деплой (если секреты настроены)
- ✅ Созданы скрипты для прямого деплоя

## 📚 Подробные инструкции:

- `QUICK_DEPLOY.md` - быстрый старт
- `DEPLOY_SETUP_GUIDE.md` - настройка GitHub Secrets
- `DIRECT_DEPLOY.md` - альтернативные способы деплоя

## 🔍 Проверка после деплоя:

1. Откройте: https://newava.pro/
2. Проверьте логи на сервере:
   ```bash
   ssh root@43.245.226.24
   cd /opt/newava
   docker compose logs --tail 50
   ```

