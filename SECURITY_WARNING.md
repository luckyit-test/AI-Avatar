# ⚠️ ВАЖНО: Безопасность API ключей

## ❌ Проблема

API ключи были случайно закоммичены в git репозиторий. Это серьезная проблема безопасности!

## ✅ Что сделано

1. ✅ Удалены ключи из файлов `update-api-keys.bat` и `FIX_PAID_PLAN_QUOTA.md`
2. ⚠️ **НУЖНО**: Создать новые API ключи в Google Cloud Console (старые скомпрометированы)
3. ⚠️ **НУЖНО**: Удалить старые ключи из истории git (если возможно)

## 🔧 Что нужно сделать

### 1. Создать новые API ключи

1. Откройте Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Удалите старые скомпрометированные ключи
3. Создайте новые API ключи для каждого проекта
4. Обновите ключи на сервере через SSH (НЕ через git!)

### 2. Обновить ключи на сервере

```bash
# Подключитесь к серверу
ssh root@43.245.226.24

# Обновите ключи вручную (замените YOUR_NEW_KEY на реальный ключ)
cd /opt/hnyear
nano .env  # или vi .env
# Обновите GEMINI_API_KEY и GEMINI_API_KEY_ANALYSIS

cd /opt/newava
nano .env  # или vi .env
# Обновите GEMINI_API_KEY и GEMINI_API_KEY_ANALYSIS

# Перезапустите контейнеры
cd /opt/hnyear && docker compose restart backend
cd /opt/newava && docker compose restart backend
```

### 3. Удалить ключи из истории git (опционально)

Если репозиторий приватный и вы хотите полностью удалить ключи из истории:

```bash
# ВНИМАНИЕ: Это перепишет историю git!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch update-api-keys.bat FIX_PAID_PLAN_QUOTA.md" \
  --prune-empty --tag-name-filter cat -- --all

# Принудительно отправьте изменения
git push origin --force --all
```

**⚠️ ВНИМАНИЕ**: Используйте `--force` только если вы уверены, что никто другой не работает с репозиторием!

## 📝 Правила безопасности

1. ❌ **НИКОГДА** не коммитьте API ключи в git
2. ✅ Используйте `.env` файлы (они в `.gitignore`)
3. ✅ Используйте переменные окружения на сервере
4. ✅ Используйте секреты в CI/CD системах
5. ✅ Регулярно ротируйте API ключи

## 🔍 Проверка

Проверьте, что ключи не попали в git:

```bash
git log --all -p | grep -i "AIzaSy"
```

Если ничего не найдено - хорошо. Если найдено - нужно удалить из истории.

