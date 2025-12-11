/**
 * Telegram Bot для генерации портретов
 * Использует существующие сервисы проекта без влияния на основной функционал
 */
import { Telegraf } from 'telegraf';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

// Импортируем существующие сервисы
import { buildPortraitPrompts } from '../services/promptBuilder.js';
import { replaceBackgroundWithGray } from '../services/imageProcessing.js';
import { validateImageData } from '../services/validation.js';
import { IMAGE_ROOT_DIR } from '../config/index.js';
import { GoogleGenAI, Modality } from '@google/genai';
import { GEMINI_API_KEY_ANALYSIS, GEMINI_API_KEY_GENERATION } from '../config/index.js';
import { waitForGeminiAnalysisRateLimit } from '../queues/analysisQueue.js';

const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];

// Инициализация Gemini для анализа
const genAIAnalysis = new GoogleGenAI({
  apiKey: GEMINI_API_KEY_ANALYSIS,
});

// Инициализация Gemini для генерации
const genAIGeneration = new GoogleGenAI({
  apiKey: GEMINI_API_KEY_GENERATION,
});

let bot = null;

/**
 * Конвертирует изображение из Telegram в base64 data URL
 */
async function convertTelegramPhotoToBase64(fileId, bot) {
  try {
    const file = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    
    // Используем встроенный fetch (Node.js 18+) или https модуль
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Определяем MIME тип по расширению файла
    const ext = file.file_path.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';
    
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[Telegram Bot] Failed to convert photo:', error);
    throw new Error('Не удалось загрузить изображение');
  }
}

/**
 * Анализирует изображение и определяет пол
 */
async function analyzeImageForTelegram(imageData) {
  try {
    const { mimeType, base64Data } = validateImageData(imageData);
    const imagePart = { inlineData: { mimeType, data: base64Data } };

    await waitForGeminiAnalysisRateLimit();
    
    const response = await genAIAnalysis.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { 
        parts: [
          imagePart, 
          { 
            text: `Проанализируй это изображение и ответь на три вопроса:

1. Является ли это фотографией реального человека? (не рисунок, не 3D-рендер, не анимация, не скульптура)
2. Является ли это селфи или портретом ОДНОГО человека? (не группа людей на переднем плане)
3. Не нарушает ли это изображение политику контента? (нет запрещенного контента)

Верни ТОЛЬКО валидный JSON (без дополнительного текста):
{
  "isValid": boolean,
  "errorType": "none" | "prohibited_content" | "not_single_person" | "license_violation",
  "errorMessage": "строка на русском" (только если isValid: false),
  "gender": "male" | "female" | "unknown",
  "confidence": число от 0 до 1,
  "details": {
    "isPhotographOfRealPerson": boolean,
    "isSelfieOnePerson": boolean,
    "hasSinglePerson": boolean,
    "isFaceClearlyVisible": boolean,
    "hasProhibitedContent": boolean,
    "hasMultiplePeople": boolean
  }
}` 
          }
        ] 
      },
      config: {
        responseModalities: [Modality.TEXT],
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
    });
    
    const raw = (response.text || '').toString();
    const cleaned = raw.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
    
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }
    
    if (!parsed) {
      return {
        isValid: true,
        gender: 'unknown',
        errorMessage: 'Не удалось определить пол. Попробуйте другое фото.',
      };
    }
    
    return parsed;
  } catch (error) {
    console.error('[Telegram Bot] Image analysis error:', error);
    return {
      isValid: true,
      gender: 'unknown',
      errorMessage: 'Ошибка анализа изображения',
    };
  }
}

/**
 * Генерирует один портрет напрямую через Gemini API (не использует очередь, чтобы не мешать основному проекту)
 */
async function generateSinglePortrait(imageData, prompt, style) {
  try {
    const { mimeType, base64Data } = validateImageData(imageData);
    
    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };
    
    // Используем прямую генерацию через Gemini API
    const response = await genAIGeneration.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [imagePart, { text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
    });
    
    const imageParts = response.candidates?.[0]?.content?.parts?.filter(part => part.inlineData);
    
    if (!imageParts || imageParts.length === 0) {
      throw new Error('Не удалось сгенерировать изображение');
    }
    
    const generatedImage = imageParts[0].inlineData;
    const imageDataUrl = `data:${generatedImage.mimeType};base64,${generatedImage.data}`;
    
    return {
      style,
      imageUrl: imageDataUrl,
    };
  } catch (error) {
    console.error(`[Telegram Bot] Failed to generate portrait ${style}:`, error);
    throw error;
  }
}

/**
 * Генерирует все 6 портретов для пользователя
 */
async function generateAllPortraits(imageData, gender, role = 'Разработчик', company = 'Стартап') {
  try {
    // ШАГ 1: Генерируем промежуточное изображение
    let intermediateImage;
    try {
      intermediateImage = await replaceBackgroundWithGray(imageData);
      console.log('[Telegram Bot] Intermediate image generated');
    } catch (err) {
      console.error('[Telegram Bot] Failed to generate intermediate image:', err);
      intermediateImage = imageData;
    }
    
    // ШАГ 2: Строим промпты для всех 6 стилей
    const prompts = buildPortraitPrompts(gender, role, company);
    
    // ШАГ 3: Генерируем все 6 портретов последовательно (с небольшой задержкой между запросами)
    const results = [];
    
    for (let i = 0; i < STYLES.length; i++) {
      const style = STYLES[i];
      try {
        const prompt = prompts[style];
        console.log(`[Telegram Bot] Generating portrait ${i + 1}/6: ${style}`);
        
        // Добавляем небольшую задержку между запросами (2 секунды) чтобы не перегружать API
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const result = await generateSinglePortrait(intermediateImage, prompt, style);
        results.push(result);
      } catch (error) {
        console.error(`[Telegram Bot] Failed to generate ${style}:`, error);
        // Продолжаем с другими стилями даже если один не удался
      }
    }
    
    return results;
  } catch (error) {
    console.error('[Telegram Bot] Failed to generate portraits:', error);
    throw error;
  }
}

