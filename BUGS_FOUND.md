# Найденные баги и потенциальные проблемы

**Дата анализа:** 2025-12-04  
**Ветка:** `avatar`  
**Последний коммит:** `aa9b3e5`

---

## 🔴 КРИТИЧЕСКИЕ БАГИ

### 1. **Retry при `uploadedImage === null`** (КРИТИЧНО)

**Местоположение:** `App.tsx:1069-1075`

**Проблема:**
```typescript
const retryResult = await retryOrder(
    currentOrder.invId,
    uploadedImage,  // ⚠️ Может быть null!
    effectiveGenderRetry,
    selectedRole || '',
    selectedCompany || ''
);
```

**Описание:**
- При статусе `failed` мы очищаем `uploadedImage` (строка 716: `setUploadedImage(null)`)
- Но при retry используем `uploadedImage`, который может быть `null`
- Backend валидирует `imageData` и вернет ошибку, но пользователь увидит неясное сообщение

**Последствия:**
- Retry не работает, если пользователь не загрузил новое изображение
- Пользователь видит ошибку вместо понятного сообщения "Загрузите новое фото"

**Исправление:**
```typescript
if (!uploadedImage) {
    // Показываем сообщение пользователю или блокируем кнопку
    return;
}
```

**Приоритет:** 🔴 КРИТИЧНО

---

### 2. **Использование `console.error` вместо `devLog.error`** (СРЕДНИЙ)

**Местоположение:** `App.tsx:1078, 1094`

**Проблема:**
```typescript
console.error('[App] Retry order failed:', retryResult.error);
// и
console.error('[App] Failed to retry order:', err);
```

**Описание:**
- Мы заменили все `console.log` на `devLog.log`, но забыли `console.error`
- В production эти ошибки все равно будут логироваться (что правильно), но для консистентности лучше использовать `devLog.error`

**Последствия:**
- Небольшая несогласованность в коде
- Не критично, но лучше исправить

**Исправление:**
Заменить `console.error` на `devLog.error` (который всегда логирует, даже в production)

**Приоритет:** 🟡 СРЕДНИЙ

---

## 🟡 ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ

### 3. **Race condition в polling при быстром изменении статуса** (СРЕДНИЙ)

**Местоположение:** `App.tsx:677-733`

**Проблема:**
```typescript
const pollOrderStatus = async () => {
    if (!isPolling || abortController.signal.aborted) return;
    
    try {
        const order = await fetchOrder(currentInvId!);
        
        // Проверяем, изменился ли статус заказа
        if (order.status !== currentOrder?.status) {
            setCurrentOrder(order);
            // ...
        }
        
        // Планируем следующий запрос
        if (isPolling && !abortController.signal.aborted) {
            pollTimeoutId = setTimeout(pollOrderStatus, pollDelay);
        }
    } catch (err) {
        // ...
    }
};
```

**Описание:**
- Если между `fetchOrder` и `setCurrentOrder` статус изменится еще раз, мы можем пропустить промежуточное состояние
- `currentOrder` в замыкании может быть устаревшим

**Последствия:**
- Редкая ситуация, но может привести к пропуску обновлений UI
- Особенно актуально при быстром переходе `paid → processing → completed`

**Исправление:**
Использовать функциональное обновление состояния:
```typescript
setCurrentOrder(prev => {
    if (prev?.status === order.status) return prev;
    return order;
});
```

**Приоритет:** 🟡 СРЕДНИЙ

---

### 4. **Отсутствие проверки `uploadedImage` перед retry** (СРЕДНИЙ)

**Местоположение:** `App.tsx:1051-1098`

**Проблема:**
- В функции `handleGenerateClick` при retry нет явной проверки `uploadedImage !== null`
- Проверка есть только на `getEffectiveGender()`, но не на само изображение

**Описание:**
- Пользователь может нажать "Сгенерировать" после failed состояния, не загрузив новое фото
- Backend вернет ошибку, но UX будет плохим

**Последствия:**
- Плохой UX - пользователь видит ошибку вместо подсказки загрузить фото

**Исправление:**
Добавить проверку в начале retry блока:
```typescript
if (currentOrder && currentOrder.status === 'failed') {
    if (!uploadedImage) {
        // Показать сообщение или блокировать кнопку
        return;
    }
    // ...
}
```

**Приоритет:** 🟡 СРЕДНИЙ

---

### 5. **Потенциальная утечка памяти в polling** (НИЗКИЙ)

