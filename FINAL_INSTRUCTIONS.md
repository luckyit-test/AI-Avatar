# 🎯 ФИНАЛЬНАЯ ИНСТРУКЦИЯ ПО ДЕПЛОЮ

## ❌ Проблема: 404 при настройке секретов

**Важно:** Секреты настраиваются **НЕ в ветке**, а в **настройках всего репозитория**!

### ✅ Правильный путь к настройке секретов:

1. Откройте репозиторий: **https://github.com/luckyit-test/AI-Avatar**
2. Нажмите вкладку **Settings** (вверху страницы, рядом с "Code", "Issues", "Pull requests")
3. В левом боковом меню выберите: **Secrets and variables** → **Actions**
4. Нажмите кнопку **New repository secret**
5. Добавьте необходимые секреты (список ниже)

### ⚠️ Если не видите вкладку "Settings":

- У вас нет прав администратора репозитория
- Обратитесь к владельцу репозитория для настройки секретов
- Или используйте **прямой деплой** (см. раздел ниже)

---

## 🚀 СПОСОБ 1: Прямой деплой (САМЫЙ ПРОСТОЙ - РАБОТАЕТ СЕЙЧАС)

### Вариант A: Через готовый .bat файл

1. Откройте папку `C:\avatar`
2. Найдите файл **`local-deploy.bat`**
3. **Дважды кликните** на него
4. Когда появится запрос пароля, введите: `Yd2Vc_Wejus0DlNB`
5. Дождитесь завершения

### Вариант B: Через PuTTY (если установлен)

1. Найдите файл **`deploy-putty.bat`**
2. **Дважды кликните** на него
3. Готово! (пароль уже встроен в скрипт)

### Вариант C: Ручной деплой через SSH

1. Откройте PowerShell или CMD
2. Выполните:
   ```bash
   ssh root@43.245.226.24
   ```
3. Введите пароль: `Yd2Vc_Wejus0DlNB`
4. На сервере выполните:
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

---

## 🔧 СПОСОБ 2: Настройка GitHub Actions (для автоматического деплоя)

### Шаг 1: Настройка секретов в GitHub

1. Откройте: **https://github.com/luckyit-test/AI-Avatar/settings/secrets/actions**
2. Нажмите **New repository secret**
3. Добавьте следующие секреты:

#### Обязательные секреты:

| Имя секрета | Значение | Описание |
|------------|----------|-----------|
| `VPS_HOST` | `43.245.226.24` | IP адрес сервера |
| `VPS_USER` | `root` | Пользователь SSH |
| `VPS_SSH_KEY` | *(см. ниже)* | Приватный SSH ключ |
| `GEMINI_API_KEY` | *(ваш ключ)* | Ключ Gemini API |

#### Опциональные секреты:

| Имя секрета | Значение | Описание |
|------------|----------|-----------|
| `VPS_PORT` | `22` | Порт SSH (по умолчанию 22) |
| `APP_DIR` | `/opt/newava` | Путь к приложению на сервере |
| `DOMAIN` | `newava.pro` | Домен для SSL |
| `SSL_EMAIL` | *(ваш email)* | Email для Let's Encrypt |

### Шаг 2: Создание SSH ключа

Если у вас нет SSH ключа, создайте его:

**В PowerShell:**
```powershell
# Создать ключ
ssh-keygen -t rsa -b 4096 -f "$env:USERPROFILE\.ssh\github_deploy" -N '""'

# Показать публичный ключ (нужно добавить на сервер)
Get-Content "$env:USERPROFILE\.ssh\github_deploy.pub"

# Показать приватный ключ (нужно добавить в GitHub Secrets)
Get-Content "$env:USERPROFILE\.ssh\github_deploy"
```

**Добавьте публичный ключ на сервер:**
```bash
ssh root@43.245.226.24
# Пароль: Yd2Vc_Wejus0DlNB

mkdir -p ~/.ssh
echo "ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

**Добавьте приватный ключ в GitHub Secrets:**
- Скопируйте весь приватный ключ (включая `-----BEGIN RSA PRIVATE KEY-----` и `-----END RSA PRIVATE KEY-----`)
- Добавьте в GitHub Secrets как `VPS_SSH_KEY`

### Шаг 3: Проверка автоматического деплоя

После настройки секретов:

1. Перейдите в **Actions**: https://github.com/luckyit-test/AI-Avatar/actions
2. Найдите workflow "deploy"
3. Нажмите **Run workflow** → выберите ветку `avatar` → **Run workflow**

**В будущем:** Каждый коммит и пуш в ветку `avatar` автоматически запустит деплой!

---

## ✅ Что уже сделано:

- ✅ Локальная папка `C:\avatar` синхронизирована с веткой `avatar`
- ✅ GitHub Actions workflow обновлен для автоматического деплоя ветки `avatar`
- ✅ Изменения запушены в репозиторий
- ✅ Созданы скрипты для прямого деплоя:
  - `local-deploy.bat` - простой деплой через SSH
  - `deploy-putty.bat` - деплой через PuTTY
  - `deploy-avatar-branch.sh` - деплой через expect (для Git Bash/WSL)

---

## 🔍 Проверка после деплоя:

1. **Проверьте сайт:** https://newava.pro/
2. **Проверьте статус контейнеров на сервере:**
   ```bash
   ssh root@43.245.226.24
   cd /opt/newava
   docker compose ps
   docker compose logs --tail 50
   ```
3. **Проверьте GitHub Actions** (если настроены секреты):
   https://github.com/luckyit-test/AI-Avatar/actions

---

## 📚 Дополнительные инструкции:

- `README_DEPLOY.md` - главная инструкция
- `QUICK_DEPLOY.md` - быстрый старт
- `DEPLOY_SETUP_GUIDE.md` - детальная настройка GitHub Secrets
- `DIRECT_DEPLOY.md` - альтернативные способы деплоя

---

## 🆘 Если что-то пошло не так:

1. Проверьте доступность сервера: `ping 43.245.226.24`
2. Проверьте SSH подключение: `ssh root@43.245.226.24`
3. Проверьте логи на сервере: `docker compose logs`
4. Проверьте статус контейнеров: `docker compose ps`

---

**Готово! Теперь вы можете деплоить код на прод сервер!** 🎉

