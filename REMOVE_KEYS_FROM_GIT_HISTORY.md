# 🗑️ Удаление API ключей из истории Git

## ⚠️ Проблема

API ключи все еще находятся в истории git в коммите `445430b`:
- `AIzaSyAJbZrYV58Z5HqrljjjmH3rX3rRDoxySQU` (hnyear gen)
- `AIzaSyDvB7OMOxuOBu-s4FG5aijzr_R_2ec-cp8` (hnyear analysis)
- `AIzaSyCnfC8NVdq1Tf-bgWR0zqRwKd-DVIOm95A` (newava gen)
- `AIzaSyB5UipaYsdRqrxs0d0AMygfKJA7KnucGjQ` (newava analysis)

## ✅ Решение: Удалить из истории

### Вариант 1: Использовать git filter-branch (для приватных репозиториев)

```bash
# ВНИМАНИЕ: Это перепишет всю историю git!
# Используйте только если репозиторий приватный и никто другой не работает с ним!

# Удалить файл update-api-keys.bat из всей истории
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch update-api-keys.bat" \
  --prune-empty --tag-name-filter cat -- --all

# Удалить ключи из всех файлов в истории (более агрессивно)
git filter-branch --force --tree-filter \
  "find . -type f -exec sed -i '' 's/AIzaSyAJbZrYV58Z5HqrljjjmH3rX3rRDoxySQU/REMOVED_KEY/g' {} +" \
  --prune-empty --tag-name-filter cat -- --all

# Принудительно отправить изменения
git push origin --force --all
git push origin --force --tags
```

### Вариант 2: Использовать BFG Repo-Cleaner (рекомендуется)

BFG быстрее и безопаснее для больших репозиториев:

```bash
# 1. Скачайте BFG: https://rtyley.github.io/bfg-repo-cleaner/

# 2. Создайте файл keys.txt со списком ключей для удаления:
echo "AIzaSyAJbZrYV58Z5HqrljjjmH3rX3rRDoxySQU" > keys.txt
echo "AIzaSyDvB7OMOxuOBu-s4FG5aijzr_R_2ec-cp8" >> keys.txt
echo "AIzaSyCnfC8NVdq1Tf-bgWR0zqRwKd-DVIOm95A" >> keys.txt
echo "AIzaSyB5UipaYsdRqrxs0d0AMygfKJA7KnucGjQ" >> keys.txt

# 3. Клонируйте репозиторий как зеркало
git clone --mirror https://github.com/luckyit-test/AI-Avatar.git

# 4. Запустите BFG
java -jar bfg.jar --replace-text keys.txt AI-Avatar.git

# 5. Очистите и отправьте
cd AI-Avatar.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

### Вариант 3: Удалить только конкретный коммит (если он последний)

Если коммит `445430b` можно просто удалить:

```bash
# Удалить коммит из истории (если он не последний, используйте rebase)
git rebase -i 445430b^
# В редакторе удалите строку с коммитом 445430b
git push origin --force
```

## ⚠️ ВАЖНЫЕ ПРЕДУПРЕЖДЕНИЯ

1. **Это перепишет историю git** - все коммиты после `445430b` получат новые хеши
2. **Все, кто клонировал репозиторий, должны переклонировать** его
3. **Используйте только для приватных репозиториев** - для публичных это не поможет (история уже видна)
4. **Сделайте резервную копию** перед началом

## 📋 После удаления

1. Создайте новые API ключи в Google Cloud Console
2. Обновите ключи на сервере через SSH
3. Убедитесь, что новые ключи НЕ попадают в git

## 🔍 Проверка

После удаления проверьте:

```bash
git log --all -p | grep -i "AIzaSy"
```

Если ничего не найдено - ключи удалены из истории.

