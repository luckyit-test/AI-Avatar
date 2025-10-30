import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Получаем API ключ из переменных окружения
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY не установлен в переменных окружения');
  process.exit(1);
}

// Инициализируем клиент Gemini
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Эндпоинт для генерации изображения
app.post('/api/generate-image', async (req, res) => {
  try {
    const { imageData, prompt } = req.body;

    if (!imageData || !prompt) {
      return res.status(400).json({ 
        error: 'Отсутствуют обязательные параметры: imageData и prompt' 
      });
    }

    // Извлекаем mimeType и base64 данные из data URL
    const match = imageData.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ 
        error: 'Неверный формат imageData. Ожидается data:image/...;base64,...' 
      });
    }

    const [, mimeType, base64Data] = match;

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
          console.log(`Повторная попытка ${attempt}/${maxRetries} через ${Math.round(delay)}ms...`);
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
                return res.json({ imageDataUrl });
              }
            } catch (fallbackError) {
              console.error('Fallback промпт также не сработал:', fallbackError);
            }
          }
        }

        throw error;
      }
    }

    throw lastError || new Error('Превышено максимальное количество попыток');

  } catch (error) {
    console.error('Ошибка при генерации изображения:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: `Модель ИИ не смогла сгенерировать изображение. Детали: ${errorMessage}` 
    });
  }
});

// Эндпоинт для определения пола
app.post('/api/detect-gender', async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ 
        error: 'Отсутствует обязательный параметр: imageData' 
      });
    }

    const match = imageData.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ 
        error: 'Неверный формат imageData' 
      });
    }

    const [, mimeType, base64Data] = match;

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
        return res.json({ gender: parsed.gender, confidence });
      }

      // Fallback: пытаемся определить по тексту
      const text = raw.trim().toLowerCase();
      if (text.includes('male') || text.includes('муж')) {
        return res.json({ gender: 'male', confidence: 0.5 });
      }
      if (text.includes('female') || text.includes('жен')) {
        return res.json({ gender: 'female', confidence: 0.5 });
      }

      return res.json({ gender: 'unknown', confidence: 0 });

    } catch (error) {
      console.warn('Ошибка определения пола:', error);
      return res.json({ gender: 'unknown', confidence: 0 });
    }

  } catch (error) {
    console.error('Ошибка при определении пола:', error);
    res.status(500).json({ 
      error: 'Не удалось определить пол' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://0.0.0.0:${PORT}`);
});

