/**
 * Скрипт для проверки доступных моделей Gemini API
 * Запуск: node server/check-models.js
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });

const API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_GENERATION;

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY не найден в переменных окружения');
  process.exit(1);
}

const genAI = new GoogleGenAI(API_KEY);

async function checkModels() {
  console.log('🔍 Проверка доступных моделей Gemini API для генерации изображений...\n');
  
  // Список моделей для проверки (только те, что могут поддерживать генерацию изображений)
  const modelsToCheck = [
    'gemini-3-pro-image-preview', // Новая модель для проверки
    'gemini-2.5-flash-image',      // Текущая рабочая модель
    'gemini-2.5-pro-image',        // Пробовали, не работает
    'gemini-3.0-pro-image',        // Возможная версия
    'gemini-3-pro-image',          // Без preview суффикса
    'gemini-2.0-flash-exp',        // Возможная альтернатива
    'imagen-3.0-generate-001',     // Imagen модели
    'imagen-3',
  ];
  
  console.log('Проверяем модели для генерации изображений:\n');
  
  for (const modelName of modelsToCheck) {
    try {
      console.log(`\n📌 Проверяем: ${modelName}`);
      
      // Пробуем проверить модель с Modality.IMAGE
      const testConfig = {
        model: modelName,
        contents: { 
          parts: [{ 
            text: 'Generate a simple test image' 
          }] 
        },
        config: {
          responseModalities: ['IMAGE'],
        },
      };
      
      try {
        const response = await genAI.models.generateContent(testConfig);
        console.log(`    ✅ Модель ${modelName} РАБОТАЕТ для генерации изображений!`);
        console.log(`    📊 Ответ получен: ${response.candidates?.[0] ? 'есть кандидаты' : 'нет кандидатов'}`);
      } catch (error) {
        const errorMsg = error?.message || String(error);
        const errorCode = error?.code || error?.status;
        
        if (errorCode === 404 || errorMsg.includes('404') || errorMsg.includes('not found')) {
          console.log(`    ❌ Модель не найдена (404)`);
        } else if (errorMsg.includes('not supported') || errorMsg.includes('not supported for generateContent')) {
          console.log(`    ⚠️  Модель найдена, но не поддерживает генерацию изображений`);
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
          console.log(`    ⚠️  Rate limit - модель существует, но превышен лимит запросов`);
        } else {
          console.log(`    ⚠️  Ошибка: ${errorMsg.substring(0, 150)}`);
          console.log(`    📋 Код ошибки: ${errorCode || 'неизвестно'}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ ${modelName} - критическая ошибка: ${error.message?.substring(0, 100)}`);
    }
  }
  
  console.log('\n\n📝 Рекомендации:');
  console.log('   1. Проверьте официальную документацию:');
  console.log('      https://ai.google.dev/models/gemini');
  console.log('      https://ai.google.dev/gemini-api/docs/models/gemini');
  console.log('   2. Проверьте Google AI Studio:');
  console.log('      https://aistudio.google.com/');
  console.log('   3. Текущая рабочая модель: gemini-2.5-flash-image');
}

checkModels().catch(console.error);