/**
 * Инициализация и запуск Telegram бота
 */
export function initializeTelegramBot(token) {
  if (!token) {
    console.log('[Telegram Bot] Token not provided, skipping bot initialization');
    return null;
  }
  
  try {
    bot = new Telegraf(token);
    
    // Команда /start
    bot.start((ctx) => {
      ctx.reply(
        '👋 Привет! Я бот для генерации профессиональных портретов.\n\n' +
        '📸 Отправь мне свое фото, и я создам 6 профессиональных портретов в разных стилях.\n\n' +
        'Используй команду /help для получения справки.'
      );
    });
    
    // Команда /help
    bot.help((ctx) => {
      ctx.reply(
        '📖 Справка по использованию бота:\n\n' +
        '1️⃣ Отправь мне свое фото (селфи или портрет)\n' +
        '2️⃣ Бот автоматически определит пол и создаст 6 портретов\n' +
        '3️⃣ Получи готовые профессиональные портреты\n\n' +
        '⚠️ Важно: фото должно быть одного человека, четкое и качественное.'
      );
    });
    
    // Обработка фотографий
    bot.on('photo', async (ctx) => {
      try {
        const photo = ctx.message.photo;
        // Берем самое большое фото
        const largestPhoto = photo[photo.length - 1];
        
        // Отправляем сообщение о начале обработки
        const processingMsg = await ctx.reply('⏳ Обрабатываю изображение...');
        
        // Конвертируем фото в base64
        const imageData = await convertTelegramPhotoToBase64(largestPhoto.file_id, bot);
        
        // Анализируем изображение
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          '🔍 Анализирую изображение и определяю пол...'
        );
        
        const analysis = await analyzeImageForTelegram(imageData);
        
        if (!analysis.isValid) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            null,
            `❌ ${analysis.errorMessage || 'Изображение не подходит для генерации'}`
          );
          return;
        }
        
        if (analysis.gender === 'unknown') {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            processingMsg.message_id,
            null,
            '⚠️ Не удалось определить пол на фото. Попробуйте другое изображение с более четким лицом.'
          );
          return;
        }
        
        // Начинаем генерацию
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          `✅ Пол определен: ${analysis.gender === 'male' ? 'Мужской' : 'Женский'}\n\n` +
          '🎨 Генерирую портреты... Это может занять несколько минут.'
        );
        
        // Генерируем портреты (используем значения по умолчанию для роли и компании)
        const portraits = await generateAllPortraits(
          imageData,
          analysis.gender,
          'Разработчик',
          'Стартап'
        );
        
        // Удаляем сообщение о обработке
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Отправляем результаты
        if (portraits.length === 0) {
          await ctx.reply('❌ Не удалось сгенерировать портреты. Попробуйте позже.');
          return;
        }
        
        await ctx.reply(`✅ Готово! Сгенерировано ${portraits.length} портретов:`);
        
        // Отправляем каждый портрет
        for (const portrait of portraits) {
          try {
            // Конвертируем data URL в Buffer для отправки
            const match = portrait.imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
            const base64Data = match ? match[1] : portrait.imageUrl.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            await ctx.replyWithPhoto(
              { source: buffer },
              { caption: `🎨 ${portrait.style}` }
            );
          } catch (error) {
            console.error(`[Telegram Bot] Failed to send portrait ${portrait.style}:`, error);
            await ctx.reply(`⚠️ Не удалось отправить портрет "${portrait.style}"`);
          }
        }
        
        await ctx.reply('✨ Все портреты готовы!');
        
      } catch (error) {
        console.error('[Telegram Bot] Error processing photo:', error);
        await ctx.reply('❌ Произошла ошибка при обработке изображения. Попробуйте позже.');
      }
    });
    
    // Обработка документов (если пользователь отправил файл)
    bot.on('document', async (ctx) => {
      const document = ctx.message.document;
      
      // Проверяем, что это изображение
      if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        await ctx.reply('⚠️ Пожалуйста, отправьте изображение (фото), а не файл.');
        return;
      }
      
      // Обрабатываем как фото
      try {
        const imageData = await convertTelegramPhotoToBase64(document.file_id, bot);
        // Повторяем логику обработки фото
        // (можно вынести в отдельную функцию)
      } catch (error) {
        console.error('[Telegram Bot] Error processing document:', error);
        await ctx.reply('❌ Не удалось обработать файл. Попробуйте отправить фото.');
      }
    });
    
    // Обработка ошибок
    bot.catch((err, ctx) => {
      console.error('[Telegram Bot] Error:', err);
      ctx.reply('❌ Произошла ошибка. Попробуйте позже или обратитесь в поддержку.');
    });
    
    console.log('[Telegram Bot] Bot initialized successfully');
    return bot;
    
  } catch (error) {
    console.error('[Telegram Bot] Failed to initialize bot:', error);
    return null;
  }
}

/**
 * Запуск бота
 */
export function startTelegramBot(botInstance) {
  if (!botInstance) {
    return;
  }
  
  try {
    botInstance.launch();
    console.log('[Telegram Bot] Bot started successfully');
    
    // Graceful shutdown
    process.once('SIGINT', () => botInstance.stop('SIGINT'));
    process.once('SIGTERM', () => botInstance.stop('SIGTERM'));
    
  } catch (error) {
    console.error('[Telegram Bot] Failed to start bot:', error);
  }
}

export default { initializeTelegramBot, startTelegramBot };

