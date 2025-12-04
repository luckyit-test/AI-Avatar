#!/bin/bash
# Скрипт для обновления паролей Robokassa на сервере

echo "=========================================="
echo "ОБНОВЛЕНИЕ ПАРОЛЕЙ ROBOKASSA"
echo "=========================================="

# Путь к .env файлу на сервере
ENV_FILE="/opt/newava/.env"

# Новые пароли
NEW_PASSWORD1="LUaP7t8lK2Wx1SUc1Oax"
NEW_PASSWORD2="XZ5g281nZGqZdvNPlV8E"
LOGIN="newava.pro"

echo "Проверка существования .env файла..."
if [ ! -f "$ENV_FILE" ]; then
    echo "ОШИБКА: Файл $ENV_FILE не найден!"
    exit 1
fi

echo "Создание резервной копии .env файла..."
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

echo "Обновление паролей в .env файле..."

# Обновляем или добавляем ROBOKASSA_LOGIN
if grep -q "^ROBOKASSA_LOGIN=" "$ENV_FILE"; then
    sed -i "s|^ROBOKASSA_LOGIN=.*|ROBOKASSA_LOGIN=$LOGIN|" "$ENV_FILE"
else
    echo "ROBOKASSA_LOGIN=$LOGIN" >> "$ENV_FILE"
fi

# Обновляем или добавляем ROBOKASSA_PASSWORD1
if grep -q "^ROBOKASSA_PASSWORD1=" "$ENV_FILE"; then
    sed -i "s|^ROBOKASSA_PASSWORD1=.*|ROBOKASSA_PASSWORD1=$NEW_PASSWORD1|" "$ENV_FILE"
else
    echo "ROBOKASSA_PASSWORD1=$NEW_PASSWORD1" >> "$ENV_FILE"
fi

# Обновляем или добавляем ROBOKASSA_PASSWORD2
if grep -q "^ROBOKASSA_PASSWORD2=" "$ENV_FILE"; then
    sed -i "s|^ROBOKASSA_PASSWORD2=.*|ROBOKASSA_PASSWORD2=$NEW_PASSWORD2|" "$ENV_FILE"
else
    echo "ROBOKASSA_PASSWORD2=$NEW_PASSWORD2" >> "$ENV_FILE"
fi

echo ""
echo "Проверка обновленных значений:"
echo "----------------------------------------"
grep "ROBOKASSA" "$ENV_FILE" | sed 's/=.*/=***/'
echo "----------------------------------------"

echo ""
echo "Пароли обновлены успешно!"
echo ""
echo "ВАЖНО: Перезапустите контейнеры для применения изменений:"
echo "  cd /opt/newava"
echo "  docker compose restart backend"
echo ""

