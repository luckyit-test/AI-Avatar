import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3001;

// Безопасная конфигурация CORS - только с разрешенных доменов
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173']; // По умолчанию только локальные для разработки

const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, от мобильных приложений или Postman)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Не разрешено политикой CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Уменьшено с 50mb для безопасности
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware (простая реализация)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут
const RATE_LIMIT_MAX_REQUESTS = 30; // Максимум 30 запросов за окно

function rateLimit(req, res, next) {
  const clientId = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(clientId)) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = rateLimitStore.get(clientId);
  
  if (now > clientData.resetTime) {
    // Окно истекло, сбрасываем счетчик
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Превышен лимит запросов. Попробуйте позже.' 
    });
  }
  
  clientData.count++;
  next();
}

// Очистка старых записей rate limit (каждые 5 минут)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Применяем rate limiting ко всем API эндпоинтам
app.use('/generate-image', rateLimit);
app.use('/detect-gender', rateLimit);

// Получаем API ключ из переменных окружения
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY не установлен в переменных окружения');
  process.exit(1);
}

// Инициализируем клиент Gemini
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Валидация размера base64 изображения
function validateImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    return { valid: false, error: 'imageData должен быть строкой' };
  }
  
  const match = imageData.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    return { valid: false, error: 'Неверный формат imageData. Ожидается data:image/...;base64,...' };
  }
  
  const [, mimeType, base64Data] = match;
  
  // Проверяем поддерживаемые форматы
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return { valid: false, error: `Неподдерживаемый формат изображения: ${mimeType}` };
  }
  
  // Проверяем размер (base64 примерно на 33% больше оригинала)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (sizeInBytes > maxSize) {
    return { valid: false, error: 'Размер изображения превышает 5MB' };
  }
  
  return { valid: true, mimeType, base64Data };
}

// Валидация промпта
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'prompt должен быть строкой' };
  }
  
  if (prompt.length > 5000) {
    return { valid: false, error: 'Промпт слишком длинный (максимум 5000 символов)' };
  }
  
  if (prompt.length < 10) {
    return { valid: false, error: 'Промпт слишком короткий (минимум 10 символов)' };
  }
  
  return { valid: true };
}

// Безопасное логирование (без секретов)
function safeLog(message, data = {}) {
  const sanitizedData = { ...data };
  if (sanitizedData.apiKey) delete sanitizedData.apiKey;
  if (sanitizedData.imageData) {
    sanitizedData.imageData = sanitizedData.imageData.substring(0, 50) + '...';
  }
  console.log(`[${new Date().toISOString()}] ${message}`, sanitizedData);
}