**Местоположение:** `App.tsx:656-757`

**Проблема:**
- При быстром изменении `currentInvId` или `currentOrder` может остаться старый `setTimeout`
- `pollTimeoutId` перезаписывается, но старый таймер не очищается

**Описание:**
```typescript
let pollTimeoutId: NodeJS.Timeout | null = null;

const pollOrderStatus = async () => {
    // ...
    if (isPolling && !abortController.signal.aborted) {
        pollTimeoutId = setTimeout(pollOrderStatus, pollDelay);
        // ⚠️ Старый pollTimeoutId не очищается перед созданием нового
    }
};

return () => {
    isPolling = false;
    abortController.abort();
    if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
    }
};
```

**Последствия:**
- Минимальная утечка памяти при частых изменениях зависимостей `useEffect`
- Очень редкая ситуация

**Исправление:**
Очищать старый таймер перед созданием нового:
```typescript
if (pollTimeoutId) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
}
if (isPolling && !abortController.signal.aborted) {
    pollTimeoutId = setTimeout(pollOrderStatus, pollDelay);
}
```

**Приоритет:** 🟢 НИЗКИЙ

---

### 6. **Отсутствие обработки ошибок сети в polling** (СРЕДНИЙ)

**Местоположение:** `App.tsx:680-740`

**Проблема:**
```typescript
try {
    const order = await fetchOrder(currentInvId!);
    // ...
} catch (err) {
    // При ошибке увеличиваем задержку и продолжаем polling
    pollDelay = Math.min(pollDelay * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);
    if (isPolling && !abortController.signal.aborted) {
        pollTimeoutId = setTimeout(pollOrderStatus, pollDelay);
    }
}
```

**Описание:**
- При сетевой ошибке (offline, timeout) polling продолжается бесконечно
- Нет максимального количества попыток или уведомления пользователя

**Последствия:**
- При длительном отсутствии сети polling будет продолжаться
- Пользователь не узнает о проблеме с сетью

**Исправление:**
Добавить счетчик ошибок и показывать сообщение после N ошибок подряд:
```typescript
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

// В catch:
consecutiveErrors++;
if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    // Показать сообщение пользователю о проблеме с сетью
    isPolling = false;
    return;
}
```

**Приоритет:** 🟡 СРЕДНИЙ

---

## 🟢 МЕЛКИЕ УЛУЧШЕНИЯ

### 7. **Неиспользуемая переменная `pollDelay` в замыкании** (НИЗКИЙ)

**Местоположение:** `App.tsx:669-730`

**Проблема:**
- `pollDelay` объявлена в `useEffect`, но используется в `pollOrderStatus`
- При изменении зависимостей `useEffect` создается новое замыкание, но старое может продолжать работать

**Описание:**
- Технически это не баг, но может привести к неожиданному поведению
- Лучше использовать `useRef` для хранения `pollDelay`

**Исправление:**
```typescript
const pollDelayRef = useRef(2000);
// Использовать pollDelayRef.current вместо pollDelay
```

**Приоритет:** 🟢 НИЗКИЙ

---

### 8. **Отсутствие валидации `currentInvId` перед `fetchOrder`** (НИЗКИЙ)

**Местоположение:** `App.tsx:681`

**Проблема:**
```typescript
const order = await fetchOrder(currentInvId!); // Используется non-null assertion
```

**Описание:**
- Хотя есть проверка `if (!currentInvId) return;` в начале `useEffect`, TypeScript требует `!`
- Лучше добавить явную проверку перед вызовом

**Исправление:**
```typescript
if (!currentInvId) return;
const order = await fetchOrder(currentInvId);
```

**Приоритет:** 🟢 НИЗКИЙ

---

## 📊 Сводка

- **Критические:** 1 баг
- **Средние:** 4 проблемы
- **Низкие:** 3 улучшения

**Рекомендации:**
1. Исправить критический баг #1 (retry с null изображением)
2. Исправить баги #2, #4 (консистентность и UX)
3. Рассмотреть исправления #3, #6 (race conditions и обработка ошибок)
4. Остальные - по желанию

---

**Статус:** ✅ ВСЕ БАГИ ИСПРАВЛЕНЫ

**Коммиты:**
- `02ff68e` - Fix bug #1: Add validation for uploadedImage before retry
- `be3c5f3` - Fix bugs #2-8: Replace console.error, fix race conditions, add network error handling, fix memory leaks, use useRef for pollDelay

**Дата исправления:** 2025-12-04

