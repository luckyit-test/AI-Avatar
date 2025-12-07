# Обновление GEMINI_API_KEY для hnyear.com

## Проблема
В логах видна ошибка: `"API key not valid. Please pass a valid API key."`
Это означает, что в файле `/opt/hnyear/.env` стоит placeholder `your_key_here` вместо реального ключа.

## Решение

### Вариант 1: Через SSH (рекомендуется)

1. Подключитесь к серверу:
   ```bash
   ssh root@43.245.226.24
   # Пароль: Yd2Vc_Wejus0DlNB
   ```

2. Отредактируйте файл `.env`:
   ```bash
   cd /opt/hnyear
   nano .env
   ```

3. Замените строки:
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_API_KEY_ANALYSIS=your_key_here
   ```
   
   На ваш реальный ключ:
   ```
   GEMINI_API_KEY=ваш_реальный_ключ_здесь
   GEMINI_API_KEY_ANALYSIS=ваш_реальный_ключ_здесь
   ```

4. Сохраните файл (Ctrl+O, Enter, Ctrl+X)

5. Перезапустите backend:
   ```bash
   docker compose restart backend
   ```

6. Проверьте логи:
   ```bash
   docker compose logs --tail=20 backend
   ```

### Вариант 2: Через одну команду SSH

```bash
ssh root@43.245.226.24 "cd /opt/hnyear && sed -i 's|GEMINI_API_KEY=.*|GEMINI_API_KEY=ВАШ_КЛЮЧ_ЗДЕСЬ|' .env && sed -i 's|GEMINI_API_KEY_ANALYSIS=.*|GEMINI_API_KEY_ANALYSIS=ВАШ_КЛЮЧ_ЗДЕСЬ|' .env && docker compose restart backend"
```

Замените `ВАШ_КЛЮЧ_ЗДЕСЬ` на ваш реальный GEMINI_API_KEY.

### Вариант 3: Использовать скрипт update-gemini-key.bat

Запустите `update-gemini-key.bat` и введите ваш API ключ при запросе.

## Проверка

После обновления ключа попробуйте загрузить фото на сайте https://hnyear.com/

Если ошибка останется, проверьте логи:
```bash
ssh root@43.245.226.24 "cd /opt/hnyear && docker compose logs --tail=30 backend | grep -i 'api\|error'"
```