// Эндпоинт для генерации изображения
app.post('/generate-image', async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData, prompt } = req.body;

    // Валидация входных данных
    if (!imageData || !prompt) {
      safeLog('Validation failed: missing parameters', { clientIp });
      return res.status(400).json({ 
        error: 'Отсутствуют обязательные параметры: imageData и prompt' 
      });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      safeLog('Validation failed: invalid image', { clientIp, error: imageValidation.error });
      return res.status(400).json({ error: imageValidation.error });
    }

    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      safeLog('Validation failed: invalid prompt', { clientIp, error: promptValidation.error });
      return res.status(400).json({ error: promptValidation.error });
    }

    const { mimeType, base64Data } = imageValidation;

    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    const textPart = { text: prompt };

    // Вызываем Gemini API с сервера
    const maxRetries = 5;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });

        // Извлекаем изображение из ответа
        const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(
          part => part.inlineData
        );

        if (imagePartFromResponse?.inlineData) {
          const { mimeType: responseMimeType, data: responseData } = imagePartFromResponse.inlineData;
          const imageDataUrl = `data:${responseMimeType};base64,${responseData}`;
          const duration = Date.now() - startTime;
          safeLog('Image generated successfully', { clientIp, attempt, duration });
          return res.json({ imageDataUrl });
        }

        // Если нет изображения, возвращаем текстовый ответ как ошибку
        const textResponse = response.text;
        throw new Error(`Модель ИИ ответила текстом вместо изображения: "${textResponse || 'Текстовый ответ не получен.'}"`);

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        
        // Проверяем, является ли ошибка повторяемой
        const isRetriable = (
          errorMessage.toLowerCase().includes('internal') ||
          errorMessage.includes('"code":500') ||
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorMessage.toLowerCase().includes('rate_limit') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.includes('429') ||
          errorMessage.includes('503') ||
          errorMessage.toLowerCase().includes('unavailable') ||
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('timed out') ||
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('fetch failed')
        );

        if (isRetriable && attempt < maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt - 1);
          const jitter = backoff * (0.5 + Math.random());
          const delay = Math.min(backoff + jitter, 15000);
          safeLog(`Retry attempt ${attempt}/${maxRetries}`, { clientIp, delay });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Если это ошибка "нет изображения", пробуем fallback промпт
        if (errorMessage.includes('Модель ИИ ответила текстом вместо изображения')) {
          if (attempt === 1) {
            // Пробуем с fallback промптом
            const fallbackPrompt = 'Generate a professional, high-resolution business portrait of the person in this image. The style should be suitable for a corporate setting like a LinkedIn profile. The result should be a clear, photorealistic portrait against a neutral background.';
            try {
              const fallbackResponse = await genAI.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, { text: fallbackPrompt }] },
                config: {
                  responseModalities: [Modality.IMAGE],
                },
              });

              const fallbackImagePart = fallbackResponse.candidates?.[0]?.content?.parts?.find(
                part => part.inlineData
              );

              if (fallbackImagePart?.inlineData) {
                const { mimeType: responseMimeType, data: responseData } = fallbackImagePart.inlineData;
                const imageDataUrl = `data:${responseMimeType};base64,${responseData}`;
                const duration = Date.now() - startTime;
                safeLog('Image generated with fallback prompt', { clientIp, duration });
                return res.json({ imageDataUrl });
              }
            } catch (fallbackError) {
              safeLog('Fallback prompt failed', { clientIp, error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
            }
          }
        }

        throw error;
      }
    }

    throw lastError || new Error('Превышено максимальное количество попыток');

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Image generation failed', { clientIp, error: errorMessage, duration });
    
    // Не раскрываем детали ошибок клиенту
    res.status(500).json({ 
      error: 'Не удалось сгенерировать изображение. Попробуйте позже.' 
    });
  }
});

// Эндпоинт для определения пола
app.post('/detect-gender', async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData } = req.body;

    if (!imageData) {
      safeLog('Gender detection failed: missing imageData', { clientIp });
      return res.status(400).json({ 
        error: 'Отсутствует обязательный параметр: imageData' 
      });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      safeLog('Gender detection failed: invalid image', { clientIp, error: imageValidation.error });
      return res.status(400).json({ error: imageValidation.error });
    }

    const { mimeType, base64Data } = imageValidation;

    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    const instruction = {
      text: "You are a precise classifier. Determine the gender presentation of the primary person in the image. Respond in STRICT JSON only, no prose, no code fences: {\n  \"gender\": \"male|female|unknown\",\n  \"confidence\": number between 0 and 1\n}.",
    };

    try {
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [imagePart, instruction] },
        config: {
          responseModalities: [Modality.TEXT],
        },
      });

      const raw = (response.text || '').toString();
      let parsed = null;
      
      // Убираем code fences если есть
      const cleaned = raw.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
      
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Пробуем найти JSON в тексте
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (parsed && (parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'unknown')) {
        const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
        const duration = Date.now() - startTime;
        safeLog('Gender detected successfully', { clientIp, gender: parsed.gender, confidence, duration });
        return res.json({ gender: parsed.gender, confidence });
      }

      // Fallback: пытаемся определить по тексту
      const text = raw.trim().toLowerCase();
      let result = { gender: 'unknown', confidence: 0 };
      if (text.includes('male') || text.includes('муж')) {
        result = { gender: 'male', confidence: 0.5 };
      } else if (text.includes('female') || text.includes('жен')) {
        result = { gender: 'female', confidence: 0.5 };
      }
      
      const duration = Date.now() - startTime;
      safeLog('Gender detected with fallback', { clientIp, result, duration });
      return res.json(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      safeLog('Gender detection error', { clientIp, error: error instanceof Error ? error.message : String(error), duration });
      return res.json({ gender: 'unknown', confidence: 0 });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Gender detection failed', { clientIp, error: errorMessage, duration });
    res.status(500).json({ 
      error: 'Не удалось определить пол' 
    });
  }
});

// Health check (без логирования для снижения нагрузки)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://0.0.0.0:${PORT}`);
  console.log(`🔒 CORS разрешен для: ${allowedOrigins.join(', ')}`);
});
