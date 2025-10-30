#!/bin/bash

# Скрипт для автоматического пуша кода в git
# Использование: ./git-push.sh [commit_message] [branch_name]

set -e  # Остановка при ошибке

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Получение параметров
COMMIT_MESSAGE="${1:-Update code}"
BRANCH_NAME="${2:-$(git rev-parse --abbrev-ref HEAD)}"

echo -e "${YELLOW}🚀 Начинаем процесс пуша в git...${NC}\n"

# Проверка, что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: это не git репозиторий${NC}"
    exit 1
fi

# Проверка наличия изменений
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Нет изменений для коммита${NC}"
    exit 0
fi

# Показываем статус
echo -e "${GREEN}📊 Текущий статус:${NC}"
git status --short
echo ""

# Добавляем все изменения
echo -e "${GREEN}➕ Добавляем все изменения...${NC}"
git add .

# Делаем коммит
echo -e "${GREEN}💾 Создаем коммит с сообщением: \"${COMMIT_MESSAGE}\"${NC}"
git commit -m "${COMMIT_MESSAGE}"

# Показываем текущую ветку
echo -e "${GREEN}🌿 Текущая ветка: ${BRANCH_NAME}${NC}"

# Делаем push
echo -e "${GREEN}📤 Пушим изменения в ${BRANCH_NAME}...${NC}"
git push origin "${BRANCH_NAME}"

echo -e "\n${GREEN}✅ Успешно! Код запушен в ветку ${BRANCH_NAME}${NC}"

