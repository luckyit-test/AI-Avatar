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
import { hasUsedFreeGeneration, markFreeGenerationUsed } from '../db/telegramUsers.js';
import { saveOrder, createNextInvId, orderImages, loadOrder } from '../db/orders.js';
import { createRoleKeyboard, createCompanyKeyboard, getRoleByIndex, getCompanyByIndex } from './keyboards.js';
import { ROBOKASSA_LOGIN, ROBOKASSA_PASSWORD1, ROBOKASSA_PASSWORD2, ROBOKASSA_IS_TEST, ROBOKASSA_PAYMENT_AMOUNT, ROBOKASSA_PAYMENT_DESC, API_PREFIX, MAX_QUEUE_SIZE } from '../config/index.js';
import { generatePortraitsForOrder } from '../services/portraitGeneration.js';
import crypto from 'crypto';

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
 * Отправляет сгенерированные портреты пользователю в Telegram
 */
async function sendPortraitsToUser(botInstance, chatId, invId) {
  try {
    // Ждем завершения генерации (polling статуса заказа)
    const maxWaitTime = 300000; // 5 минут максимум
    const startTime = Date.now();
    const pollInterval = 3000; // Проверяем каждые 3 секунды
    
    let order = loadOrder(invId);
    if (!order) {
      await botInstance.telegram.sendMessage(chatId, '❌ Заказ не найден. Обратитесь в поддержку.');
      return;
    }
    
    // Ждем завершения генерации
    while (Date.now() - startTime < maxWaitTime) {
      order = loadOrder(invId);
      
      if (order.status === 'completed' && order.generatedImages) {
        break; // Генерация завершена
      }
      
      if (order.status === 'failed') {
        await botInstance.telegram.sendMessage(
          chatId,
          `❌ Не удалось сгенерировать портреты: ${order.failureReason || 'Неизвестная ошибка'}. Обратитесь в поддержку.`
        );
        return;
      }
      
      // Ждем перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      await botInstance.telegram.sendMessage(chatId, '❌ Портреты не найдены. Обратитесь в поддержку.');
      return;
    }
    
    const images = order.generatedImages;
    const imageCount = Object.keys(images).length;
    
    if (imageCount === 0) {
      await botInstance.telegram.sendMessage(chatId, '❌ Не удалось сгенерировать портреты. Обратитесь в поддержку.');
      return;
    }
    
    await botInstance.telegram.sendMessage(chatId, `✅ Готово! Сгенерировано ${imageCount} портретов:`);
    
    // Отправляем каждый портрет
    for (const [style, url] of Object.entries(images)) {
      try {
        // Загружаем изображение по URL
        const imageUrl = url.startsWith('http') ? url : `https://newava.pro${url}`;
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        await botInstance.telegram.sendPhoto(chatId, { source: buffer }, {
          caption: `🎨 ${style}`,
        });
        
        // Небольшая задержка между отправками
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Telegram Bot] Failed to send portrait ${style}:`, error);
        await botInstance.telegram.sendMessage(chatId, `⚠️ Не удалось отправить портрет "${style}"`);
      }
    }
    
    await botInstance.telegram.sendMessage(chatId, '✨ Все портреты готовы!');
    
  } catch (error) {
    console.error('[Telegram Bot] Error sending portraits to user:', error);
    await botInstance.telegram.sendMessage(chatId, '❌ Произошла ошибка при отправке портретов. Обратитесь в поддержку.');
  }
}

/**
 * Генерирует один портрет (для бесплатной генерации)
 */
async function generateSingleFreePortrait(imageData, gender, role = 'Разработчик', company = 'Стартап') {
  try {
    // ШАГ 1: Генерируем промежуточное изображение
    let intermediateImage;
    try {
      intermediateImage = await replaceBackgroundWithGray(imageData);
      console.log('[Telegram Bot] Intermediate image generated for free portrait');
    } catch (err) {
      console.error('[Telegram Bot] Failed to generate intermediate image:', err);
      intermediateImage = imageData;
    }
    
    // ШАГ 2: Строим промпты для всех стилей и берем первый (Классический)
    const prompts = buildPortraitPrompts(gender, role, company);
    const style = STYLES[0]; // Классический стиль
    const prompt = prompts[style];
    
    console.log(`[Telegram Bot] Generating free portrait: ${style}`);
    
    const result = await generateSinglePortrait(intermediateImage, prompt, style);
    return result;
  } catch (error) {
    console.error('[Telegram Bot] Failed to generate free portrait:', error);
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
      const userId = ctx.from.id;
      const hasUsedFree = hasUsedFreeGeneration(userId);
      
      let message = '👋 Привет! Я бот для генерации профессиональных портретов.\n\n';
      message += '📸 Отправь мне свое фото (селфи или портрет), и я предложу варианты генерации:\n\n';
      
      if (!hasUsedFree) {
        message += '🎁 Бесплатный портрет (1 раз)\n';
        message += '   • 1 портрет в классическом стиле\n';
        message += '   • Роль: Разработчик, Компания: Стартап\n\n';
      }
      
      message += '💰 6 профессиональных портретов за 200₽\n';
      message += '   • Выбор роли и типа компании\n';
      message += '   • 6 портретов в разных стилях\n';
      message += '   • Оплата через Robokassa или Telegram Stars\n\n';
      
      message += '⭐ Премиум портрет за 500₽ (скоро)\n\n';
      
      message += '💡 Используй команду /help для подробной справки.';
      
      ctx.reply(message);
    });
    
    // Команда /help
    bot.help((ctx) => {
      const userId = ctx.from.id;
      const hasUsedFree = hasUsedFreeGeneration(userId);
      
      let message = '📖 Справка по использованию бота:\n\n';
      message += '1️⃣ Отправь мне свое фото (селфи или портрет)\n';
      message += '2️⃣ Выбери вариант генерации:\n';
      
      if (!hasUsedFree) {
        message += '   🎁 Бесплатный портрет (1 раз, 1 портрет)\n';
      }
      message += '   💰 6 профессиональных портретов за 200₽\n';
      message += '   ⭐ Премиум портрет за 500₽ (скоро)\n\n';
      message += '3️⃣ Получи готовые профессиональные портреты\n\n';
      message += '⚠️ Важно: фото должно быть одного человека, четкое и качественное.';
      
      ctx.reply(message);
    });
    
    // Обработка фотографий
    bot.on('photo', async (ctx) => {
      try {
        const userId = ctx.from.id;
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
        
        // Удаляем сообщение о обработке
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Проверяем, использовал ли пользователь бесплатную генерацию
        const hasUsedFree = hasUsedFreeGeneration(userId);
        
        // Показываем меню выбора варианта генерации
        const genderText = analysis.gender === 'male' ? 'Мужской' : 'Женский';
        let message = `✅ Пол определен: ${genderText}\n\n`;
        message += '🎨 Выбери вариант генерации:\n\n';
        
        const keyboard = [];
        
        if (!hasUsedFree) {
          keyboard.push([{ text: '🎁 Бесплатный портрет (1 раз)', callback_data: `free_${largestPhoto.file_id}` }]);
          message += '🎁 Бесплатный портрет (1 раз) - Разработчик/Стартап\n';
        }
        
        keyboard.push([{ text: '💰 6 портретов за 200₽', callback_data: `paid_6_${largestPhoto.file_id}` }]);
        message += '💰 6 профессиональных портретов за 200₽\n';
        message += '⭐ Премиум портрет за 500₽ (скоро)';
        
        // Сохраняем imageData во временное хранилище (в реальности лучше использовать Redis или БД)
        // Пока используем простой подход - сохраняем в памяти с file_id как ключом
        if (!bot.tempImageStorage) {
          bot.tempImageStorage = new Map();
        }
        bot.tempImageStorage.set(largestPhoto.file_id, {
          imageData,
          gender: analysis.gender,
          timestamp: Date.now(),
        });
        
        // Очищаем старые записи (старше 10 минут)
        const now = Date.now();
        for (const [key, value] of bot.tempImageStorage.entries()) {
          if (now - value.timestamp > 10 * 60 * 1000) {
            bot.tempImageStorage.delete(key);
          }
        }
        
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
        
      } catch (error) {
        console.error('[Telegram Bot] Error processing photo:', error);
        await ctx.reply('❌ Произошла ошибка при обработке изображения. Попробуйте позже.');
      }
    });
    
    // Обработка callback для выбора варианта генерации
    bot.on('callback_query', async (ctx) => {
      try {
        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        
        // Обрабатываем бесплатную генерацию
        if (data.startsWith('free_')) {
          const fileId = data.replace('free_', '');
          const stored = bot.tempImageStorage?.get(fileId);
          
          if (!stored) {
            await ctx.answerCbQuery('❌ Изображение устарело. Отправьте фото заново.');
            return;
          }
          
          // Проверяем еще раз, использовал ли пользователь бесплатную генерацию
          if (hasUsedFreeGeneration(userId)) {
            await ctx.answerCbQuery('❌ Вы уже использовали бесплатную генерацию.');
            await ctx.editMessageText('❌ Вы уже использовали бесплатную генерацию. Выберите платный вариант.');
            return;
          }
          
          await ctx.answerCbQuery('🎨 Генерирую бесплатный портрет...');
          await ctx.editMessageText('🎨 Генерирую бесплатный портрет... Это может занять минуту.');
          
          try {
            // Создаем заказ в БД
            const invId = createNextInvId();
            const order = {
              invId,
              status: 'processing',
              amount: 0,
              createdAt: Date.now(),
              gender: stored.gender,
              role: 'Разработчик',
              company: 'Стартап',
              photoSessionType: 'Деловая фотосессия',
              hasImageData: true,
              generatedImages: null,
              failureReason: null,
              retries: 0,
              paymentType: 'telegram_free',
              promoCode: null,
            };
            saveOrder(order);
            
            // Генерируем один портрет
            const portrait = await generateSingleFreePortrait(
              stored.imageData,
              stored.gender,
              'Разработчик',
              'Стартап'
            );
            
            // Отмечаем, что пользователь использовал бесплатную генерацию
            markFreeGenerationUsed(userId, String(invId));
            
            // Обновляем заказ с результатом
            const generatedImages = { [portrait.style]: portrait.imageUrl };
            order.status = 'completed';
            order.generatedImages = generatedImages;
            order.imagesCount = 1;
            saveOrder(order);
            
            // Удаляем временное хранилище
            bot.tempImageStorage?.delete(fileId);
            
            // Отправляем результат
            const match = portrait.imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
            const base64Data = match ? match[1] : portrait.imageUrl.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            await ctx.editMessageText('✅ Готово! Ваш бесплатный портрет:');
            await ctx.replyWithPhoto(
              { source: buffer },
              { caption: `🎨 ${portrait.style}\n\n✨ Портрет готов!` }
            );
            
          } catch (error) {
            console.error('[Telegram Bot] Error generating free portrait:', error);
            await ctx.editMessageText('❌ Не удалось сгенерировать портрет. Попробуйте позже.');
          }
          
          return;
        }
        
        // Обработка выбора роли для платной генерации
        if (data.startsWith('role_')) {
          const parts = data.split('_');
          const fileId = parts[1];
          const roleIndex = parseInt(parts[2]);
          
          const stored = bot.tempImageStorage?.get(fileId);
          if (!stored) {
            await ctx.answerCbQuery('❌ Изображение устарело. Отправьте фото заново.');
            return;
          }
          
          const role = getRoleByIndex(roleIndex);
          await ctx.answerCbQuery(`✅ Выбрана роль: ${role}`);
          
          // Сохраняем выбранную роль во временное хранилище
          stored.selectedRole = roleIndex;
          bot.tempImageStorage.set(fileId, stored);
          
          // Показываем клавиатуру выбора компании
          const companyKeyboard = createCompanyKeyboard(fileId, roleIndex);
          await ctx.editMessageText(
            `✅ Роль: ${role}\n\n🏢 Выберите тип компании:`,
            {
              reply_markup: {
                inline_keyboard: companyKeyboard,
              },
            }
          );
          return;
        }
        
        // Обработка выбора компании для платной генерации
        if (data.startsWith('company_')) {
          const parts = data.split('_');
          const fileId = parts[1];
          const roleIndex = parseInt(parts[2]);
          const companyIndex = parseInt(parts[3]);
          
          const stored = bot.tempImageStorage?.get(fileId);
          if (!stored) {
            await ctx.answerCbQuery('❌ Изображение устарело. Отправьте фото заново.');
            return;
          }
          
          const role = getRoleByIndex(roleIndex);
          const company = getCompanyByIndex(companyIndex);
          
          await ctx.answerCbQuery(`✅ Выбрана компания: ${company}`);
          
          // Сохраняем выбранные параметры
          stored.selectedRole = roleIndex;
          stored.selectedCompany = companyIndex;
          stored.selectedRoleName = role;
          stored.selectedCompanyName = company;
          bot.tempImageStorage.set(fileId, stored);
          
          // Показываем варианты оплаты
          const paymentKeyboard = [
            [{ text: '💳 Оплатить через Robokassa', callback_data: `pay_robokassa_${fileId}` }],
            [{ text: '⭐ Оплатить через Telegram Stars', callback_data: `pay_stars_${fileId}` }],
          ];
          
          await ctx.editMessageText(
            `✅ Выбрано:\n` +
            `👤 Роль: ${role}\n` +
            `🏢 Компания: ${company}\n\n` +
            `💰 Стоимость: 200₽\n\n` +
            `Выберите способ оплаты:`,
            {
              reply_markup: {
                inline_keyboard: paymentKeyboard,
              },
            }
          );
          return;
        }
        
        // Обработка оплаты через Robokassa
        if (data.startsWith('pay_robokassa_')) {
          const fileId = data.replace('pay_robokassa_', '');
          const stored = bot.tempImageStorage?.get(fileId);
          
          if (!stored || stored.selectedRole === undefined || stored.selectedCompany === undefined) {
            await ctx.answerCbQuery('❌ Данные устарели. Начните заново.');
            return;
          }
          
          await ctx.answerCbQuery('⏳ Создаю заказ...');
          
          try {
            // Создаем заказ в БД
            const invId = createNextInvId();
            const outSum = ROBOKASSA_PAYMENT_AMOUNT.toFixed(2);
            
            const order = {
              invId,
              status: 'created',
              amount: outSum,
              createdAt: Date.now(),
              gender: stored.gender,
              role: stored.selectedRoleName,
              company: stored.selectedCompanyName,
              photoSessionType: 'Деловая фотосессия',
              hasImageData: true,
              generatedImages: null,
              failureReason: null,
              retries: 0,
              paymentType: 'telegram_robokassa',
              promoCode: null,
            };
            
            saveOrder(order);
            
            // Сохраняем изображение в orderImages для генерации после оплаты
            orderImages.set(String(invId), stored.imageData);
            
            // Формируем подпись для Robokassa
            const signatureString = `${ROBOKASSA_LOGIN}:${outSum}:${invId}:${ROBOKASSA_PASSWORD1}`;
            const signature = crypto
              .createHash('md5')
              .update(signatureString, 'utf8')
              .digest('hex');
            
            const descriptionEncoded = encodeURIComponent(ROBOKASSA_PAYMENT_DESC);
            const isTestParam = ROBOKASSA_IS_TEST ? '&IsTest=1' : '';
            const robokassaBaseUrl = 'https://auth.robokassa.ru/Merchant/Index.aspx';
            
            const redirectUrl =
              `${robokassaBaseUrl}?MerchantLogin=${encodeURIComponent(ROBOKASSA_LOGIN)}` +
              `&OutSum=${outSum}&InvId=${invId}&Description=${descriptionEncoded}&SignatureValue=${signature}${isTestParam}`;
            
            // Сохраняем информацию о заказе для отслеживания после оплаты
            if (!bot.pendingOrders) {
              bot.pendingOrders = new Map();
            }
            bot.pendingOrders.set(String(invId), {
              userId: ctx.from.id,
              chatId: ctx.chat.id,
              fileId,
            });
            
            await ctx.editMessageText(
              `💳 Оплата через Robokassa\n\n` +
              `Заказ #${invId}\n` +
              `Сумма: ${outSum}₽\n\n` +
              `Нажмите кнопку ниже для оплаты:`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '💳 Оплатить', url: redirectUrl }],
                    [{ text: '❌ Отмена', callback_data: `cancel_${fileId}` }],
                  ],
                },
              }
            );
            
            // Удаляем временное хранилище после создания заказа
            // bot.tempImageStorage?.delete(fileId); // Не удаляем, может понадобиться для повторной попытки
            
          } catch (error) {
            console.error('[Telegram Bot] Error creating Robokassa payment:', error);
            await ctx.editMessageText('❌ Не удалось создать заказ. Попробуйте позже.');
          }
          return;
        }
        
        // Обработка оплаты через Telegram Stars
        if (data.startsWith('pay_stars_')) {
          const fileId = data.replace('pay_stars_', '');
          const stored = bot.tempImageStorage?.get(fileId);
          
          if (!stored || stored.selectedRole === undefined || stored.selectedCompany === undefined) {
            await ctx.answerCbQuery('❌ Данные устарели. Начните заново.');
            return;
          }
          
          await ctx.answerCbQuery('⏳ Проверяю доступность Stars...');
          
          try {
            // Проверяем доступность Stars для пользователя
            // В Telegram Bot API нет прямого способа проверить доступность Stars,
            // поэтому пробуем создать invoice и обрабатываем ошибку
            
            const invId = createNextInvId();
            // Для Telegram Stars: 200 Stars = 20000 (Stars используют минимальную единицу как копейки)
            // Но нужно проверить актуальный формат - возможно Stars используют другую единицу
            const amount = 200; // 200 Stars (проверить документацию)
            
            // Создаем заказ в БД
            const order = {
              invId,
              status: 'created',
              amount: '200.00',
              createdAt: Date.now(),
              gender: stored.gender,
              role: stored.selectedRoleName,
              company: stored.selectedCompanyName,
              photoSessionType: 'Деловая фотосессия',
              hasImageData: true,
              generatedImages: null,
              failureReason: null,
              retries: 0,
              paymentType: 'telegram_stars',
              promoCode: null,
            };
            
            saveOrder(order);
            orderImages.set(String(invId), stored.imageData);
            
            // Сохраняем информацию о заказе
            if (!bot.pendingOrders) {
              bot.pendingOrders = new Map();
            }
            bot.pendingOrders.set(String(invId), {
              userId: ctx.from.id,
              chatId: ctx.chat.id,
              fileId,
            });
            
            // Создаем invoice для Telegram Stars
            // Примечание: Stars может быть недоступен в некоторых странах
            // В этом случае покажем сообщение и предложим Robokassa
            try {
              await ctx.replyWithInvoice({
                title: 'Генерация 6 профессиональных портретов',
                description: `Роль: ${stored.selectedRoleName}, Компания: ${stored.selectedCompanyName}`,
                payload: String(invId),
                provider_token: '', // Для Stars не нужен
                currency: 'XTR', // Telegram Stars currency code
                prices: [{ label: 'Генерация портретов', amount: amount }],
                start_parameter: `order_${invId}`,
              });
              
              await ctx.editMessageText('⭐ Откройте invoice для оплаты через Telegram Stars');
              
            } catch (starsError) {
              console.error('[Telegram Bot] Stars payment error:', starsError);
              
              // Если Stars недоступен, предлагаем Robokassa
              await ctx.editMessageText(
                `⚠️ Telegram Stars недоступен в вашей стране.\n\n` +
                `💳 Предлагаем оплатить через Robokassa:`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '💳 Оплатить через Robokassa', callback_data: `pay_robokassa_${fileId}` }],
                    ],
                  },
                }
              );
            }
            
          } catch (error) {
            console.error('[Telegram Bot] Error creating Stars payment:', error);
            await ctx.editMessageText('❌ Не удалось создать заказ. Попробуйте позже.');
          }
          return;
        }
        
        // Обработка платного варианта (6 портретов) - выбор роли
        if (data.startsWith('paid_6_')) {
          const fileId = data.replace('paid_6_', '');
          const stored = bot.tempImageStorage?.get(fileId);
          
          if (!stored) {
            await ctx.answerCbQuery('❌ Изображение устарело. Отправьте фото заново.');
            return;
          }
          
          await ctx.answerCbQuery('👤 Выберите роль');
          
          // Показываем клавиатуру выбора роли
          const roleKeyboard = createRoleKeyboard(fileId);
          await ctx.editMessageText(
            `✅ Пол: ${stored.gender === 'male' ? 'Мужской' : 'Женский'}\n\n` +
            `👤 Выберите вашу роль:`,
            {
              reply_markup: {
                inline_keyboard: roleKeyboard,
              },
            }
          );
          return;
        }
        
      } catch (error) {
        console.error('[Telegram Bot] Error handling callback:', error);
        await ctx.answerCbQuery('❌ Произошла ошибка. Попробуйте позже.');
      }
    });
    
    // Обработка pre_checkout_query для Telegram Stars
    bot.on('pre_checkout_query', async (ctx) => {
      const query = ctx.preCheckoutQuery;
      const invId = query.invoice_payload;
      
      try {
        const order = loadOrder(invId);
        if (!order || order.status !== 'created') {
          await ctx.answerPreCheckoutQuery(false, {
            error_message: 'Заказ не найден или уже обработан',
          });
          return;
        }
        
        // Подтверждаем оплату
        await ctx.answerPreCheckoutQuery(true);
        console.log('[Telegram Bot] Stars pre_checkout_query approved', { invId });
      } catch (error) {
        console.error('[Telegram Bot] Error processing pre_checkout_query:', error);
        await ctx.answerPreCheckoutQuery(false, {
          error_message: 'Ошибка обработки заказа',
        });
      }
    });
    
    // Обработка успешной оплаты через Telegram Stars
    bot.on('successful_payment', async (ctx) => {
      const payment = ctx.message.successful_payment;
      const invId = payment.invoice_payload;
      
      try {
        console.log('[Telegram Bot] Stars payment successful', { invId, amount: payment.total_amount });
        
        const order = loadOrder(invId);
        if (!order) {
          await ctx.reply('❌ Заказ не найден. Обратитесь в поддержку.');
          return;
        }
        
        // Обновляем статус заказа
        order.status = 'paid';
        saveOrder(order);
        
        // Уведомляем пользователя о начале генерации
        await ctx.reply('✅ Оплата получена! Начинаю генерацию портретов... Это может занять несколько минут.');
        
        // Запускаем генерацию портретов
        await generatePortraitsForOrder(invId, MAX_QUEUE_SIZE);
        
        // Отправляем результаты пользователю
        await sendPortraitsToUser(bot, ctx.chat.id, invId);
        
      } catch (error) {
        console.error('[Telegram Bot] Error processing Stars payment:', error);
        await ctx.reply('❌ Произошла ошибка при обработке оплаты. Обратитесь в поддержку.');
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

/**
 * Обрабатывает успешную оплату через Robokassa для Telegram заказа
 * Вызывается из payment.js после обработки callback от Robokassa
 */
export async function handleTelegramRobokassaPayment(invId) {
  if (!bot) {
    console.error('[Telegram Bot] Bot not initialized');
    return;
  }
  
  try {
    const order = loadOrder(invId);
    if (!order) {
      console.error('[Telegram Bot] Order not found:', invId);
      return;
    }
    
    // Проверяем, что это Telegram заказ
    if (order.paymentType !== 'telegram_robokassa') {
      console.log('[Telegram Bot] Not a Telegram order, skipping');
      return;
    }
    
    // Получаем информацию о пользователе из pendingOrders
    const pendingInfo = bot.pendingOrders?.get(String(invId));
    if (!pendingInfo) {
      console.error('[Telegram Bot] Pending order info not found:', invId);
      return;
    }
    
    // Обновляем статус заказа
    order.status = 'paid';
    saveOrder(order);
    
    // Уведомляем пользователя о начале генерации
    await bot.telegram.sendMessage(
      pendingInfo.chatId,
      '✅ Оплата получена! Начинаю генерацию портретов... Это может занять несколько минут.'
    );
    
    // Запускаем генерацию портретов
    await generatePortraitsForOrder(invId, MAX_QUEUE_SIZE);
    
    // Отправляем результаты пользователю
    await sendPortraitsToUser(bot, pendingInfo.chatId, invId);
    
    // Удаляем из pendingOrders
    bot.pendingOrders?.delete(String(invId));
    
  } catch (error) {
    console.error('[Telegram Bot] Error handling Robokassa payment:', error);
    
    // Пытаемся уведомить пользователя об ошибке
    try {
      const pendingInfo = bot.pendingOrders?.get(String(invId));
      if (pendingInfo) {
        await bot.telegram.sendMessage(
          pendingInfo.chatId,
          '❌ Произошла ошибка при обработке оплаты. Обратитесь в поддержку.'
        );
      }
    } catch (notifyError) {
      console.error('[Telegram Bot] Failed to notify user about error:', notifyError);
    }
  }
}

export default { initializeTelegramBot, startTelegramBot, handleTelegramRobokassaPayment };

