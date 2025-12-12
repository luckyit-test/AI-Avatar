# Ручная проверка логов галереи

Если bat файл не работает из-за отсутствия SSH ключа, выполните команды вручную:

## Вариант 1: Через SSH (если есть доступ)

```bash
ssh root@43.245.226.24
```

Затем выполните команды:

```bash
# Проверка последних запросов к галерее
docker logs newava_backend --tail 200 | grep -E 'Gallery|Order|paymentType' | tail -50

# Проверка последних заказов в БД
docker logs newava_backend --tail 200 | grep -E 'generatePortraitsForOrder|saveOrder|completed' | tail -50

# Проверка ошибок
docker logs newava_backend --tail 200 | grep -E 'ERROR|Error|error|Failed|failed' | tail -30
```

## Вариант 2: Прямой доступ к контейнеру (если есть доступ к серверу)

```bash
docker exec -it newava_backend sh
```

Затем проверьте логи через файлы или используйте команды выше.

## Вариант 3: Проверка через API (если настроен)

Можно добавить эндпоинт для проверки логов через API, если нужно.

## Что искать в логах:

1. **Заказы с `paymentType = NULL`** - это веб-заказы, они должны попадать в галерею
2. **Заказы со статусом `completed`** - должны иметь `generatedImagesJson`
3. **Сообщения `[saveOrder] Saving completed order`** - показывают, что сохраняется в БД
4. **Сообщения `[Gallery Recent]`** - показывают, какие заказы попадают в выборку

## Проверка SQL запроса напрямую:

Если есть доступ к БД:

```bash
docker exec -it newava_backend sh
sqlite3 /app/data/database.db
```

Затем:

```sql
SELECT invId, status, paymentType, imagesCount, 
       CASE WHEN generatedImagesJson IS NOT NULL AND generatedImagesJson != 'null' THEN 1 ELSE 0 END as hasImages,
       datetime(createdAt/1000, 'unixepoch') as created
FROM orders
WHERE status = 'completed'
ORDER BY createdAt DESC
LIMIT 10;
```

