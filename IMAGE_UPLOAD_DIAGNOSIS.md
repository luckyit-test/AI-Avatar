# 🔍 Диагностика проблемы с загрузкой изображений

## ✅ Что исправлено

1. ✅ **API ключи обновлены** в `.env` файлах на сервере
2. ✅ **Контейнеры пересозданы** с новыми ключами
3. ✅ **Ключи загружены** в оба контейнера:
   - `hnyear_backend`: оба ключа установлены ✅
   - `newava_backend`: оба ключа установлены ✅

## 🔍 Найденные проблемы

### 1. hnyear.com
- **Ошибка:** `API Key not found. Please pass a valid API key.` (400)
- **Причина:** Возможно новый ключ еще не активирован в Google Cloud Console
- **Решение:** Проверьте активацию ключей в Google Cloud Console

### 2. newava.pro  
- **Ошибка:** `You exceeded your current quota` (429) - Free Tier
- **Причина:** Новый ключ все еще использует Free Tier вместо платного плана
- **Решение:** Убедитесь что ключ создан в проекте с включенным биллингом

## 📋 Что проверить

### 1. Проверка активации ключей в Google Cloud Console

1. Откройте: https://console.cloud.google.com/apis/credentials
2. Проверьте каждый ключ:
   - ✅ Ключ создан и активен
   - ✅ Ключ привязан к правильному проекту
   - ✅ Проект имеет включенный биллинг

### 2. Проверка квот

1. Откройте: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Убедитесь что видны **платные квоты**, а не Free Tier

### 3. Проверка на сайте

Попробуйте загрузить изображение на:
- https://hnyear.com/
- https://newava.pro/

Если ошибки остаются, проверьте логи:
```bash
# hnyear.com
cd /opt/hnyear && docker compose logs --tail=50 backend | grep -i "error\|429\|400"

# newava.pro
cd /opt/newava && docker compose logs --tail=50 backend | grep -i "error\|429\|400"
```

## 🔧 Если проблемы остаются

1. **Для hnyear.com (API Key not found):**
   - Проверьте что ключ активирован в Google Cloud Console
   - Убедитесь что ключ не заблокирован
   - Попробуйте создать новый ключ

2. **Для newava.pro (Free Tier квота):**
   - Убедитесь что ключ создан в проекте с платным планом
   - Проверьте что биллинг включен
   - Возможно нужно подождать активации платного плана

