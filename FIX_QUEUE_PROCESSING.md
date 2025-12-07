# ✅ ИСПРАВЛЕНО: Джобы в очереди не обрабатывались

## Проблема

Джобы добавлялись в очередь, но не обрабатывались. В консоли браузера было видно бесконечный polling со статусом `queued`.

## Причина

В проекте было **ДВА роута** для `/api/generate-image`:

1. **`server/routes/generation.js`** - использовал `addToQueue()` напрямую ❌
   - Джобы добавлялись в очередь
   - НО `processQueue()` НЕ вызывался
   - Поэтому джобы оставались в очереди и не обрабатывались

2. **`server/index.js`** - использовал `addToQueueLocal()` ✅
   - Джобы добавлялись в очередь
   - И `processQueue()` вызывался автоматически
   - Но этот роут НЕ использовался (роут из `generation.js` имел приоритет)

## Исправление

1. ✅ Обновлен `server/routes/generation.js`:
   - Теперь использует `addToQueueLocal` вместо `addToQueue`
   - `addToQueueLocal` автоматически вызывает `processQueue()` после добавления джоба

2. ✅ Обновлен `server/index.js`:
   - Передает `addToQueueLocal` в `initializeGenerationRoutes()`

## Результат

Теперь при добавлении джоба в очередь автоматически запускается `processQueue()`, который обрабатывает очередь и генерирует изображения.

## Проверка

После перезапуска backend попробуйте загрузить фото снова. Теперь должны появиться логи:
- `addToQueueLocal called`
- `addToQueueLocal: job added to queue`
- `processQueue started`
- `Starting batch of jobs`
- `BEFORE PROCESSJOB CALL`

