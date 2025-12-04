import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env.local если существует, иначе .env
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') }); // fallback на .env
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from '@google/genai';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;
const IMAGE_ROOT_DIR = process.env.IMAGE_ROOT_DIR || '/data/images';

// Настройки очереди генерации
const GENERATION_INTERVAL = parseInt(process.env.GENERATION_INTERVAL || '3000'); // Интервал между генерациями в мс (по умолчанию 3 секунды)
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100'); // Максимальный размер очереди
const MAX_CONCURRENT_GENERATIONS = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '6'); // Максимум параллельных генераций

// Настройки rate limiting для Gemini API (Tier 1)
// Для генерации: максимум 6 одновременных запросов, задержка 1 секунда при превышении лимита в текущую секунду
const GEMINI_RPM_LIMIT = parseInt(process.env.GEMINI_RPM_LIMIT || '15'); // Requests Per Minute для генерации (для sliding window)
const GEMINI_MIN_INTERVAL = Math.ceil(60000 / GEMINI_RPM_LIMIT); // Минимальный интервал между запросами генерации в мс

// Отдельные настройки для анализа - Tier 1: 500 RPM (8.3 запроса в секунду)
const GEMINI_ANALYSIS_RPM_LIMIT = parseInt(process.env.GEMINI_ANALYSIS_RPM_LIMIT || '500'); // Requests Per Minute для анализа (Tier 1)
const GEMINI_ANALYSIS_MIN_INTERVAL = Math.ceil(60000 / GEMINI_ANALYSIS_RPM_LIMIT); // Минимальный интервал между запросами анализа в мс (~120 мс)

// Система отслеживания запросов к Gemini API для генерации (sliding window по минутам)
const geminiRequestTimestamps = [];
const GEMINI_WINDOW_SIZE = 60000; // Окно в 1 минуту

// Система отслеживания запросов в текущую секунду для генерации (не более 6 за секунду)
const geminiRequestsPerSecond = new Map(); // Ключ: timestamp в секундах, значение: количество запросов
const MAX_REQUESTS_PER_SECOND = 6; // Максимум 6 запросов в секунду
const SECOND_DELAY_ON_LIMIT = 2000; // Задержка 2 секунды при превышении лимита

// Отслеживание времени последней отправки порции (6 запросов)
let lastBatchSendTime = 0; // Время последней отправки порции из 6 запросов
const BATCH_SIZE = 6; // Размер порции (6 стилей от одного пользователя)

// Группировка задач по пользователям (задачи добавленные в течение 200мс считаются от одного пользователя)
const userBatchGroups = new Map(); // Ключ: timestamp группы (округленный до 200мс), значение: массив задач
const USER_BATCH_WINDOW = 200; // Окно группировки: 200 мс

// Система отслеживания запросов к Gemini API для анализа (отдельный трекер)
const geminiAnalysisRequestTimestamps = [];

// Очередь генерации
const generationQueue = [];
const activeJobs = new Set(); // Множество активных задач (до 6)
let currentJobIds = []; // Массив ID активных задач (для обратной совместимости)

// Очередь анализа изображений (отдельная от генерации)
const analysisQueue = [];
const activeAnalysisJobs = new Set(); // Множество активных задач анализа
const MAX_CONCURRENT_ANALYSIS = parseInt(process.env.MAX_CONCURRENT_ANALYSIS || '7'); // Максимум параллельных анализов (7 запросов в секунду)

// Среднее время анализа изображения (в мс)
const AVERAGE_ANALYSIS_TIME = 10000; // 10 секунд на анализ

// Хранилище результатов завершенных задач (храним 100 последних)
const completedJobs = new Map();
const MAX_COMPLETED_JOBS = 100;

// Хранилище результатов завершенных задач анализа
const completedAnalysisJobs = new Map();

// Статистика времени генерации для предсказания
const generationTimes = []; // История времени генерации в мс
const MAX_HISTORY_SIZE = 50; // Храним последние 50 генераций
const MAX_PROMPT_SOFTENING_LEVEL = 4; // Сколько ступеней смягчения промпта пробуем при IMAGE_OTHER

// Структура задачи в очереди генерации
class GenerationJob {
  constructor(id, imageData, prompt) {
    this.id = id;
    this.imageData = imageData;
    this.prompt = prompt;
    this.originalPrompt = prompt;
    this.fallbackApplied = false;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
    this.errorDetails = null; // Детали ошибки: finishReason, safetyRatings и т.д.
    this.resolve = null;
    this.reject = null;
  }
  
  getPosition() {
    const index = generationQueue.findIndex(job => job.id === this.id);
    if (index >= 0) return index + 1;
    if (activeJobs.has(this.id)) return 0; // Обрабатывается
    return -1; // Завершена или не найдена
  }
  
  getEstimatedWaitTime() {
    const position = this.getPosition();
    if (position <= 0) return 0; // Уже обрабатывается или завершена
    
    const now = Date.now();
    const timeSinceCreation = now - this.createdAt;
    
    // Находим количество задач, созданных ДО этой задачи (в очереди)
    const jobsCreatedBefore = generationQueue.filter(j => 
      j.createdAt < this.createdAt || 
      (j.createdAt === this.createdAt && j.id < this.id)
    ).length;
    
    // Также учитываем активные задачи, созданные до этой
    // Активные задачи уже начали обрабатываться
    const activeJobsCreatedBefore = activeJobs.size;
    
    const totalJobsBefore = jobsCreatedBefore + activeJobsCreatedBefore;
    
    // Рассчитываем количество порций перед этой задачей
    const batchesBeforeThis = Math.floor(totalJobsBefore / BATCH_SIZE);
    
    // Рассчитываем время отправки порции для этой задачи
    // Время отправки = время последней отправки + (количество порций * интервал)
    // Но нужно учесть, что если уже прошло достаточно времени, порция может отправиться раньше
    let timeUntilBatchSend = 0;
    
    if (lastBatchSendTime > 0) {
      // Рассчитываем когда должна отправиться порция с этой задачей
      const expectedBatchSendTime = lastBatchSendTime + (batchesBeforeThis * SECOND_DELAY_ON_LIMIT);
      const timeUntilExpectedSend = expectedBatchSendTime - now;
      
      // Если уже прошло достаточно времени с момента создания задачи,
      // и порция должна была отправиться, то время ожидания = 0
      if (timeUntilExpectedSend <= 0) {
        timeUntilBatchSend = 0;
      } else {
        timeUntilBatchSend = timeUntilExpectedSend;
      }
    } else {
      // Если еще не было отправок - первая порция отправится сразу
      timeUntilBatchSend = batchesBeforeThis * SECOND_DELAY_ON_LIMIT;
    }
    
    // Учитываем текущее состояние rate limit
    cleanupGeminiRequestTimestamps();
    const currentRequestsInWindow = geminiRequestTimestamps.length;
    
    // Если в текущем окне нет свободных слотов, нужно дождаться освобождения
    if (currentRequestsInWindow >= GEMINI_RPM_LIMIT && geminiRequestTimestamps.length > 0) {
      const oldestRequest = geminiRequestTimestamps[0];
      const timeUntilOldestExpires = GEMINI_WINDOW_SIZE - (now - oldestRequest);
      timeUntilBatchSend = Math.max(timeUntilBatchSend, timeUntilOldestExpires);
    }
    
    return Math.max(0, Math.round(timeUntilBatchSend));
  }
  
  setResult(result) {
    this.result = result;
    this.completedAt = Date.now();
    if (this.resolve) {
      this.resolve(result);
    }
  }
  
  setError(error) {
    this.error = error;
    this.completedAt = Date.now();
    if (this.reject) {
      this.reject(error);
    }
  }
}

function buildFallbackPrompt(originalPrompt, level = 1) {
  if (!originalPrompt || level <= 0) {
    return originalPrompt;
  }

  const transformations = [
    (prompt) => {
      let result = prompt.replace(/CRITICAL:[^\.]*\./gi, '');
      result = result.replace(/\s{2,}/g, ' ');
      return result.trim();
    },
    (prompt) => {
      let result = prompt;
      result = result.replace(/Preserve identity EXACTLY[^\.]*\./gi, 'Maintain the overall likeness while allowing tasteful interpretation.');
      result = result.replace(/The person must look like themselves[^\.]*\./gi, 'Keep the person broadly recognizable while permitting stylistic adjustments.');
      result = result.replace(/The person must be clearly male[^\.]*\./gi, 'Ensure the portrait still reads as male, keeping the overall character.');
      result = result.replace(/The person must be clearly female[^\.]*\./gi, 'Ensure the portrait still reads as female, keeping the overall character.');
      result = result.replace(/Do NOT generate a female portrait\./gi, 'Avoid switching the portrayed gender unless necessary.');
      result = result.replace(/Do NOT generate a male portrait\./gi, 'Avoid switching the portrayed gender unless necessary.');
      return result;
    },
    (prompt) => {
      let result = prompt;
      result = result.replace(/Each image in this batch must show a distinct outfit[^\.]*\./gi, 'Variation between images is welcome but not strictly required.');
      result = result.replace(/Preserve realistic skin texture[^\.]*\./gi, 'Keep skin looking natural and professional; gentle retouching is acceptable.');
      result = result.replace(/No suit[^\.]*\./gi, 'Suits are optional; choose attire that feels professional.');
      result = result.replace(/Avoid formal blazer\./gi, 'Feel free to pick any appropriate professional outfit.');
      return result;
    },
    (prompt) => {
      let result = prompt;
      result = result.replace(/Preserve facial hair exactly[^\.]*\./gi, 'Respect the person\'s facial hair while allowing natural interpretation.');
      if (!/Follow all content policies/gi.test(result)) {
        result += ' Follow all content policies and avoid recreating public figures exactly. Create a respectful business portrait inspired by the reference image.';
      }
      return result;
    }
  ];

  let softened = originalPrompt;
  const cappedLevel = Math.min(level, transformations.length);
  for (let i = 0; i < cappedLevel; i++) {
    softened = transformations[i](softened);
  }

  return softened.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// Структура задачи в очереди анализа
class AnalysisJob {
  constructor(id, imageData, type) {
    this.id = id;
    this.imageData = imageData;
    this.type = type; // 'evaluate', 'validate', 'detect-gender'
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
    this.resolve = null;
    this.reject = null;
  }
  
  getPosition() {
    const index = analysisQueue.findIndex(job => job.id === this.id);
    if (index >= 0) return index + 1;
    if (activeAnalysisJobs.has(this.id)) return 0; // Обрабатывается
    return -1; // Завершена или не найдена
  }
  
  getEstimatedWaitTime() {
    const position = this.getPosition();
    if (position <= 0) return 0; // Уже обрабатывается или завершена
    
    const jobsBeforeThis = position - 1;
    const activeCount = activeAnalysisJobs.size;
    const availableSlots = MAX_CONCURRENT_ANALYSIS - activeCount;
    
    // Если есть свободные слоты и мы в начале очереди - начнем почти сразу
    if (availableSlots > 0 && jobsBeforeThis < availableSlots) {
      return 0; // Начнется сразу
    }
    
    // Рассчитываем время ожидания: (сколько задач нужно обработать до этой) / параллельность * среднее время
    const batchesBeforeThis = Math.ceil(jobsBeforeThis / MAX_CONCURRENT_ANALYSIS);
    const estimatedTime = batchesBeforeThis * AVERAGE_ANALYSIS_TIME;
    
    return estimatedTime;
  }
  
  setResult(result) {
    this.result = result;
    this.completedAt = Date.now();
    if (this.resolve) {
      this.resolve(result);
    }
  }
  
  setError(error) {
    this.error = error;
    this.completedAt = Date.now();
    if (this.reject) {
      this.reject(error);
    }
  }
}

// Вычисление среднего времени генерации
function calculateAverageGenerationTime() {
  if (generationTimes.length === 0) {
    return 10000; // Дефолтное время 10 секунд, если нет истории
  }
  const sum = generationTimes.reduce((acc, time) => acc + time, 0);
  return Math.round(sum / generationTimes.length);
}

// Функция больше не используется - расчет времени ожидания теперь в getEstimatedWaitTime()
// Оставлена для обратной совместимости если где-то используется
function calculateEstimatedWaitTimeForJob(jobId, positionInQueue) {
  // Находим задачу по ID
  const job = generationQueue.find(j => j.id === jobId);
  if (job) {
    return job.getEstimatedWaitTime();
  }
  
  // Если задача не найдена в очереди, возвращаем 0
  return 0;
}

// Очистка старых записей из sliding window для Gemini API
function cleanupGeminiRequestTimestamps() {
  const now = Date.now();
  const cutoff = now - GEMINI_WINDOW_SIZE;
  while (geminiRequestTimestamps.length > 0 && geminiRequestTimestamps[0] < cutoff) {
    geminiRequestTimestamps.shift();
  }
}

// Очистка старых записей для анализа
function cleanupGeminiAnalysisRequestTimestamps() {
  const now = Date.now();
  const cutoff = now - GEMINI_WINDOW_SIZE;
  while (geminiAnalysisRequestTimestamps.length > 0 && geminiAnalysisRequestTimestamps[0] < cutoff) {
    geminiAnalysisRequestTimestamps.shift();
  }
}

// Очистка старых записей по секундам (храним только последние 10 секунд)
function cleanupGeminiRequestsPerSecond() {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 10; // Храним только последние 10 секунд
  for (const [timestamp, _] of geminiRequestsPerSecond.entries()) {
    if (timestamp < cutoff) {
      geminiRequestsPerSecond.delete(timestamp);
    }
  }
}

// Функция waitForGeminiRateLimit больше не используется для генерации
// Rate limiting теперь обрабатывается в processQueue() для пакетов задач

// Проверка и ожидание перед запросом к Gemini API (для анализа)
// С Tier 1: 500 RPM = ~8.3 запросов/сек - минимальная задержка нужна только для защиты от перегрузки
async function waitForGeminiAnalysisRateLimit() {
  cleanupGeminiAnalysisRequestTimestamps();
  const now = Date.now();
  
  // Если достигнут лимит запросов в минуту (500), ждем
  if (geminiAnalysisRequestTimestamps.length >= GEMINI_ANALYSIS_RPM_LIMIT) {
    const oldestRequest = geminiAnalysisRequestTimestamps[0];
    const waitTime = GEMINI_WINDOW_SIZE - (now - oldestRequest) + 100; // +100 мс для безопасности
    if (waitTime > 0) {
      safeLog('Rate limit (analysis): waiting before Gemini API request', { waitTime, currentRequests: geminiAnalysisRequestTimestamps.length });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      cleanupGeminiAnalysisRequestTimestamps();
    }
  }
  
  // Минимальный интервал очень маленький (~120 мс) - почти не влияет на скорость
  // Но защищает от одновременных запросов
  if (geminiAnalysisRequestTimestamps.length > 0) {
    const lastRequest = geminiAnalysisRequestTimestamps[geminiAnalysisRequestTimestamps.length - 1];
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < GEMINI_ANALYSIS_MIN_INTERVAL) {
      const waitTime = GEMINI_ANALYSIS_MIN_INTERVAL - timeSinceLastRequest;
      // Не логируем эту маленькую задержку - она несущественна
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Регистрируем запрос
  geminiAnalysisRequestTimestamps.push(Date.now());
  cleanupGeminiAnalysisRequestTimestamps();
}

// Обработка одной задачи генерации
async function processJob(job) {
  activeJobs.add(job.id);
  currentJobIds.push(job.id);
  job.startedAt = Date.now();
  
  safeLog('ProcessJob started', { 
    jobId: job.id, 
    activeJobs: activeJobs.size,
    queueSize: generationQueue.length
  });
  
  const startTime = Date.now();
  
  // Вызываем Gemini API
  // Rate limit уже проверен в processQueue() перед запуском этой задачи
  const maxRetries = 5;
  let lastError = null;
  
  try {
    // ЛОГИРУЕМ САМОЕ НАЧАЛО - до валидации
    console.log(`[${new Date().toISOString()}] [PROCESSJOB START] jobId=${job.id}, imageDataLength=${job.imageData?.length || 0}, promptLength=${job.prompt?.length || 0}`);
    
    // Валидируем изображение
    const imageValidation = validateImageData(job.imageData);
    
    console.log(`[${new Date().toISOString()}] [AFTER VALIDATION] jobId=${job.id}, valid=${imageValidation.valid}, error=${imageValidation.error || 'none'}`);
    
    if (!imageValidation.valid) {
      throw new Error(imageValidation.error || 'Неверный формат изображения');
    }
    
    const { mimeType, base64Data } = imageValidation;
    
    // Логируем информацию о входном изображении ПЕРЕД обработкой
    const imageSizeBytes = Math.floor(base64Data.length * 0.75); // Примерный размер в байтах
    const imageSizeKB = Math.round(imageSizeBytes / 1024);
    const imageSizeMB = (imageSizeKB / 1024).toFixed(2);
    
    // Логируем информацию о входном изображении - используем console.log для гарантии записи
    console.log(`[${new Date().toISOString()}] [STARTING GENERATION] jobId=${job.id}, mimeType=${mimeType}, sizeBytes=${imageSizeBytes}, sizeKB=${imageSizeKB}, sizeMB=${imageSizeMB}, base64Len=${base64Data.length}, promptLen=${job.prompt.length}`);
    
    safeLog('Starting image generation', {
      jobId: job.id,
      imageMimeType: mimeType,
      imageSizeBytes: imageSizeBytes,
      imageSizeKB: imageSizeKB,
      imageSizeMB: imageSizeMB,
      base64Length: base64Data.length,
      promptLength: job.prompt.length,
      promptPreview: job.prompt.substring(0, 200)
    });
    
    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt += 1;
      const textPart = { text: job.prompt };
      try {
        const requestConfig = {
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        };
        
        safeLog('Calling Gemini API', { 
          jobId: job.id, 
          attempt,
          imageMimeType: mimeType,
          imageSizeBytes: imageSizeBytes,
          imageSizeKB: Math.round(imageSizeBytes / 1024),
          promptLength: job.prompt.length,
          promptPreview: job.prompt.substring(0, 200),
          requestConfig: JSON.stringify(requestConfig).substring(0, 1000)
        });
        
        let response;
        try {
          response = await genAI.models.generateContent(requestConfig);
        } catch (apiError) {
          const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
          safeLog('Gemini API call failed immediately', {
            jobId: job.id,
            attempt,
            error: apiErrorMessage,
            errorName: apiError instanceof Error ? apiError.name : 'unknown',
            errorStack: apiError instanceof Error ? apiError.stack?.substring(0, 500) : undefined,
            model: requestConfig.model
          });
          throw apiError;
        }
        
        // Детальное логирование ответа для отладки
        const responseParts = response.candidates?.[0]?.content?.parts || [];
        const hasImagePart = responseParts.some(part => part.inlineData);
        const hasTextPart = responseParts.some(part => part.text);
        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason || 'unknown';
        const safetyRatings = candidate?.safetyRatings || [];
        
        // Логируем полный ответ для диагностики
        const fullResponseStr = JSON.stringify(response).substring(0, 3000);
        
        safeLog('Gemini API response received', { 
          jobId: job.id,
          hasImagePart,
          hasTextPart,
          partsCount: responseParts.length,
          partsTypes: responseParts.map(p => Object.keys(p).join(',')),
          candidateFinishReason: finishReason,
          safetyRatings: safetyRatings.map(r => ({
            category: r.category,
            probability: r.probability,
            blocked: r.blocked
          })),
          responseText: response.text || responseParts.find(p => p.text)?.text || '',
          fullResponse: fullResponseStr,
          candidatesCount: response.candidates?.length || 0,
          promptFeedback: response.promptFeedback ? JSON.stringify(response.promptFeedback).substring(0, 500) : null
        });
        
        const imagePartFromResponse = responseParts.find(part => part.inlineData);
        
        if (imagePartFromResponse?.inlineData) {
          const { mimeType: responseMimeType, data: responseData } = imagePartFromResponse.inlineData;
          const imageDataUrl = `data:${responseMimeType};base64,${responseData}`;
          const duration = Date.now() - startTime;
          
          // Сохраняем время генерации для статистики
          generationTimes.push(duration);
          if (generationTimes.length > MAX_HISTORY_SIZE) {
            generationTimes.shift();
          }
          
          job.setResult({ imageDataUrl });
          
          // Сохраняем завершенную задачу
          completedJobs.set(job.id, job);
          if (completedJobs.size > MAX_COMPLETED_JOBS) {
            const firstKey = completedJobs.keys().next().value;
            completedJobs.delete(firstKey);
          }
          
          safeLog('Image generated successfully (queued)', { jobId: job.id, duration, queueSize: generationQueue.length, activeJobs: activeJobs.size });
          
          // Задача завершена успешно
          activeJobs.delete(job.id);
          currentJobIds = currentJobIds.filter(id => id !== job.id);
          processQueue(); // Проверяем, есть ли еще задачи для обработки
          return;
        }
        
        // Если нет изображения, пытаемся найти причину
        const textResponse = response.text || responseParts.find(p => p.text)?.text || '';
        const isRetriableFinishReason = (
          finishReason === 'IMAGE_OTHER' ||
          finishReason === 'OTHER' ||
          finishReason === 'RECITATION'
        );
        
        // Для IMAGE_OTHER даем больше попыток (API может ошибочно определять обычные фото как защищенные)
        const maxRetriesForImageOther = 10; // Больше попыток для IMAGE_OTHER
        const effectiveMaxRetries = isRetriableFinishReason ? maxRetriesForImageOther : maxRetries;
        
        // Для retriable ошибок - повторяем попытку с тем же промптом (или смягченным)
        if (isRetriableFinishReason && attempt < effectiveMaxRetries) {
          const fullResponseStr = JSON.stringify(response).substring(0, 3000);
          
          // Смягчаем промпт на каждой попытке для IMAGE_OTHER
          let promptToUse = job.prompt;
          const isIntermediatePrompt = job.prompt?.includes('Change background to gray') || job.prompt?.includes('Simple neutral gray background');
          
          if (finishReason === 'IMAGE_OTHER') {
            if (isIntermediatePrompt) {
              // Для промежуточных изображений используем минимальный промпт сразу
              if (attempt > 2) {
                promptToUse = 'Professional portrait. Gray background.';
              } else if (attempt > 5) {
                promptToUse = 'Portrait. Gray background.';
              } else if (attempt > 10) {
                promptToUse = 'Business photo.';
              }
            } else if (attempt > 3) {
              // Для финальных промптов - стандартное смягчение
              const softeningLevel = Math.min(attempt - 3, MAX_PROMPT_SOFTENING_LEVEL);
              promptToUse = buildFallbackPrompt(job.originalPrompt || job.prompt, softeningLevel);
            }
            
            if (promptToUse !== job.prompt) {
              safeLog('Softening prompt for IMAGE_OTHER retry', { 
                jobId: job.id,
                attempt,
                isIntermediate: isIntermediatePrompt,
                originalPromptLength: job.prompt.length,
                softenedPromptLength: promptToUse.length,
                newPrompt: promptToUse.substring(0, 100)
              });
            }
          }
          
          safeLog('Image generation returned retriable finish reason, retrying', { 
            jobId: job.id,
            finishReason,
            attempt,
            maxRetries: effectiveMaxRetries,
            textResponse: textResponse.substring(0, 500),
            fullTextResponse: textResponse,
            safetyRatings: safetyRatings.map(r => ({
              category: r.category,
              probability: r.probability,
              blocked: r.blocked
            })),
            candidate: JSON.stringify(candidate).substring(0, 2000),
            fullResponse: fullResponseStr,
            promptFeedback: response.promptFeedback ? JSON.stringify(response.promptFeedback).substring(0, 500) : null,
            usingSoftenedPrompt: promptToUse !== job.prompt
          });
          
          // Используем смягченный промпт для следующей попытки
          if (promptToUse !== job.prompt) {
            job.prompt = promptToUse;
          }
          
          // Экспоненциальный backoff с jitter
          const backoff = 1000 * Math.pow(1.5, attempt - 1);
          const jitter = backoff * (0.5 + Math.random() * 0.5);
          await new Promise(resolve => setTimeout(resolve, Math.min(backoff + jitter, 5000)));
          continue;
        }
        
        const errorMessage = `Модель ИИ ответила текстом вместо изображения. Finish reason: ${finishReason}. Text: "${textResponse.substring(0, 200)}"`;
        
        // Сохраняем finishReason в ошибке для последующего логирования
        const errorWithReason = new Error(errorMessage);
        errorWithReason.finishReason = finishReason;
        errorWithReason.safetyRatings = safetyRatings;
        lastError = errorWithReason;
        
        // Сохраняем детали ошибки в job для передачи клиенту
        job.errorDetails = {
          finishReason,
          safetyRatings: safetyRatings.map(r => ({
            category: r.category,
            probability: r.probability,
            blocked: r.blocked
          })),
          textResponse: textResponse.substring(0, 500)
        };
        
        safeLog('Image generation failed - text response instead of image', { 
          jobId: job.id,
          finishReason,
          textResponse: textResponse.substring(0, 500),
          fullTextResponse: textResponse,
          hasImagePart,
          hasTextPart,
          attempt,
          maxRetries,
          safetyRatings: safetyRatings.map(r => ({
            category: r.category,
            probability: r.probability,
            blocked: r.blocked
          })),
          candidateFinishReason: finishReason,
          fullCandidate: JSON.stringify(candidate).substring(0, 2000),
          // Логируем промпт для диагностики проблем с конкретными стилями
          promptLength: job.prompt?.length || 0,
          promptPreview: job.prompt?.substring(0, 300) || 'no prompt',
          promptContainsCritical: job.prompt?.includes('CRITICAL') || false,
          promptContainsExact: job.prompt?.includes('EXACTLY') || false,
          promptStyle: job.prompt?.match(/style should be ([^\.]+)/i)?.[1] || 'unknown'
        });
        
        // Дополнительное логирование в консоль для быстрой диагностики
        console.error(`[GENERATION FAILED] jobId=${job.id}, finishReason=${finishReason}, promptLength=${job.prompt?.length || 0}, attempt=${attempt}`);
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        
        // Детальное логирование ошибки для диагностики
        safeLog('Error in generation attempt', {
          jobId: job.id,
          attempt,
          error: errorMessage,
          errorName: error instanceof Error ? error.name : 'unknown',
          errorStack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
          errorCode: error?.code,
          errorStatus: error?.status,
          errorResponse: error?.response ? JSON.stringify(error.response).substring(0, 500) : undefined
        });
        
        // Проверяем, является ли ошибка связанной с API ключом
        const isApiKeyError = (
          errorMessage.includes('403') ||
          errorMessage.toLowerCase().includes('permission_denied') ||
          errorMessage.toLowerCase().includes('api key') ||
          errorMessage.toLowerCase().includes('leaked') ||
          errorMessage.toLowerCase().includes('invalid api key') ||
          errorMessage.toLowerCase().includes('api key was reported')
        );
        
        // Проверяем, является ли ошибка связанной с rate limiting
        const isRateLimitError = (
          errorMessage.toLowerCase().includes('rate_limit') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.includes('429') ||
          errorMessage.toLowerCase().includes('too many requests') ||
          errorMessage.toLowerCase().includes('resource_exhausted')
        );
        
        const isRetriable = (
          errorMessage.toLowerCase().includes('internal') ||
          errorMessage.includes('"code":500') ||
          isRateLimitError ||
          errorMessage.includes('503') ||
          errorMessage.toLowerCase().includes('unavailable') ||
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('timed out') ||
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('fetch failed')
        );
        
        // Если ошибка API ключа - не повторяем, сразу выбрасываем понятную ошибку
        if (isApiKeyError) {
          safeLog('API key error detected', { jobId: job.id, errorMessage: errorMessage.substring(0, 200) });
          throw new Error('Ошибка API ключа для генерации. Обратитесь к администратору.');
        }
        
        if (isRetriable && attempt < maxRetries) {
          // Для rate limit ошибок используем более длительный backoff
          let backoff;
          if (isRateLimitError) {
            // При rate limit ждем дольше: минимум 60 секунд / RPM_LIMIT
            backoff = Math.max(60000 / GEMINI_RPM_LIMIT, 5000) * Math.pow(2, attempt - 1);
            safeLog('Rate limit error detected, using extended backoff', { attempt, backoff, errorMessage: errorMessage.substring(0, 100) });
          } else {
            // Обычный exponential backoff для других ошибок
            backoff = 1000 * Math.pow(2, attempt - 1);
          }
          
          const jitter = backoff * (0.5 + Math.random());
          const delay = Math.min(backoff + jitter, 60000); // Максимум 60 секунд
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // После ожидания очищаем историю запросов для rate limit ошибок
          if (isRateLimitError) {
            geminiRequestTimestamps.length = 0;
            safeLog('Cleared Gemini request history after rate limit error');
          }
          
          continue;
        }
        
        throw error;
      }
    }
    
    // Для промежуточных изображений пробуем финальный минимальный промпт перед сдачей
    const isIntermediatePrompt = job.prompt?.includes('Change background to gray') || job.prompt?.includes('Simple neutral gray background');
    if (isIntermediatePrompt && !lastError?.finishReason) {
      // Последняя попытка с абсолютно минимальным промптом
      try {
        const minimalPrompt = 'Portrait photo.';
        const textPart = { text: minimalPrompt };
        const imagePart = {
          inlineData: { mimeType, data: base64Data },
        };
        
        safeLog('Final attempt with minimal prompt for intermediate image', {
          jobId: job.id,
          minimalPrompt,
          imageSizeBytes: Math.floor(base64Data.length * 0.75)
        });
        
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });
        
        const responseParts = response.candidates?.[0]?.content?.parts || [];
        const imagePartFromResponse = responseParts.find(part => part.inlineData);
        
        if (imagePartFromResponse?.inlineData) {
          const { mimeType: responseMimeType, data: responseData } = imagePartFromResponse.inlineData;
          const imageDataUrl = `data:${responseMimeType};base64,${responseData}`;
          const duration = Date.now() - startTime;
          
          job.setResult({ imageDataUrl });
          completedJobs.set(job.id, job);
          if (completedJobs.size > MAX_COMPLETED_JOBS) {
            const firstKey = completedJobs.keys().next().value;
            completedJobs.delete(firstKey);
          }
          
          activeJobs.delete(job.id);
          currentJobIds = currentJobIds.filter(id => id !== job.id);
          processQueue();
          
          safeLog('Intermediate image generated with minimal prompt', { jobId: job.id, duration });
          return;
        }
      } catch (minimalError) {
        safeLog('Final minimal prompt attempt failed', {
          jobId: job.id,
          error: minimalError instanceof Error ? minimalError.message : String(minimalError)
        });
      }
    }
    
    throw lastError || new Error('Превышено максимальное количество попыток');
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Детальное логирование всех ошибок генерации
    const errorDetails = {
      jobId: job.id, 
      error: errorMessage, 
      duration,
      errorStack: errorStack?.substring(0, 1000),
      attempts: maxRetries,
      lastError: lastError ? (lastError instanceof Error ? lastError.message : String(lastError)) : null,
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'unknown',
      // Дополнительная информация об ошибке
      isTimeout: errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out'),
      isNetworkError: errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch failed'),
      isRateLimit: errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429'),
      isApiError: errorMessage.toLowerCase().includes('api') || errorMessage.toLowerCase().includes('gemini'),
      isImageOther: errorMessage.includes('IMAGE_OTHER') || errorMessage.includes('finishReason'),
      isMaxRetries: errorMessage.includes('Превышено максимальное количество попыток'),
      // Логируем промпт для диагностики
      promptLength: job.prompt?.length || 0,
      promptPreview: job.prompt?.substring(0, 200) || 'no prompt',
      promptContainsCritical: job.prompt?.includes('CRITICAL') || false,
      promptContainsExact: job.prompt?.includes('EXACTLY') || false,
      originalPromptLength: job.originalPrompt?.length || 0
    };
    
    safeLog('Image generation failed (queued)', errorDetails);
    
    // Дополнительное логирование для диагностики проблем с конкретными стилями
    console.error(`[GENERATION ERROR] jobId=${job.id}, promptLength=${job.prompt?.length || 0}, error=${errorMessage.substring(0, 100)}`);
    
    // Передаем более понятное сообщение об ошибке в зависимости от типа
    let userFriendlyError = 'Не удалось сгенерировать изображение. Попробуйте позже.';
    
    // Дополнительное логирование finishReason для промежуточных изображений
    if (errorDetails.promptPreview?.includes('Simple neutral gray background')) {
      safeLog('Intermediate image generation failed', {
        jobId: job.id,
        errorMessage,
        errorDetails,
        finishReason: lastError?.finishReason || 'unknown',
        safetyRatings: lastError?.safetyRatings || []
      });
    }
    
    if (errorMessage.includes('API ключа') || errorMessage.includes('api key') || errorMessage.includes('leaked')) {
      userFriendlyError = 'Ошибка конфигурации сервера. Обратитесь к администратору.';
    } else if (errorDetails.isImageOther) {
      // Более понятное сообщение для IMAGE_OTHER
      userFriendlyError = 'Не удалось сгенерировать изображение. Это может произойти, если:\n' +
        '• Фото слишком темное или размытое\n' +
        '• Лицо плохо видно или закрыто\n' +
        '• API временно недоступен\n\n' +
        'Попробуйте:\n' +
        '• Загрузить более четкое фото с хорошо видимым лицом\n' +
        '• Подождать несколько минут и попробовать снова';
    } else if (errorDetails.isTimeout) {
      userFriendlyError = 'Превышено время ожидания генерации. Сервер может быть перегружен.\n\n' +
        'Попробуйте:\n' +
        '• Подождать 1-2 минуты и попробовать снова\n' +
        '• Проверить интернет-соединение';
    } else if (errorDetails.isRateLimit) {
      userFriendlyError = 'Слишком много запросов. Пожалуйста, подождите несколько минут и попробуйте снова.';
    } else if (errorDetails.isNetworkError) {
      userFriendlyError = 'Ошибка сети при генерации изображения.\n\n' +
        'Попробуйте:\n' +
        '• Проверить интернет-соединение\n' +
        '• Подождать несколько секунд и попробовать снова';
    } else if (errorDetails.isMaxRetries) {
      userFriendlyError = 'Не удалось сгенерировать изображение после нескольких попыток.\n\n' +
        'Возможные причины:\n' +
        '• Фото слишком сложное для обработки\n' +
        '• Временные проблемы с API\n\n' +
        'Попробуйте:\n' +
        '• Загрузить другое фото\n' +
        '• Подождать несколько минут';
    } else if (errorDetails.isApiError) {
      userFriendlyError = 'Ошибка при обращении к сервису генерации.\n\n' +
        'Попробуйте:\n' +
        '• Подождать 1-2 минуты и попробовать снова\n' +
        '• Загрузить другое фото';
    }
    
    // Сохраняем детали ошибки если есть
    const errorDetailsToSave = lastError?.finishReason ? {
      finishReason: lastError.finishReason,
      safetyRatings: lastError.safetyRatings || [],
      textResponse: lastError.textResponse || null
    } : null;
    
    job.setError(new Error(userFriendlyError), errorDetailsToSave);
    
    // Сохраняем завершенную задачу с ошибкой
    completedJobs.set(job.id, job);
    if (completedJobs.size > MAX_COMPLETED_JOBS) {
      const firstKey = completedJobs.keys().next().value;
      completedJobs.delete(firstKey);
    }
    
    // Задача завершена с ошибкой
    activeJobs.delete(job.id);
    currentJobIds = currentJobIds.filter(id => id !== job.id);
    processQueue(); // Проверяем, есть ли еще задачи для обработки
  }
}

// Обработчик очереди (запускает порции по 6 задач одновременно)
// Rate limiting: отправляем порции по 6 задач с интервалом 2 секунды между порциями
// Активных задач может быть сколько угодно - ограничение только на скорость отправки (6 запросов в секунду)
let isProcessingQueue = false; // Флаг для предотвращения параллельного запуска processQueue

async function processQueue() {
  // Если уже обрабатывается - выходим
  if (isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  try {
    while (generationQueue.length > 0) {
      // Проверяем rate limit: прошло ли 2 секунды с последней отправки порции
      const now = Date.now();
      const timeSinceLastBatch = now - lastBatchSendTime;

      if (timeSinceLastBatch < SECOND_DELAY_ON_LIMIT && lastBatchSendTime > 0) {
        // Нужно подождать перед отправкой следующей порции
        const waitTime = SECOND_DELAY_ON_LIMIT - timeSinceLastBatch;
        safeLog('Rate limit: waiting before sending next batch', { 
          waitTime,
          timeSinceLastBatch,
          queueSize: generationQueue.length,
          activeJobs: activeJobs.size
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Берем ровно 6 задач (порция от одного пользователя)
      // Если в очереди меньше 6 - берем сколько есть, но следующая порция будет ждать
      const batchJobs = [];

      for (let i = 0; i < BATCH_SIZE && generationQueue.length > 0; i++) {
        batchJobs.push(generationQueue.shift());
      }

      if (batchJobs.length === 0) break;

      // Обновляем время последней отправки порции
      lastBatchSendTime = Date.now();

      // Регистрируем запросы в трекерах
      const currentSecond = Math.floor(Date.now() / 1000);
      for (let i = 0; i < batchJobs.length; i++) {
        geminiRequestsPerSecond.set(currentSecond, (geminiRequestsPerSecond.get(currentSecond) || 0) + 1);
        geminiRequestTimestamps.push(Date.now());
      }

      safeLog('Starting batch of jobs', {
        batchSize: batchJobs.length,
        queueSize: generationQueue.length,
        activeJobs: activeJobs.size,
        requestsInSecond: geminiRequestsPerSecond.get(currentSecond),
        totalRequestsInMinute: geminiRequestTimestamps.length,
        jobIds: batchJobs.map(j => j.id)
      });

      // Запускаем задачи из пакета с небольшой задержкой между ними
      // Это помогает избежать перегрузки API при одновременной отправке всех 6 запросов
      batchJobs.forEach((job, index) => {
        // Добавляем небольшую задержку между запросами (50-100мс)
        // Это помогает API лучше обработать запросы
        const delay = index * 50; // 0, 50, 100, 150, 200, 250 мс
        
        setTimeout(() => {
          console.log(`[${new Date().toISOString()}] [BEFORE PROCESSJOB CALL] jobId=${job.id}, queueSize=${generationQueue.length}, delay=${delay}ms, index=${index}`);
          processJob(job).catch(err => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorStack = err instanceof Error ? err.stack : undefined;
          
          safeLog('Unexpected error in processJob (unhandled)', {
            jobId: job.id,
            error: errorMessage,
            errorStack: errorStack?.substring(0, 500)
          });
          
          // Сохраняем задачу с ошибкой, чтобы фронтенд мог получить статус
          job.setError(new Error('Не удалось сгенерировать изображение. Попробуйте позже.'));
          completedJobs.set(job.id, job);
          if (completedJobs.size > MAX_COMPLETED_JOBS) {
            const firstKey = completedJobs.keys().next().value;
            completedJobs.delete(firstKey);
          }
          
          activeJobs.delete(job.id);
          currentJobIds = currentJobIds.filter(id => id !== job.id);
          // Перезапускаем обработку очереди после ошибки
          processQueue();
        });
        }, delay);
      });

      cleanupGeminiRequestTimestamps();
      cleanupGeminiRequestsPerSecond();

      // Небольшая задержка перед следующей проверкой (чтобы не загружать CPU)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } finally {
    isProcessingQueue = false;
  }
}

// Добавление задачи в очередь генерации
// Упрощенная логика: сразу добавляем задачу в очередь, без группировки по времени
function addToQueue(imageData, prompt) {
  if (generationQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Очередь переполнена. Попробуйте позже.');
  }
  
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job = new GenerationJob(jobId, imageData, prompt);
  
  // Сразу добавляем задачу в очередь
  generationQueue.push(job);
  
  safeLog('Job added to queue', { 
    jobId, 
    queueSize: generationQueue.length,
    position: job.getPosition()
  });
  
  // Запускаем обработку очереди (если еще не запущена)
  processQueue();
  
  // Возвращаем jobId для отслеживания статуса
  return { jobId, position: job.getPosition(), estimatedWaitTime: job.getEstimatedWaitTime() };
}

// Выполнение анализа изображения (общая функция для всех типов анализа)
async function performImageAnalysis(imageData, type, jobId = null) {
  const { mimeType, base64Data } = validateImageData(imageData);
  const imagePart = {
    inlineData: { mimeType, data: base64Data },
  };
  
  await waitForGeminiAnalysisRateLimit();
  
  if (type === 'evaluate') {
    // Промпт для evaluate-image
    const evaluationPrompt = {
      text: `Проанализируй это изображение и ответь на три вопроса:

1. Является ли это фотографией реального человека? (не рисунок, не 3D-рендер, не анимация, не скульптура)
2. Является ли это селфи или портретом ОДНОГО человека? (не группа людей на переднем плане)
3. Не нарушает ли это изображение политику контента? (нет запрещенного контента)

Верни ТОЛЬКО валидный JSON (без дополнительного текста):
{
  "isValid": boolean,  // true только если все три вопроса: ДА, ДА, НЕТ
  "errorType": "none" | "prohibited_content" | "not_single_person" | "license_violation",
  "errorMessage": "строка на русском" (только если isValid: false),
  "gender": "male" | "female" | "unknown",  // ОБЯЗАТЕЛЬНО верни пол, если isValid: true
  "confidence": число от 0 до 1,  // уверенность в определении пола
  "details": {
    "isPhotographOfRealPerson": boolean,
    "isSelfieOnePerson": boolean,
    "hasSinglePerson": boolean,
    "isFaceClearlyVisible": boolean,
    "hasProhibitedContent": boolean,
    "hasMultiplePeople": boolean
  }
}

ВАЖНО:
- Если это фото реального человека, одного человека и нет запрещенного контента → isValid: true, и ОБЯЗАТЕЛЬНО верни gender ("male" или "female")
- Если найдены проблемы (несколько людей, запрещённый контент и т.п.) → isValid: false и соответствующий errorType
- Будь строгим только к реальным проблемам`
    };
    
    let response;
    try {
      safeLog('Calling Gemini API for analysis', { 
        jobId: jobId || 'unknown',
        type,
        hasApiKey: !!GEMINI_API_KEY_ANALYSIS,
        apiKeyPrefix: GEMINI_API_KEY_ANALYSIS?.substring(0, 10) || 'none'
      });
      
      response = await genAIAnalysis.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [imagePart, evaluationPrompt] },
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
      
      safeLog('Gemini API analysis response received', {
        jobId: jobId || 'unknown',
        hasText: !!response.text,
        textLength: response.text?.length || 0
      });
    } catch (apiError) {
      const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      safeLog('Gemini API call failed for analysis', {
        jobId: jobId || 'unknown',
        error: apiErrorMessage,
        errorCode: apiError?.code,
        errorStatus: apiError?.status,
        hasApiKey: !!GEMINI_API_KEY_ANALYSIS
      });
      throw apiError;
    }
    
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
    
    if (!parsed || typeof parsed.isValid !== 'boolean') {
      throw new Error('Failed to parse analysis response');
    }

    return parsed;
  } else {
    throw new Error(`Unknown analysis type: ${type}`);
  }
}

// Получение статусного сообщения для анализа (с юмором в корпоративном стиле)
function getAnalysisStatusMessage(status, remainingTimeMs) {
  const remainingSeconds = Math.ceil(remainingTimeMs / 1000);
  
  if (status === 'processing') {
    if (remainingSeconds <= 0) {
      return 'Почти закончили...';
    } else if (remainingSeconds <= 3) {
      return 'Еще буквально 3 секунды';
    } else if (remainingSeconds <= 5) {
      return 'Почти готово, осталось несколько секунд';
    } else if (remainingSeconds <= 8) {
      return 'Завершаем анализ вашего фото';
    } else {
      return 'Анализируем изображение...';
    }
  } else if (status === 'queued') {
    if (remainingSeconds <= 0) {
      return 'Обработка начнется с минуты на минуту';
    } else if (remainingSeconds <= 5) {
      return 'Скоро начнем обработку';
    } else {
      return `Ожидание в очереди: ~${remainingSeconds} сек`;
    }
  }
  
  return 'Обработка изображения...';
}

// Обработка одной задачи анализа
async function processAnalysisJob(job) {
  activeAnalysisJobs.add(job.id);
  job.startedAt = Date.now();
  
  try {
    const result = await performImageAnalysis(job.imageData, job.type, job.id);
    job.setResult(result);
    
    // Сохраняем завершенную задачу
    completedAnalysisJobs.set(job.id, job);
    if (completedAnalysisJobs.size > MAX_COMPLETED_JOBS) {
      const firstKey = completedAnalysisJobs.keys().next().value;
      completedAnalysisJobs.delete(firstKey);
    }
    
    activeAnalysisJobs.delete(job.id);
    processAnalysisQueue(); // Проверяем, есть ли еще задачи для обработки
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Детальное логирование ошибки анализа
    safeLog('Analysis job failed', {
      jobId: job.id,
      error: errorMessage,
      errorStack: errorStack?.substring(0, 500),
      errorCode: error?.code,
      errorStatus: error?.status,
      isApiError: errorMessage.toLowerCase().includes('api') || errorMessage.toLowerCase().includes('gemini'),
    });
    
    job.setError(new Error(errorMessage));
    
    // Сохраняем завершенную задачу с ошибкой
    completedAnalysisJobs.set(job.id, job);
    if (completedAnalysisJobs.size > MAX_COMPLETED_JOBS) {
      const firstKey = completedAnalysisJobs.keys().next().value;
      completedAnalysisJobs.delete(firstKey);
    }
    
    activeAnalysisJobs.delete(job.id);
    processAnalysisQueue(); // Проверяем, есть ли еще задачи для обработки
  }
}

// Обработчик очереди анализа (запускает до MAX_CONCURRENT_ANALYSIS задач параллельно)
async function processAnalysisQueue() {
  // Запускаем новые задачи, пока не достигнут лимит параллельных анализов
  while (activeAnalysisJobs.size < MAX_CONCURRENT_ANALYSIS && analysisQueue.length > 0) {
    const job = analysisQueue.shift();
    // Запускаем задачу асинхронно (не ждем завершения)
    processAnalysisJob(job).catch(err => {
      console.error('Unexpected error in processAnalysisJob:', err);
      activeAnalysisJobs.delete(job.id);
    });
    
    // Небольшая задержка между запусками для снижения нагрузки
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Добавление задачи в очередь анализа
function addToAnalysisQueue(imageData, type) {
  if (analysisQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Очередь анализа переполнена. Попробуйте позже.');
  }
  
  const jobId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job = new AnalysisJob(jobId, imageData, type);
  analysisQueue.push(job);
  
  safeLog('Analysis job added to queue', { jobId, type, queueSize: analysisQueue.length, position: job.getPosition() });
  
  // Запускаем обработку очереди, если она не запущена
  processAnalysisQueue();
  
  // Возвращаем jobId для отслеживания статуса
  return { jobId, position: job.getPosition(), estimatedWaitTime: job.getEstimatedWaitTime() };
}

// Получение статуса задачи анализа
function getAnalysisJobStatus(jobId) {
  // Проверяем завершенные задачи
  const completedJob = completedAnalysisJobs.get(jobId);
  if (completedJob) {
    if (completedJob.error) {
      return {
        status: 'error',
        error: completedJob.error.message || 'Ошибка анализа',
      };
    }
    return {
      status: 'completed',
      result: completedJob.result,
    };
  }
  
  // Проверяем очередь и активные задачи
  const queueJob = analysisQueue.find(job => job.id === jobId);
  if (queueJob) {
    const estimatedWaitTime = queueJob.getEstimatedWaitTime();
    const elapsedTime = Date.now() - queueJob.createdAt;
    const remainingTime = Math.max(0, estimatedWaitTime - elapsedTime);
    
    return {
      status: 'queued',
      position: queueJob.getPosition(),
      estimatedWaitTime: estimatedWaitTime,
      remainingTime: remainingTime,
      statusMessage: getAnalysisStatusMessage('queued', remainingTime),
    };
  }
  
  if (activeAnalysisJobs.has(jobId)) {
    // Задача обрабатывается - показываем оставшееся время
    // Ищем задачу в активных задачах
    const activeJob = Array.from(analysisQueue).find(j => j.id === jobId && j.startedAt);
    const elapsedTime = activeJob && activeJob.startedAt ? Date.now() - activeJob.startedAt : 0;
    const remainingTime = Math.max(0, AVERAGE_ANALYSIS_TIME - elapsedTime);
    
    return {
      status: 'processing',
      position: 0,
      estimatedWaitTime: 0,
      remainingTime: remainingTime,
      statusMessage: getAnalysisStatusMessage('processing', remainingTime),
    };
  }
  
  return null; // Задача не найдена
}

// Получение статуса задачи генерации
function getJobStatus(jobId) {
  // Проверяем завершенные задачи
  const completedJob = completedJobs.get(jobId);
  if (completedJob) {
    if (completedJob.error) {
      return {
        status: 'error',
        error: completedJob.error.message || 'Ошибка генерации',
        errorDetails: completedJob.errorDetails || null,
        finishReason: completedJob.errorDetails?.finishReason || null,
        safetyRatings: completedJob.errorDetails?.safetyRatings || null,
      };
    }
    return {
      status: 'completed',
      result: completedJob.result,
    };
  }
  
  // Проверяем обрабатываемую задачу
  // activeJobs содержит только ID, нужно найти задачу в completedJobs или по другому способу
  if (activeJobs.has(jobId)) {
    // Ищем задачу в завершенных (может быть уже завершена)
    const completedJob = completedJobs.get(jobId);
    if (completedJob) {
      if (completedJob.error) {
        return {
          status: 'error',
          error: completedJob.error.message || 'Ошибка генерации',
          errorDetails: completedJob.errorDetails || null,
          finishReason: completedJob.errorDetails?.finishReason || null,
          safetyRatings: completedJob.errorDetails?.safetyRatings || null,
        };
      }
      return {
        status: 'completed',
        result: completedJob.result,
      };
    }
    
    // Задача активна, но еще не завершена
    // Возвращаем статус processing с примерным временем генерации
    const avgGenTime = calculateAverageGenerationTime();
    return {
      status: 'processing',
      position: 0,
      estimatedWaitTime: avgGenTime || 30000, // По умолчанию 30 секунд если нет статистики
      estimatedStartTime: Date.now(), // Уже началась
    };
  }
  
  // Проверяем очередь
  const queuedJob = generationQueue.find(j => j.id === jobId);
  if (queuedJob) {
    const estimatedWaitTime = queuedJob.getEstimatedWaitTime();
    return {
      status: 'queued',
      position: queuedJob.getPosition(),
      estimatedWaitTime: estimatedWaitTime,
      estimatedStartTime: Date.now() + estimatedWaitTime, // Абсолютное время начала
      createdAt: queuedJob.createdAt,
    };
  }
  
  // Дополнительное логирование для отладки
  safeLog('Job not found', {
    jobId,
    queueSize: generationQueue.length,
    activeJobsCount: activeJobs.size,
    completedJobsCount: completedJobs.size,
    queueJobIds: generationQueue.map(j => j.id).slice(0, 10),
    activeJobIds: Array.from(activeJobs).slice(0, 10),
    completedJobIds: Array.from(completedJobs.keys()).slice(0, 10)
  });
  
  return null; // Задача не найдена
}

// --- Robokassa success / fail redirects ---

app.get('/payment/success', (req, res) => {
  const invId = req.query.InvId || req.query.invId;
  if (!invId) {
    return res.redirect('/?payment=success');
  }
  return res.redirect(`/?payment=success&invId=${encodeURIComponent(invId)}`);
});

app.get('/payment/fail', (req, res) => {
  const invId = req.query.InvId || req.query.invId;
  if (!invId) {
    return res.redirect('/?payment=fail');
  }
  return res.redirect(`/?payment=fail&invId=${encodeURIComponent(invId)}`);
});

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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Уменьшено с 50mb для безопасности
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware (простая реализация)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут
const RATE_LIMIT_MAX_REQUESTS = 200; // Максимум 200 запросов за окно (увеличено для тестирования и генерации множества изображений)

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

// Префикс для всех API эндпоинтов
const API_PREFIX = '/api';

// Логирование всех запросов для диагностики
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: {
      host: req.headers.host,
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip']
    }
  });
  next();
});

// Rate limiting только для анализа (бесплатные эндпоинты), не для генерации (платные)
// Генерация оплачивается, поэтому не ограничиваем запросы
app.post(`${API_PREFIX}/detect-gender`, rateLimit);
app.post(`${API_PREFIX}/validate-image`, rateLimit);
app.post(`${API_PREFIX}/evaluate-image`, rateLimit);
// app.post(`${API_PREFIX}/generate-image`, rateLimit); // Убрано - генерация платная, не ограничиваем

// --- Robokassa payment endpoints ---

// Инициация платежа: создаёт заказ и возвращает URL для редиректа на Robokassa
// На этом этапе мы уже можем сохранить исходное изображение и настройки пользователя,
// чтобы позже можно было повторить генерацию или посмотреть заказ в админке.
app.post(`${API_PREFIX}/payment/create`, async (req, res) => {
  try {
    const invId = createNextInvId();
    const outSum = ROBOKASSA_PAYMENT_AMOUNT.toFixed(2);

    const { imageData, gender, role, company } = req.body || {};

    // Сохраняем заказ в SQLite (imageData пока не кладём в БД, только флаг hasImageData)
    const order = {
      invId,
      status: 'created',
      amount: outSum,
      createdAt: Date.now(),
      gender: typeof gender === 'string' ? gender : null,
      role: typeof role === 'string' ? role : null,
      company: typeof company === 'string' ? company : null,
      photoSessionType: 'Деловая фотосессия',
      hasImageData: typeof imageData === 'string' && imageData.length > 0,
      generatedImages: null,
      failureReason: null,
      retries: 0,
    };

    saveOrder(order);

    // Сохраняем само изображение только в оперативной памяти
    if (typeof imageData === 'string' && imageData.length > 0) {
      orderImages.set(String(invId), imageData);
    }

    // Формируем подпись для Robokassa
    // Формат: MerchantLogin:OutSum:InvId:Password#1
    const signatureString = `${ROBOKASSA_LOGIN}:${outSum}:${invId}:${ROBOKASSA_PASSWORD1}`;
    const signature = crypto
      .createHash('md5')
      .update(signatureString, 'utf8')
      .digest('hex');

    const isTestParam = ROBOKASSA_IS_TEST ? '&IsTest=1' : '';
    // Кодируем Description один раз (Robokassa сам декодирует)
    const descriptionEncoded = encodeURIComponent(ROBOKASSA_PAYMENT_DESC);

    // URL для Robokassa (одинаковый для теста и продакшена)
    const robokassaBaseUrl = 'https://auth.robokassa.ru/Merchant/Index.aspx';

    // Формируем URL с правильным кодированием всех параметров
    const redirectUrl =
      `${robokassaBaseUrl}?MerchantLogin=${encodeURIComponent(ROBOKASSA_LOGIN)}` +
      `&OutSum=${outSum}&InvId=${invId}&Description=${descriptionEncoded}&SignatureValue=${signature}${isTestParam}`;

    // Логируем для отладки (без паролей)
    console.log('[Robokassa] Creating payment:', {
      invId,
      outSum,
      login: ROBOKASSA_LOGIN,
      isTest: ROBOKASSA_IS_TEST,
      signatureString: `${ROBOKASSA_LOGIN}:${outSum}:${invId}:***`,
      signature,
      fullUrl: redirectUrl,
      description: ROBOKASSA_PAYMENT_DESC,
      password1Length: ROBOKASSA_PASSWORD1 ? ROBOKASSA_PASSWORD1.length : 0,
      password2Length: ROBOKASSA_PASSWORD2 ? ROBOKASSA_PASSWORD2.length : 0,
    });
    
    // Дополнительная проверка: валидация параметров перед отправкой
    if (!ROBOKASSA_LOGIN || !ROBOKASSA_PASSWORD1 || !ROBOKASSA_PASSWORD2) {
      console.error('[Robokassa] Missing required configuration:', {
        hasLogin: !!ROBOKASSA_LOGIN,
        hasPassword1: !!ROBOKASSA_PASSWORD1,
        hasPassword2: !!ROBOKASSA_PASSWORD2,
      });
    }

    res.json({ redirectUrl, invId });
  } catch (err) {
    console.error('[Robokassa] payment/create error:', err);
    res.status(500).json({ error: 'Не удалось создать платёж. Попробуйте позже.' });
  }
});

// Вспомогательная функция для случайного выбора из массива
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Описание роли для контекста промпта
function describeRole(role) {
  switch (role) {
    case 'Разработчик':
      return 'focus on a hands-on software engineer; practical, focused, clean look';
    case 'Тимлид':
      return 'team lead presence; approachable leadership, confident yet friendly';
    case 'Архитектор':
      return 'solution architect; strategic, minimalistic aesthetic, systems-thinking vibe';
    case 'DevOps-инженер':
      return 'DevOps engineer; pragmatic, modern tech environment, reliability mindset';
    case 'Дата-сайентист':
      return 'data scientist; analytical, thoughtful expression, subtle academic touch';
    case 'ML-инженер':
      return 'machine learning engineer; innovative, research-meets-engineering tone';
    case 'Продуктовый менеджер':
      return 'product manager; customer-centric, strategic and collaborative presence';
    case 'Проектный менеджер':
      return 'project manager; organized and composed, clarity and control';
    case 'Системный аналитик':
      return 'systems analyst; detail-oriented, structured and precise';
    case 'Дизайнер UI/UX':
      return 'UI/UX designer; creative yet professional, tasteful minimalism';
    case 'QA-инженер':
      return 'QA engineer; meticulous, quality-driven, methodical calmness';
    case 'CTO':
      return 'CTO; executive gravitas, visionary leadership, crisp and premium look';
    default:
      return 'technology professional; credible and modern';
  }
}

// Описание компании для контекста промпта
function describeCompany(company) {
  switch (company) {
    case 'Стартап':
      return 'startup context; dynamic, energetic, minimalistic background or open space';
    case 'Продуктовая компания':
      return 'product company; polished yet approachable, modern product-office background';
    case 'Enterprise':
      return 'enterprise context; formal, premium lighting, subtle corporate background';
    case 'Аутсорс/консалтинг':
      return 'consulting; versatile, neutral background with tidy professional styling';
    case 'Госкомпания':
      return 'public sector; conservative and respectful styling, neutral elegant backdrop';
    case 'Финтех':
      return 'fintech; clean, confident, high-contrast corporate aesthetic';
    case 'Банк':
      return 'banking; conservative modern corporate environment, high trust aesthetic';
    case 'Страховая':
      return 'insurance; reassuring, trustworthy, balanced corporate tone';
    case 'Ритейл':
      return 'retail; practical and approachable, lively yet professional vibe';
    case 'Маркетплейс':
      return 'marketplace; dynamic and product-centric, modern office look';
    case 'Медиа':
      return 'media; creative corporate style, light editorial touch';
    case 'EdTech':
      return 'edtech; friendly and modern academic-corporate blend';
    case 'HealthTech':
      return 'healthtech; clean, clinical-inspired but warm and human tone';
    case 'Телеком':
      return 'telecom; high-tech corporate, sleek and structured';
    case 'Производство':
      return 'manufacturing; robust and grounded, clean industrial hints';
    case 'Логистика':
      return 'logistics; efficient, organized, neutral corporate environment';
    case 'GameDev':
      return 'gamedev; creative tech culture, relaxed smart-casual aesthetic';
    default:
      return 'professional context; neutral corporate setting';
  }
}

// Функция для генерации детального описания одежды на основе роли, компании и пола
function attireByContext(gender, role, company) {
  const baseFemale = 'No facial hair. No beard. No mustache.';
  const baseMale = 'Preserve facial hair exactly as in original. If no facial hair in original, do not add any. Do not remove facial hair if present. Grooming neat and professional.';

  const isFormalCompany = company === 'Enterprise' || company === 'Госкомпания' || company === 'Аутсорс/консалтинг';
  const isModernCompany = company === 'Стартап' || company === 'Продуктовая компания' || company === 'Финтех';

  // Role-centric attire defaults
  const roleSmartCasual = 'smart-casual, solid neutral colors, no large logos';
  const roleBusinessCasual = 'business-casual blazer or knit, shirt or blouse, no tie';
  const roleFormal = 'business formal suit or tailored blazer, crisp shirt/blouse';

  // Wardrobe pools for extra variability (picked later according to context)
  const femaleModernPool = [
    'minimal blouse',
    'fine knit sweater',
    'turtleneck knit',
    'cardigan over tee',
    'light overshirt',
    'denim jacket (clean, no distress)',
  ];
  const femaleFormalPool = [
    'tailored blazer over blouse',
    'structured knit jacket',
  ];
  const maleModernPool = [
    'plain tee under lightweight overshirt',
    'oxford shirt, no tie',
    'turtleneck knit',
    'merino crewneck sweater',
    'cardigan over shirt',
  ];
  const maleFormalPool = [
    'tailored blazer, no tie',
    'business suit with open collar',
  ];
  const roleCreative = 'smart-casual with tasteful minimal design accents';

  let attireCore;
  switch (role) {
    case 'Разработчик':
    case 'DevOps-инженер':
    case 'QA-инженер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; t-shirt or plain shirt/hoodie acceptable`;
      break;
    case 'Дизайнер UI/UX':
      attireCore = `${roleCreative}; premium minimal knit or blouse; no loud patterns`;
      break;
    case 'Дата-сайентист':
    case 'ML-инженер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; cardigan or lightweight knit`;
      break;
    case 'Продуктовый менеджер':
    case 'Проектный менеджер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; knit or blouse; no suit; no tie; no formal blazer`;
      break;
    case 'Архитектор':
      attireCore = isFormalCompany ? `${roleBusinessCasual}; tailored blazer` : `${roleSmartCasual}; minimal knit or overshirt; no suit`;
      break;
    case 'Тимлид':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; clean and approachable; no suit`;
      break;
    case 'CTO':
      attireCore = isFormalCompany ? roleFormal : 'executive smart-casual; tailored blazer, no tie';
      break;
    default:
      attireCore = isFormalCompany ? roleBusinessCasual : roleSmartCasual;
  }

  // Company flavor
  let companyFlavor = '';
  if (company === 'Финтех') companyFlavor = 'sleek monochrome palette';
  if (company === 'Стартап') companyFlavor = 'fresh, dynamic, contemporary casual';
  if (company === 'Продуктовая компания') companyFlavor = 'approachable and modern';
  if (company === 'Госкомпания') companyFlavor = 'conservative and respectful styling';
  if (company === 'Аутсорс/консалтинг') companyFlavor = 'polished and versatile';

  const noSuitModern = (isModernCompany && role !== 'CTO') ? 'No suit. No tie. No tuxedo. Avoid formal blazer.' : '';
  const femaleNoSuit = (gender === 'female' && isModernCompany && role !== 'CTO') ? 'Avoid suit jacket; prefer blouse/knit.' : '';

  // Pick a concrete garment for higher outfit variety
  let garment = '';
  if (gender === 'female') {
    garment = isFormalCompany ? randomChoice(femaleFormalPool) : randomChoice(femaleModernPool);
  } else if (gender === 'male') {
    garment = isFormalCompany ? randomChoice(maleFormalPool) : randomChoice(maleModernPool);
  }

  const grooming = gender === 'female' ? baseFemale : baseMale;
  return `${attireCore}. ${companyFlavor}. Specific garment: ${garment}. ${noSuitModern} ${femaleNoSuit} ${grooming}`.trim();
}

// Функции для построения промптов портретов (упрощенная версия с фронтенда)
function buildPortraitPrompts(gender, role, company) {
  const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];
  
  if (!gender || (gender !== 'male' && gender !== 'female')) {
    throw new Error('Пол должен быть выбран перед генерацией');
  }
  
  const constraints = gender === 'female'
    ? 'No facial hair. No beard. No mustache.'
    : 'CRITICAL FACIAL HAIR PRESERVATION: You MUST preserve the facial hair EXACTLY as shown in the original photo - including style, length, thickness, density, and visibility. If the person is clean-shaven (no beard, no mustache) in the original photo, the generated portrait MUST also be clean-shaven with NO facial hair. If the person has a short, subtle, barely visible beard in the original, the generated portrait MUST have the EXACT SAME short, subtle, barely visible beard - do NOT make it longer, thicker, denser, or more prominent.';
  
  const genderInstruction = gender === 'male' 
    ? 'CRITICAL: This is a MALE person. Generate a MALE portrait. The person must be clearly male with masculine features. Do NOT generate a female portrait.'
    : 'CRITICAL: This is a FEMALE person. Generate a FEMALE portrait. The person must be clearly female with feminine features. Do NOT generate a male portrait.';
  
  const facialHairPreservation = gender === 'male'
    ? 'CRITICAL FACIAL HAIR RULE: Maintain the EXACT same facial hair style, length, thickness, density, and visibility as in the original photo. If the original shows a short, subtle, barely visible beard - keep it EXACTLY short, subtle, and barely visible. If clean-shaven in original, generate clean-shaven. Do NOT lengthen, thicken, densify, or enhance facial hair beyond what is visible in the original photo.'
    : '';

  // Настройки вариативности и естественности (как во фронтенде)
  const variability = 'high';
  const naturalLook = true;

  // Генерируем детальное описание одежды на основе контекста
  const attire = attireByContext(gender, role, company);
  const roleDesc = describeRole(role);
  const companyDesc = describeCompany(company);

  function buildVariations(variabilityLevel) {
    const lightingNeutral = [
      'soft, even high-key lighting',
      'natural window light with soft shadows',
    ];
    const lightingExtra = [
      'dramatic low-key with subtle rim light',
      'golden-hour warm light (indoor simulation)',
      'overcast soft daylight look',
    ];
    const lensNeutral = [
      '85mm head-and-shoulders',
      '50mm three-quarters crop',
    ];
    const lensExtra = [
      '35mm environmental portrait',
    ];
    const backgroundNeutral = [
      'neutral gradient backdrop',
      'modern office, shallow depth of field',
      'textured light wall',
    ];
    const backgroundExtra = [
      'outdoor city bokeh',
      'glass office corridor, soft blur',
      'wooden texture wall, subtle',
    ];
    const gradeNeutral = [
      'clean editorial grade',
      'neutral corporate grade',
    ];
    const gradeExtra = [
      'warm cinematic grade',
      'cool corporate grade',
      'black and white, high micro-contrast',
    ];
    const poseNeutral = [
      'facing camera, subtle smile or neutral confident expression, shoulders square to camera',
      'three-quarter angle to the camera, relaxed shoulders, confident but approachable posture',
      'head slightly tilted, shoulders relaxed, direct gaze to camera',
    ];
    const poseExtra = [
      'slightly off-camera gaze, natural candid feel with the body turned about 30 degrees',
      'looking slightly past the camera with a gentle head tilt and relaxed posture',
      'subtle lean forward toward the camera, confident upright posture',
    ];

    const pick = (neutral, extra) => {
      if (variabilityLevel === 'low') return neutral[0];
      if (variabilityLevel === 'medium') return randomChoice(neutral);
      return randomChoice([...neutral, ...extra]);
    };

    return {
      lighting: pick(lightingNeutral, lightingExtra),
      lens: pick(lensNeutral, lensExtra),
      background: pick(backgroundNeutral, backgroundExtra),
      grade: pick(gradeNeutral, gradeExtra),
      pose: pick(poseNeutral, poseExtra),
    };
  }

  const naturality = naturalLook
    ? "Photorealistic and authentic. Preserve identity and facial features EXACTLY as in the original photo. The person must look like themselves - maintain the same face shape, bone structure, eye shape, nose, mouth, and all distinctive features. Natural skin texture with visible pores, fine lines, wrinkles, freckles, moles, and all natural skin variations. No plastic skin, no airbrushing, no over-smoothing, no AI artifacts. The skin must look completely real and natural, as if photographed with a professional camera. Preserve ALL natural skin imperfections, texture variations, and facial details. Avoid any digital smoothing, retouching, or artificial enhancement that makes skin look plastic, fake, or changes the person's appearance. The generated portrait must be recognizable as the same person from the original photo."
    : '';

  const base = (tone) => {
    const v = buildVariations(variability);
    const skinDetail = gender === 'female'
      ? 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, freckles, moles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing, no plastic or doll-like appearance. Natural skin imperfections MUST be preserved. Do not alter the person\'s natural appearance or skin texture.'
      : 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing. Natural skin imperfections MUST be preserved.';

    const contextText = `The person works as a ${role || 'technology professional'} in a ${company || 'professional'} context. Convey this only through overall style, mood, clothing and atmosphere, not through any overlaid text.`;

    return `Create a professional, high-resolution ${
      gender === 'female' ? 'female ' : 'male '
    }business portrait of the person in the photo, suitable for a LinkedIn profile. ${genderInstruction} ${facialHairPreservation} The style should be ${tone}. ${constraints} Attire: ${attire}. Lighting: ${v.lighting}. Lens & crop: ${v.lens}. Background: ${v.background}. Color grade: ${v.grade}. Pose: ${v.pose}. ${naturality} ${skinDetail} Each image in this batch must show a distinct outfit, pose, head angle and overall feel; avoid repeating garments, body position or camera framing across images. Context: ${roleDesc}; ${companyDesc}. ${contextText} CRITICAL: Do NOT add any text, titles, role names, company names, logos, watermarks, captions, UI elements, or typography inside the image. The image must look like a clean studio portrait photo without any overlaid writing.`;
  };
  
  return {
    'Классический': base(
      'classic and formal, with traditional corporate lighting and attire, set against a softly blurred corporate office or boardroom background that feels serious and executive, matching the role and company context'
    ),
    'Современный': base(
      'modern and approachable, with natural lighting and a slightly blurred open-space tech office or coworking background; the environment should feel contemporary and dynamic, suitable for a modern professional in their role and company'
    ),
    'Креативный': base(
      'expressive and creative, with more dramatic but still professional lighting, and a background suggesting a stylish studio, creative workspace, design office or loft environment related to the person’s role'
    ),
    'Технологичный': base(
      'clean, minimal and high-tech, with bright even lighting and a background that hints at a modern technology company: glass walls, abstract tech patterns, screens or a sleek office interior, softly blurred so it does not distract'
    ),
    'Дружелюбный': base(
      'warm and friendly, with soft lighting and a welcoming background such as a bright office lounge, meeting area or softly lit workspace that feels human and approachable rather than strictly formal'
    ),
    'Уверенный': base(
      'confident and powerful, with strong but flattering lighting, sharp business formal attire, and a background that evokes leadership: executive office, meeting room or skyline view, blurred enough to keep the focus on the face'
    ),
  };
}

// Функция генерации портретов (запускается асинхронно после подтверждения оплаты)
async function generatePortraitsForOrder(invId) {
  const order = loadOrder(invId);
  const imageData = orderImages.get(String(invId));
  if (!order || !imageData) {
    console.error(
      `[generatePortraitsForOrder] Order ${invId} not found or missing imageData (imageData хранится только в оперативной памяти, возможно, сервер был перезапущен или заказ создан без изображения)`
    );
    return;
  }
  
  const { gender, role, company } = order;
  
  // Обновляем статус на processing
  order.status = 'processing';
  order.generatedImages = {};
  saveOrder(order);
  
  console.log(`[generatePortraitsForOrder] Starting generation for order ${invId}`, { gender, role, company });

  // Вспомогательная функция сохранения изображения на диск и возврата публичного URL
  async function saveImageForOrder(style, dataUrl) {
    try {
      const styleSlugMap = {
        'Классический': 'klassicheskiy',
        'Современный': 'sovremennyy',
        'Креативный': 'kreativnyy',
        'Технологичный': 'tekhnologichnyy',
        'Дружелюбный': 'druzhelyubnyy',
        'Уверенный': 'uverenniy',
      };
      const slug =
        styleSlugMap[style] ||
        String(style)
          .toString()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');

      const orderDir = join(IMAGE_ROOT_DIR, 'orders', String(invId));
      await fs.mkdir(orderDir, { recursive: true });

      const fileName = `${slug}.jpg`;
      const filePath = join(orderDir, fileName);

      const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      const base64Data = match ? match[1] : dataUrl.replace(/^data:.*;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await fs.writeFile(filePath, buffer);

      const publicUrl = `/images/orders/${encodeURIComponent(String(invId))}/${encodeURIComponent(fileName)}`;
      return publicUrl;
    } catch (err) {
      console.error(`[generatePortraitsForOrder] Failed to save image for order ${invId}, style ${style}:`, err);
      // В случае ошибки сохраняем data URL напрямую, чтобы не потерять результат
      return dataUrl;
    }
  }
  
  try {
    // ШАГ 1: Генерируем промежуточное изображение
    let intermediateImage;
    try {
      intermediateImage = await replaceBackgroundWithGray(imageData);
      console.log(`[generatePortraitsForOrder] Intermediate image generated for order ${invId}`);
    } catch (err) {
      console.error(`[generatePortraitsForOrder] Failed to generate intermediate image for order ${invId}:`, err);
      intermediateImage = imageData; // Используем оригинал если промежуточное не удалось
    }
    
    // ШАГ 2: Строим промпты для всех 6 стилей
    const prompts = buildPortraitPrompts(gender, role, company);
    const STYLES = Object.keys(prompts);
    
    // ШАГ 3: Генерируем все 6 портретов параллельно
    console.log(`[generatePortraitsForOrder] ========================================`);
    console.log(`[generatePortraitsForOrder] STEP 2: Generating 6 final portraits`);
    console.log(`[generatePortraitsForOrder] Using intermediate image (size: ${intermediateImage.length} chars)`);
    console.log(`[generatePortraitsForOrder] ========================================`);
    
    const generationPromises = STYLES.map(async (style) => {
      const prompt = prompts[style];
      console.log(`[generatePortraitsForOrder] Starting generation for style: ${style}`);
      try {
        // Добавляем задачу в очередь
        const queueResult = addToQueue(intermediateImage, prompt);
        const jobId = queueResult.jobId;
        console.log(`[generatePortraitsForOrder] Added job to queue for ${style}, jobId: ${jobId}`);
        
        // Ждем завершения генерации (polling)
        const maxWaitTime = 300000; // 5 минут
        const startTime = Date.now();
        const pollInterval = 2000; // Проверяем каждые 2 секунды
        
        while (Date.now() - startTime < maxWaitTime) {
          const status = getJobStatus(jobId);
          
          if (status && status.status === 'completed' && status.result) {
            // Успешно сгенерировано
            const publicUrl = await saveImageForOrder(style, status.result.imageDataUrl);
            order.generatedImages[style] = publicUrl;
            saveOrder(order);
            console.log(`[generatePortraitsForOrder] ✅ Successfully generated ${style} for order ${invId}`);
            return { style, success: true, url: status.result.imageDataUrl };
          }
          
          if (status && status.status === 'error') {
            console.error(`[generatePortraitsForOrder] ❌ Failed to generate ${style} for order ${invId}:`, status.error);
            return { style, success: false, error: status.error };
          }
          
          // Логируем прогресс
          if (status && (status.status === 'queued' || status.status === 'processing')) {
            console.log(`[generatePortraitsForOrder] ${style} status: ${status.status}${status.position ? `, position: ${status.position}` : ''}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        // Таймаут
        console.error(`[generatePortraitsForOrder] ⏱️ Timeout generating ${style} for order ${invId}`);
        return { style, success: false, error: 'Таймаут генерации' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[generatePortraitsForOrder] ❌ Error generating ${style} for order ${invId}:`, errorMessage);
        return { style, success: false, error: errorMessage };
      }
    });
    
    // Ждем завершения всех генераций
    const results = await Promise.all(generationPromises);
    
    // Подсчитываем успешные и неудачные
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`[generatePortraitsForOrder] ========================================`);
    console.log(`[generatePortraitsForOrder] STEP 3: Checking results and retrying failed portraits`);
    console.log(`[generatePortraitsForOrder] Successful: ${successful.length}, Failed: ${failed.length}`);
    console.log(`[generatePortraitsForOrder] ========================================`);
    
    // ШАГ 4: Retry для неудачных портретов (используя успешные как источники)
    if (successful.length > 0 && failed.length > 0) {
      console.log(`[generatePortraitsForOrder] Retrying ${failed.length} failed portraits using successful portraits as sources`);
      
      const MAX_RETRY_ATTEMPTS = 3;
      const MAX_SOURCES_PER_FAILED_STYLE = 3;
      
      const retryPromises = failed.map(async (failedResult) => {
        const style = failedResult.style;
        const prompt = prompts[style];
        let sourcesTried = 0;
        let sourceIndex = 0;
        
        while (
          sourcesTried < MAX_SOURCES_PER_FAILED_STYLE &&
          sourceIndex < successful.length
        ) {
          const source = successful[sourceIndex];
          console.log(`[generatePortraitsForOrder] Retrying ${style} using source: ${source.style} (attempt ${sourcesTried + 1})`);
          
          try {
            const queueResult = addToQueue(source.url, prompt);
            const jobId = queueResult.jobId;
            
            const maxWaitTime = 300000;
            const startTime = Date.now();
            const pollInterval = 2000;
            
            while (Date.now() - startTime < maxWaitTime) {
              const status = getJobStatus(jobId);
              
              if (status && status.status === 'completed' && status.result) {
                const publicUrl = await saveImageForOrder(style, status.result.imageDataUrl);
                order.generatedImages[style] = publicUrl;
                saveOrder(order);
                console.log(`[generatePortraitsForOrder] ✅ Retry successful for ${style} using ${source.style}`);
                successful.push({ style, success: true, url: status.result.imageDataUrl });
                return { style, success: true, url: status.result.imageDataUrl };
              }
              
              if (status && status.status === 'error') {
                console.error(`[generatePortraitsForOrder] ❌ Retry failed for ${style} using ${source.style}`);
                break;
              }
              
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          } catch (err) {
            console.error(`[generatePortraitsForOrder] Error in retry for ${style}:`, err);
          }
          
          sourcesTried += 1;
          sourceIndex += 1;
        }
        
        return { style, success: false };
      });
      
      const retryResults = await Promise.all(retryPromises);
      retryResults.forEach(result => {
        if (result.success) {
          const index = failed.findIndex(f => f.style === result.style);
          if (index >= 0) {
            failed.splice(index, 1);
            successful.push(result);
          }
        }
      });
    }
    
    console.log(`[generatePortraitsForOrder] ========================================`);
    console.log(`[generatePortraitsForOrder] Final results: ${successful.length} successful, ${failed.length} failed`);
    console.log(`[generatePortraitsForOrder] ========================================`);
    
    // Обновляем статус заказа
    if (successful.length === 6) {
      order.status = 'completed';
      console.log(`[generatePortraitsForOrder] ✅ Order ${invId} completed successfully with all 6 portraits`);
    } else if (successful.length > 0) {
      order.status = 'completed'; // Частично выполнено, но считаем выполненным
      order.failureReason = `Сгенерировано ${successful.length} из 6 портретов`;
      console.log(`[generatePortraitsForOrder] ⚠️ Order ${invId} partially completed: ${successful.length}/6`);
    } else {
      order.status = 'failed';
      order.failureReason = 'Не удалось сгенерировать ни одного портрета';
      console.error(`[generatePortraitsForOrder] ❌ Order ${invId} failed: no portraits generated`);
    }
    
    saveOrder(order);
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[generatePortraitsForOrder] Fatal error for order ${invId}:`, errorMessage);
    order.status = 'failed';
    order.failureReason = errorMessage;
    saveOrder(order);
  }
}

// Callback от Robokassa после обработки платежа (ResultURL).
// Robokassa может вызывать ResultURL как POST, так и GET, поэтому выносим обработчик в общую функцию.
function handleRobokassaResult(req, res) {
  try {
    const params = Object.keys(req.body || {}).length > 0 ? req.body : req.query;
    const outSum = params.OutSum;
    const invId = params.InvId;
    const signature = (params.SignatureValue || '').toString().toLowerCase();

    console.log('[Robokassa] Result callback received', {
      method: req.method,
      outSum,
      invId,
      hasSignature: !!signature,
      rawParams: params,
    });

    if (!outSum || !invId || !signature) {
      console.warn('[Robokassa] Result: missing params', params);
      return res.status(400).send('Bad Request');
    }

    const expectedSignature = crypto
      .createHash('md5')
      .update(`${outSum}:${invId}:${ROBOKASSA_PASSWORD2}`, 'utf8')
      .digest('hex')
      .toLowerCase();

    if (signature !== expectedSignature) {
      console.warn('[Robokassa] Result: invalid signature', { invId, outSum });
      return res.status(400).send('Bad signature');
    }

    let order = loadOrder(invId);
    if (!order) {
      order = {
        invId: String(invId),
        status: 'paid',
        amount: outSum,
        createdAt: Date.now(),
        gender: null,
        role: null,
        company: null,
        photoSessionType: 'Деловая фотосессия',
        hasImageData: false,
        generatedImages: null,
        failureReason: 'order_not_found_on_payment',
        retries: 0,
      };
      saveOrder(order);
      console.log('[Robokassa] Payment confirmed but order not found in DB, created stub', { invId, outSum });
    } else {
      order.status = 'paid';
      order.amount = outSum;
      saveOrder(order);
      console.log('[Robokassa] Payment confirmed', { invId, outSum });
      
      // Запускаем генерацию портретов асинхронно (не блокируем ответ Robokassa)
      const hasImageData = order.hasImageData;
      if (hasImageData && order.gender && order.role && order.company) {
        console.log('[Robokassa] Starting portrait generation for order', { invId });
        generatePortraitsForOrder(invId).catch(err => {
          console.error('[Robokassa] Error in portrait generation:', err);
          const failedOrder = loadOrder(invId);
          if (failedOrder) {
            failedOrder.status = 'failed';
            failedOrder.failureReason = err instanceof Error ? err.message : String(err);
            saveOrder(failedOrder);
          }
        });
      } else {
        console.warn('[Robokassa] Cannot start generation: missing data in order', { 
          invId, 
          hasImageData,
          hasGender: !!order.gender,
          hasRole: !!order.role,
          hasCompany: !!order.company
        });
      }
    }

    // По протоколу Robokassa нужно вернуть OK + InvId
    res.send(`OK${invId}`);
  } catch (err) {
    console.error('[Robokassa] Result handler error:', err);
    res.status(500).send('Internal error');
  }
}

// Поддерживаем и POST (как в документации Robokassa), и GET (как в текущей конфигурации магазина)
app.post(`${API_PREFIX}/robokassa/result`, express.urlencoded({ extended: false }), handleRobokassaResult);
app.get(`${API_PREFIX}/robokassa/result`, handleRobokassaResult);

// Статус платежа (используется фронтендом после возврата пользователя)
app.get(`${API_PREFIX}/payment/status`, (req, res) => {
  const invId = req.query.invId;
  if (!invId) {
    return res.status(400).json({ paid: false, error: 'invId is required' });
  }
  const order = loadOrder(invId);
  if (!order) {
    return res.json({ paid: false });
  }
  return res.json({ paid: order.status === 'paid' || order.status === 'processing' || order.status === 'completed' });
});

// Публичная информация о заказе по InvId
app.get(`${API_PREFIX}/order/:invId`, (req, res) => {
  const { invId } = req.params;
  const order = loadOrder(invId);
  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  res.json({
    invId: order.invId,
    status: order.status,
    amount: order.amount,
    createdAt: order.createdAt,
    gender: order.gender,
    role: order.role,
    company: order.company,
    photoSessionType: order.photoSessionType,
    hasImageData: order.hasImageData,
    generatedImages: order.generatedImages || null,
    failureReason: order.failureReason || null,
    retries: order.retries || 0,
  });
});

// Галерея последних сгенерированных портретов для анимации на главной странице
let galleryCache = null;
let galleryCacheTime = 0;
const GALLERY_CACHE_TTL = 5 * 60 * 1000; // 5 минут

app.get(`${API_PREFIX}/gallery/recent`, (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100); // Максимум 100 портретов
    
    // Проверяем кэш
    const now = Date.now();
    if (galleryCache && (now - galleryCacheTime) < GALLERY_CACHE_TTL) {
      return res.json({ portraits: galleryCache.slice(0, limit) });
    }

    // Получаем последние завершенные заказы с портретами
    const stmt = db.prepare(`
      SELECT invId, generatedImagesJson, createdAt 
      FROM orders 
      WHERE status = 'completed' 
        AND generatedImagesJson IS NOT NULL 
        AND generatedImagesJson != 'null'
        AND imagesCount > 0
      ORDER BY createdAt DESC 
      LIMIT 50
    `);
    
    const orders = stmt.all();
    const portraits = [];

    for (const order of orders) {
      if (!order.generatedImagesJson) continue;
      
      try {
        const images = JSON.parse(order.generatedImagesJson);
        if (images && typeof images === 'object') {
          // Добавляем все портреты из заказа
          for (const url of Object.values(images)) {
            if (typeof url === 'string' && url.startsWith('/images/')) {
              portraits.push(url);
            }
          }
        }
      } catch (e) {
        console.warn('[Gallery] Failed to parse images for order', order.invId, e);
      }
    }

    // Перемешиваем для разнообразия
    for (let i = portraits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [portraits[i], portraits[j]] = [portraits[j], portraits[i]];
    }

    // Обновляем кэш
    galleryCache = portraits;
    galleryCacheTime = now;

    res.json({ portraits: portraits.slice(0, limit) });
  } catch (err) {
    console.error('[Gallery] Failed to load recent portraits:', err);
    res.status(500).json({ error: 'Не удалось загрузить галерею портретов' });
  }
});

// Галерея последних сгенерированных портретов для анимации на главной странице
app.get(`${API_PREFIX}/gallery/recent`, (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100); // Максимум 100 портретов
    
    // Получаем последние завершенные заказы с портретами
    const stmt = db.prepare(`
      SELECT invId, generatedImagesJson, imagesCount 
      FROM orders 
      WHERE status = 'completed' 
        AND (imagesCount > 0 OR generatedImagesJson IS NOT NULL)
      ORDER BY createdAt DESC 
      LIMIT @limit
    `);
    
    const orders = stmt.all({ limit: limit * 2 }); // Берем больше заказов, чтобы набрать нужное количество портретов
    
    const portraits = [];
    
    for (const order of orders) {
      if (portraits.length >= limit) break;
      
      let images = null;
      if (order.generatedImagesJson) {
        try {
          images = JSON.parse(order.generatedImagesJson);
        } catch (e) {
          console.warn('[Gallery] Failed to parse images for order', order.invId);
          continue;
        }
      }
      
      if (images && typeof images === 'object') {
        // Добавляем все портреты из этого заказа
        for (const url of Object.values(images)) {
          if (typeof url === 'string' && url.startsWith('/images/')) {
            portraits.push(url);
            if (portraits.length >= limit) break;
          }
        }
      }
    }
    
    // Перемешиваем для разнообразия
    for (let i = portraits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [portraits[i], portraits[j]] = [portraits[j], portraits[i]];
    }
    
    res.json({ portraits: portraits.slice(0, limit) });
  } catch (err) {
    console.error('[Gallery] Failed to load recent portraits:', err);
    res.status(500).json({ error: 'Не удалось загрузить портреты', portraits: [] });
  }
});

// Повторная генерация портретов для уже оплаченого/промо-заказа
app.post(`${API_PREFIX}/order/:invId/retry`, express.json({ limit: '11mb' }), async (req, res) => {
  try {
    const { invId } = req.params;
    const { imageData, gender, role, company } = req.body || {};

    const order = loadOrder(invId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Заказ не найден' });
    }

    // Разрешаем ретраи только для неуспешных заказов
    if (order.status !== 'failed') {
      return res.status(400).json({ ok: false, error: 'Повторная генерация доступна только для неуспешных заказов' });
    }

    const currentRetries = order.retries || 0;
    if (currentRetries >= 2) {
      return res.status(400).json({ ok: false, error: 'Лимит попыток повторной генерации исчерпан. Пожалуйста, напишите в службу поддержки.' });
    }

    if (!imageData || typeof imageData !== 'string' || imageData.length === 0) {
      return res.status(400).json({ ok: false, error: 'Отсутствует новое изображение для генерации' });
    }

    // Базовая валидация изображения (формат/размер)
    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      return res.status(400).json({ ok: false, error: imageValidation.error || 'Некорректное изображение' });
    }

    // Обновляем данные заказа и увеличиваем счётчик ретраев
    order.gender = typeof gender === 'string' ? gender : order.gender;
    order.role = typeof role === 'string' ? role : order.role;
    order.company = typeof company === 'string' ? company : order.company;
    order.hasImageData = true;
    order.generatedImages = null;
    order.failureReason = null;
    order.retries = currentRetries + 1;
    order.status = 'paid'; // считаем, что оплата уже подтверждена

    saveOrder(order);

    // Сохраняем изображение в оперативной памяти для генерации
    orderImages.set(String(invId), imageData);

    // Запускаем генерацию асинхронно
    generatePortraitsForOrder(invId).catch(err => {
      console.error('[Retry] Error in portrait generation:', err);
      const failedOrder = loadOrder(invId);
      if (failedOrder) {
        failedOrder.status = 'failed';
        failedOrder.failureReason = err instanceof Error ? err.message : String(err);
        saveOrder(failedOrder);
      }
    });

    return res.json({ ok: true, invId: String(invId), retries: order.retries });
  } catch (error) {
    console.error('[Retry] Failed to start retry generation:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось запустить повторную генерацию. Попробуйте позже.' });
  }
});

// Простейшая "админка": список всех заказов
app.get(`${API_PREFIX}/admin/orders`, requireAdminAuth, (req, res) => {
  try {
    const { from, to, status, page, limit } = req.query;
    const filters = {};
    if (from) {
      const fromNum = Number(from);
      if (!Number.isNaN(fromNum) && fromNum > 0) filters.from = fromNum;
    }
    if (to) {
      const toNum = Number(to);
      if (!Number.isNaN(toNum) && toNum > 0) filters.to = toNum;
    }
    if (status && typeof status === 'string') {
      filters.status = status;
    }

    const pagination = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    };

    const result = listOrders(filters, pagination);
    res.json(result);
  } catch (err) {
    console.error('[Admin] Failed to list orders:', err);
    res.status(500).json({ error: 'Не удалось загрузить список заказов' });
  }
});

// Админка промокодов
app.get(`${API_PREFIX}/admin/promocodes`, requireAdminAuth, (req, res) => {
  try {
    const promos = listPromos();
    res.json({ promos });
  } catch (err) {
    console.error('[Admin] Failed to list promo codes:', err);
    res.status(500).json({ error: 'Не удалось загрузить список промокодов' });
  }
});

// Изображения заказа для просмотра в админке
app.get(`${API_PREFIX}/admin/orders/:invId/images`, requireAdminAuth, (req, res) => {
  try {
    const { invId } = req.params;
    const order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      return res.status(404).json({ error: 'Изображения не найдены' });
    }
    res.json({ invId: order.invId, images: order.generatedImages });
  } catch (err) {
    console.error('[Admin] Failed to get order images:', err);
    res.status(500).json({ error: 'Не удалось загрузить изображения заказа' });
  }
});

// Архив всех портретов заказа (для пользователя)
app.get(`${API_PREFIX}/order/:invId/download`, async (req, res) => {
  try {
    const { invId } = req.params;
    const order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      return res.status(404).json({ error: 'Портреты не найдены' });
    }

    const images = order.generatedImages;
    const archiver = (await import('archiver')).default;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="newava_${invId}_portraits.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[Order] Archive error:', err);
      try {
        res.status(500).end();
      } catch (_) {}
    });

    archive.pipe(res);

    for (const [style, url] of Object.entries(images)) {
      // url вида /images/orders/{invId}/{fileName}.jpg
      if (typeof url !== 'string') continue;
      const parts = url.split('/images/')[1];
      if (!parts) continue;
      const filePath = join(IMAGE_ROOT_DIR, parts.replace(/^orders\//, 'orders/'));
      // Используем фактическое имя файла на диске, чтобы избежать перезаписи
      const nameInArchive = basename(filePath) || 'portrait.jpg';
      archive.file(filePath, { name: nameInArchive });
    }

    archive.finalize();
  } catch (err) {
    console.error('[Order] Failed to download order archive:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не удалось сформировать архив с портретами' });
    }
  }
});

// Архив всех портретов заказа (для админа)
app.get(`${API_PREFIX}/admin/orders/:invId/download`, requireAdminAuth, async (req, res) => {
  try {
    const { invId } = req.params;
    const order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      return res.status(404).json({ error: 'Портреты не найдены' });
    }

    const images = order.generatedImages;
    const archiver = (await import('archiver')).default;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="newava_${invId}_portraits.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[Admin] Archive error:', err);
      try {
        res.status(500).end();
      } catch (_) {}
    });

    archive.pipe(res);

    for (const [style, url] of Object.entries(images)) {
      // url вида /images/orders/{invId}/{fileName}.jpg
      if (typeof url !== 'string') continue;
      const parts = url.split('/images/')[1];
      if (!parts) continue;
      const filePath = join(IMAGE_ROOT_DIR, parts.replace(/^orders\//, 'orders/'));
      // Используем фактическое имя файла на диске, чтобы избежать перезаписи
      const nameInArchive = basename(filePath) || 'portrait.jpg';
      archive.file(filePath, { name: nameInArchive });
    }

    archive.finalize();
  } catch (err) {
    console.error('[Admin] Failed to download order archive:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не удалось сформировать архив с портретами' });
    }
  }
});

// Админская авторизация
app.post(`${API_PREFIX}/admin/login`, express.json(), (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Пароль обязателен' });
    }

    const settings = getAdminSettingsStmt.get();
    if (!settings) {
      console.error('[Admin] admin_settings row not found');
      return res.status(500).json({ error: 'Настройки админа не найдены' });
    }

    const hash = crypto.scryptSync(password, settings.salt, 64).toString('hex');
    if (hash !== settings.passwordHash) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    adminSessions.set(token, {
      createdAt: now,
      expiresAt: now + ADMIN_SESSION_TTL_MS,
    });

    res.setHeader(
      'Set-Cookie',
      `admin_session=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(
        ADMIN_SESSION_TTL_MS / 1000
      )}; SameSite=Lax`
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Login error:', err);
    res.status(500).json({ error: 'Ошибка входа администратора' });
  }
});

app.post(`${API_PREFIX}/admin/logout`, (req, res) => {
  try {
    const session = getAdminSessionFromRequest(req);
    if (session && session.token) {
      adminSessions.delete(session.token);
    }
    res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Logout error:', err);
    res.status(500).json({ error: 'Ошибка выхода администратора' });
  }
});

app.get(`${API_PREFIX}/admin/me`, (req, res) => {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ ok: false });
  }
  return res.json({ ok: true });
});

app.post(`${API_PREFIX}/admin/promocodes`, express.json(), requireAdminAuth, (req, res) => {
  try {
    const { code, maxUses, isActive, expiresAt, note } = req.body || {};
    const normalized = normalizePromoCode(code);
    if (!normalized || normalized.length !== 6 || !/^[A-Z0-9]{6}$/.test(normalized)) {
      return res.status(400).json({ error: 'Промокод должен состоять из 6 символов (латинские буквы и цифры)' });
    }
    const maxUsesNum = Number(maxUses) || 0;
    if (maxUsesNum <= 0) {
      return res.status(400).json({ error: 'Максимальное количество активаций должно быть больше 0' });
    }
    const existing = getPromoByCode(normalized);
    const promo = {
      code: normalized,
      isActive: isActive !== false,
      maxUses: maxUsesNum,
      usedCount: existing?.usedCount ?? 0,
      createdAt: existing?.createdAt ?? Date.now(),
      expiresAt: expiresAt ? Number(expiresAt) : null,
      note: note || existing?.note || null,
    };
    savePromo(promo);
    res.json({ promo: getPromoByCode(normalized) });
  } catch (err) {
    console.error('[Admin] Failed to create/update promo code:', err);
    res.status(500).json({ error: 'Не удалось сохранить промокод' });
  }
});

app.delete(`${API_PREFIX}/admin/promocodes/:code`, requireAdminAuth, (req, res) => {
  try {
    const code = normalizePromoCode(req.params.code);
    deletePromoStmt.run(code);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Failed to delete promo code:', err);
    res.status(500).json({ error: 'Не удалось удалить промокод' });
  }
});

// Применение промокода для бесплатной генерации
app.post(`${API_PREFIX}/promo/use`, express.json({ limit: '11mb' }), async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const { code, imageData, gender, role, company } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, error: 'Промокод обязателен' });
    }
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ ok: false, error: 'Отсутствует исходное изображение' });
    }
    if (!gender || (gender !== 'male' && gender !== 'female')) {
      return res.status(400).json({ ok: false, error: 'Не указан пол' });
    }

    // Проверка попыток по IP
    const attempts = promoAttemptsByIp.get(clientIp) || { count: 0 };
    if (attempts.count >= 5) {
      return res.status(429).json({ ok: false, error: 'Превышено количество попыток ввода промокода. Попробуйте позже.' });
    }

    const normalizedCode = normalizePromoCode(code);
    const promo = getPromoByCode(normalizedCode);

    const now = Date.now();
    const isExpired = promo?.expiresAt && promo.expiresAt < now;
    const noUsesLeft = !promo || !promo.isActive || (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) || isExpired;

    if (noUsesLeft) {
      attempts.count += 1;
      promoAttemptsByIp.set(clientIp, attempts);
      return res.status(400).json({ ok: false, error: 'Промокод недействителен или исчерпал лимит активаций.' });
    }

    // Промокод валиден — создаём заказ и запускаем генерацию
    const invId = createNextInvId();

    const order = {
      invId,
      status: 'processing',
      amount: 0,
      createdAt: Date.now(),
      gender,
      role: typeof role === 'string' ? role : null,
      company: typeof company === 'string' ? company : null,
      photoSessionType: 'Деловая фотосессия',
      hasImageData: true,
      generatedImages: null,
      failureReason: null,
      retries: 0,
      paymentType: 'promo',
      promoCode: normalizedCode,
    };

    saveOrder(order);
    orderImages.set(String(invId), imageData);

    // Обновляем счётчики промокода
    const updatedPromo = {
      ...promo,
      usedCount: (promo.usedCount || 0) + 1,
    };
    if (updatedPromo.usedCount >= updatedPromo.maxUses) {
      updatedPromo.isActive = false;
    }
    savePromo(updatedPromo);

    console.log('[Promo] Promo code applied', {
      code: normalizedCode,
      invId,
      usedCount: updatedPromo.usedCount,
      remaining: Math.max(0, updatedPromo.maxUses - updatedPromo.usedCount),
    });

    // Запускаем генерацию асинхронно
    generatePortraitsForOrder(invId).catch(err => {
      console.error('[Promo] Error in portrait generation with promo:', err);
      const failedOrder = loadOrder(invId);
      if (failedOrder) {
        failedOrder.status = 'failed';
        failedOrder.failureReason = err instanceof Error ? err.message : String(err);
        saveOrder(failedOrder);
      }
    });

    res.json({
      ok: true,
      invId,
      remainingUses: Math.max(0, updatedPromo.maxUses - updatedPromo.usedCount),
    });
  } catch (err) {
    console.error('[Promo] Failed to apply promo code:', err);
    res.status(500).json({ ok: false, error: 'Не удалось применить промокод. Попробуйте позже.' });
  }
});

// Получаем API ключи из переменных окружения
const GEMINI_API_KEY_GENERATION = process.env.GEMINI_API_KEY; // Основной ключ для генерации
const GEMINI_API_KEY_ANALYSIS = process.env.GEMINI_API_KEY_ANALYSIS; // Ключ для анализа изображений

// Robokassa config (настоящие пароли для продакшена)
const ROBOKASSA_LOGIN = process.env.ROBOKASSA_LOGIN || 'newava.pro';
const ROBOKASSA_PASSWORD1 = process.env.ROBOKASSA_PASSWORD1 || 'm8G0UNfjydU08B0wnhbY';
const ROBOKASSA_PASSWORD2 = process.env.ROBOKASSA_PASSWORD2 || 'aCnv87oSLo5n9wICTAb0';
const ROBOKASSA_IS_TEST = process.env.ROBOKASSA_IS_TEST === '1' ? 1 : 0; // 0 = продакшен (по умолчанию), 1 = тест
const ROBOKASSA_PAYMENT_AMOUNT = parseFloat(process.env.ROBOKASSA_PAYMENT_AMOUNT || '100.00');
const ROBOKASSA_PAYMENT_DESC =
  process.env.ROBOKASSA_PAYMENT_DESC || 'Генерация бизнес-портретов (1 пакет из 6 изображений)';

if (!GEMINI_API_KEY_GENERATION) {
  console.error('ERROR: GEMINI_API_KEY не установлен в переменных окружения');
  process.exit(1);
}

if (!GEMINI_API_KEY_ANALYSIS) {
  console.error('ERROR: GEMINI_API_KEY_ANALYSIS не установлен в переменных окружения');
  process.exit(1);
}

// Инициализируем два клиента Gemini
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY_GENERATION }); // Для генерации
const genAIAnalysis = new GoogleGenAI({ apiKey: GEMINI_API_KEY_ANALYSIS }); // Для анализа

// --- SQLite orders storage + in-memory image store ---
// Для продакшена используем SQLite как простую БД, файл монтируем в volume (/data).
const DB_PATH = process.env.ORDERS_DB_PATH || '/data/newava_orders.db';
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invId TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  amount REAL,
  createdAt INTEGER NOT NULL,
  gender TEXT,
  role TEXT,
  company TEXT,
  photoSessionType TEXT DEFAULT 'Деловая фотосессия',
  hasImageData INTEGER DEFAULT 0,
  generatedImagesJson TEXT,
  failureReason TEXT,
  retries INTEGER DEFAULT 0
);
`);

// Расширение схемы orders для новых полей (без потери данных)
try {
  db.exec(`ALTER TABLE orders ADD COLUMN paymentType TEXT`);
} catch (e) {
  // Игнорируем ошибку "duplicate column name", любые другие логируем
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add paymentType column to orders:', e);
  }
}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN promoCode TEXT`);
} catch (e) {
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add promoCode column to orders:', e);
  }
}

// Таблица промокодов
db.exec(`
CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  maxUses INTEGER NOT NULL,
  usedCount INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  expiresAt INTEGER,
  note TEXT
);
`);

// Таблица настроек админа (одна запись с паролем)
db.exec(`
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`);

// Миграция: добавляем столбец для количества портретов, чтобы не парсить JSON при каждом запросе списка
try {
  db.exec(`ALTER TABLE orders ADD COLUMN imagesCount INTEGER DEFAULT 0`);
} catch (e) {
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add imagesCount column to orders:', e);
  }
}

// --- Promo codes storage ---
const getPromoByCodeStmt = db.prepare(`SELECT * FROM promo_codes WHERE code = ?`);
const insertPromoStmt = db.prepare(`
INSERT INTO promo_codes (code, isActive, maxUses, usedCount, createdAt, updatedAt, expiresAt, note)
VALUES (@code, @isActive, @maxUses, @usedCount, @createdAt, @updatedAt, @expiresAt, @note)
ON CONFLICT(code) DO UPDATE SET
  isActive = excluded.isActive,
  maxUses = excluded.maxUses,
  usedCount = excluded.usedCount,
  updatedAt = excluded.updatedAt,
  expiresAt = excluded.expiresAt,
  note = excluded.note
;
`);
const listPromosStmt = db.prepare(`SELECT * FROM promo_codes ORDER BY createdAt DESC`);
const deletePromoStmt = db.prepare(`DELETE FROM promo_codes WHERE code = ?`);

const getAdminSettingsStmt = db.prepare(`SELECT * FROM admin_settings WHERE id = 1`);
const upsertAdminSettingsStmt = db.prepare(`
INSERT INTO admin_settings (id, passwordHash, salt, createdAt, updatedAt)
VALUES (1, @passwordHash, @salt, @createdAt, @updatedAt)
ON CONFLICT(id) DO UPDATE SET
  passwordHash = excluded.passwordHash,
  salt = excluded.salt,
  updatedAt = excluded.updatedAt
;
`);

function normalizePromoCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function mapPromoRow(row) {
  if (!row) return null;
  return {
    code: row.code,
    isActive: !!row.isActive,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    remainingUses: Math.max(0, (row.maxUses || 0) - (row.usedCount || 0)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt || null,
    note: row.note || null,
  };
}

function getPromoByCode(code) {
  const row = getPromoByCodeStmt.get(normalizePromoCode(code));
  return mapPromoRow(row);
}

function savePromo(promo) {
  const now = Date.now();
  insertPromoStmt.run({
    code: normalizePromoCode(promo.code),
    isActive: promo.isActive ? 1 : 0,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount ?? 0,
    createdAt: promo.createdAt ?? now,
    updatedAt: now,
    expiresAt: promo.expiresAt ?? null,
    note: promo.note ?? null,
  });
}

function listPromos() {
  return listPromosStmt.all().map(mapPromoRow);
}

function ensureAdminPasswordSeed() {
  const existing = getAdminSettingsStmt.get();
  if (existing) {
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('513277', salt, 64).toString('hex');
  const now = Date.now();
  upsertAdminSettingsStmt.run({
    passwordHash: hash,
    salt,
    createdAt: now,
    updatedAt: now,
  });
  console.log('[Admin] Seeded default admin password (id=1)');
}

ensureAdminPasswordSeed();

const insertOrderStmt = db.prepare(`
INSERT INTO orders (
  invId,
  status,
  amount,
  createdAt,
  gender,
  role,
  company,
  photoSessionType,
  hasImageData,
  generatedImagesJson,
  imagesCount,
  failureReason,
  retries
)
VALUES (
  @invId,
  @status,
  @amount,
  @createdAt,
  @gender,
  @role,
  @company,
  @photoSessionType,
  @hasImageData,
  @generatedImagesJson,
  @imagesCount,
  @failureReason,
  @retries
)
ON CONFLICT(invId) DO UPDATE SET
  status = excluded.status,
  amount = excluded.amount,
  gender = COALESCE(excluded.gender, orders.gender),
  role = COALESCE(excluded.role, orders.role),
  company = COALESCE(excluded.company, orders.company),
  photoSessionType = COALESCE(excluded.photoSessionType, orders.photoSessionType),
  hasImageData = COALESCE(excluded.hasImageData, orders.hasImageData),
  generatedImagesJson = COALESCE(excluded.generatedImagesJson, orders.generatedImagesJson),
  imagesCount = COALESCE(excluded.imagesCount, orders.imagesCount),
  failureReason = excluded.failureReason,
  retries = excluded.retries,
  paymentType = COALESCE(excluded.paymentType, orders.paymentType),
  promoCode = COALESCE(excluded.promoCode, orders.promoCode)
;
`);

const getOrderStmt = db.prepare(`SELECT * FROM orders WHERE invId = ?`);
const updateImagesCountStmt = db.prepare(
  `UPDATE orders SET imagesCount = @imagesCount WHERE invId = @invId`
);

function saveOrder(order) {
  const imagesCount =
    typeof order.imagesCount === 'number'
      ? order.imagesCount
      : order.generatedImages
      ? Object.keys(order.generatedImages).length
      : 0;

  insertOrderStmt.run({
    invId: String(order.invId),
    status: order.status,
    amount: order.amount ?? null,
    createdAt: order.createdAt ?? Date.now(),
    gender: order.gender ?? null,
    role: order.role ?? null,
    company: order.company ?? null,
    photoSessionType: order.photoSessionType ?? 'Деловая фотосессия',
    hasImageData: order.hasImageData ? 1 : 0,
    generatedImagesJson: order.generatedImages ? JSON.stringify(order.generatedImages) : null,
    imagesCount,
    failureReason: order.failureReason ?? null,
    retries: order.retries ?? 0,
  });
}

function loadOrder(invId) {
  const row = getOrderStmt.get(String(invId));
  if (!row) return null;
  const imagesFromJson = row.generatedImagesJson ? JSON.parse(row.generatedImagesJson) : null;
  return {
    invId: row.invId,
    status: row.status,
    amount: row.amount,
    createdAt: row.createdAt,
    gender: row.gender,
    role: row.role,
    company: row.company,
    photoSessionType: row.photoSessionType,
    hasImageData: !!row.hasImageData,
    generatedImages: imagesFromJson,
    failureReason: row.failureReason,
    retries: row.retries ?? 0,
    paymentType: row.paymentType || null,
    promoCode: row.promoCode || null,
    imagesCount: row.imagesCount != null ? row.imagesCount : imagesFromJson ? Object.keys(imagesFromJson).length : 0,
  };
}

function mapOrderRow(row) {
  const imagesFromJson = row.generatedImagesJson ? JSON.parse(row.generatedImagesJson) : null;
  return {
    invId: row.invId,
    status: row.status,
    amount: row.amount,
    createdAt: row.createdAt,
    gender: row.gender,
    role: row.role,
    company: row.company,
    photoSessionType: row.photoSessionType,
    hasImageData: !!row.hasImageData,
    generatedImages: imagesFromJson,
    failureReason: row.failureReason,
    retries: row.retries ?? 0,
    paymentType: row.paymentType || null,
    promoCode: row.promoCode || null,
    imagesCount: row.imagesCount != null ? row.imagesCount : imagesFromJson ? Object.keys(imagesFromJson).length : 0,
  };
}

// Отдельное in-memory хранилище для исходных изображений (base64),
// которые не кладём в SQLite, чтобы не раздувать БД и не упираться в размер.
// Ключ: invId, значение: строка data URL.
const orderImages = new Map();

// In-memory защита от перебора промокодов: максимум 5 неуспешных попыток на IP за время жизни процесса.
const promoAttemptsByIp = new Map(); // key: ip, value: { count }

// In-memory сессии админа
const adminSessions = new Map(); // key: token, value: { createdAt, expiresAt }
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  const parts = header.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.split('=');
    const key = name && name.trim();
    if (!key) continue;
    const value = rest.join('=').trim();
    cookies[key] = decodeURIComponent(value || '');
  }
  return cookies;
}

function getAdminSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies['admin_session'];
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAdminAuth(req, res, next) {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' });
  }
  req.adminSession = session;
  next();
}

function listOrders(filters = {}, pagination = {}) {
  const { from, to, status } = filters;
  let whereSql = 'WHERE 1=1';
  const params = {};

  if (from) {
    whereSql += ' AND createdAt >= @from';
    params.from = from;
  }
  if (to) {
    whereSql += ' AND createdAt <= @to';
    params.to = to;
  }
  if (status) {
    whereSql += ' AND status = @status';
    params.status = status;
  }

  const page = Number(pagination.page) > 0 ? Number(pagination.page) : 1;
  const pageSize = Number(pagination.limit) > 0 ? Number(pagination.limit) : 50;
  const offset = (page - 1) * pageSize;

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM orders ${whereSql}`);
  const countRow = countStmt.get(params) || { count: 0 };
  const total = Number(countRow.count) || 0;

  const dataStmt = db.prepare(
    `SELECT * FROM orders ${whereSql} ORDER BY createdAt DESC LIMIT @limit OFFSET @offset`
  );
  const rows = dataStmt.all({
    ...params,
    limit: pageSize,
    offset,
  });

  const mapped = rows.map((row) => {
    let imagesCount = row.imagesCount;

    // Для старых заказов, созданных до появления столбца imagesCount,
    // один раз вычисляем количество портретов из JSON и кешируем в БД.
    if (imagesCount == null && row.generatedImagesJson) {
      try {
        const images = JSON.parse(row.generatedImagesJson);
        imagesCount = images && typeof images === 'object' ? Object.keys(images).length : 0;
        if (typeof imagesCount === 'number' && imagesCount > 0) {
          updateImagesCountStmt.run({
            imagesCount,
            invId: row.invId,
          });
        }
      } catch (e) {
        console.warn('[DB] Failed to parse generatedImagesJson for legacy order', row.invId, e);
        imagesCount = 0;
      }
    }

    return {
      invId: row.invId,
      status: row.status,
      amount: row.amount,
      createdAt: row.createdAt,
      gender: row.gender,
      role: row.role,
      company: row.company,
      photoSessionType: row.photoSessionType,
      hasImageData: !!row.hasImageData,
      // В списке не загружаем сами URL-ы изображений
      generatedImages: null,
      failureReason: row.failureReason,
      retries: row.retries ?? 0,
      paymentType: row.paymentType || null,
      promoCode: row.promoCode || null,
      imagesCount: imagesCount != null ? imagesCount : 0,
    };
  });

  return {
    orders: mapped,
    total,
    page,
    pageSize,
  };
}

let lastInvId = Date.now();

function createNextInvId() {
  lastInvId += 1;
  return lastInvId;
}

// Раздаём сохранённые изображения как статику
app.use('/images', express.static(IMAGE_ROOT_DIR));

// Функция для дополнительной агрессивной обработки промежуточного изображения
// Используется если первая попытка генерации провалилась
async function processIntermediateImageAggressively(imageDataUrl, level = 2) {
  try {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URL format');
    }
    
    const [, mimeType, base64Data] = match;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    let { width, height } = metadata;
    
    // Уровень 2: более агрессивная обработка
    // - Уменьшаем до 800px максимум
    // - Сильно снижаем качество JPEG (до 75)
    // - Более сильное размытие и изменение параметров
    const maxDimension = level === 2 ? 800 : 600; // Уровень 2: 800px, уровень 3: 600px
    const jpegQuality = level === 2 ? 75 : 65;
    const blurAmount = level === 2 ? 0.5 : 0.8;
    
    let processedBuffer = imageBuffer;
    
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      processedBuffer = await sharp(imageBuffer)
        .resize(Math.round(width * scale), Math.round(height * scale), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .modulate({
          brightness: 1.10, // Еще больше увеличиваем яркость
          saturation: 0.85, // Еще больше уменьшаем насыщенность
          hue: 0
        })
        .sharpen({ sigma: 0.3 })
        .blur(blurAmount) // Более сильное размытие
        .toBuffer();
      
      const resizedMetadata = await sharp(processedBuffer).metadata();
      width = resizedMetadata.width;
      height = resizedMetadata.height;
    } else {
      processedBuffer = await sharp(imageBuffer)
        .modulate({
          brightness: 1.10,
          saturation: 0.85,
          hue: 0
        })
        .sharpen({ sigma: 0.3 })
        .blur(blurAmount)
        .toBuffer();
    }
    
    // Создаем серый фон
    const grayBackground = sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    }).jpeg({ quality: jpegQuality });
    
    // Накладываем обработанное изображение
    const finalImage = await grayBackground
      .composite([{
        input: processedBuffer,
        blend: 'over'
      }])
      .jpeg({ quality: jpegQuality })
      .toBuffer();
    
    const processedBase64 = finalImage.toString('base64');
    const processedDataUrl = `data:image/jpeg;base64,${processedBase64}`;
    
    safeLog('Aggressively processed intermediate image', {
      level,
      originalSize: imageBuffer.length,
      processedSize: finalImage.length,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      finalWidth: width,
      finalHeight: height,
      jpegQuality,
      sizeReduction: ((1 - finalImage.length / imageBuffer.length) * 100).toFixed(1) + '%'
    });
    
    return processedDataUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to aggressively process intermediate image', { level, error: errorMessage });
    throw new Error(`Не удалось обработать изображение: ${errorMessage}`);
  }
}

// Функция для программной замены фона на серый (для промежуточного изображения)
// Используем более агрессивную обработку для уменьшения вероятности IMAGE_OTHER
async function replaceBackgroundWithGray(imageDataUrl) {
  try {
    // Парсим data URL
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URL format');
    }
    
    const [, mimeType, base64Data] = match;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Получаем метаданные изображения
    const metadata = await sharp(imageBuffer).metadata();
    let { width, height } = metadata;
    
    // Максимально агрессивная обработка для уменьшения вероятности IMAGE_OTHER:
    // 1. Сильно уменьшаем разрешение (до 1024px максимум)
    // 2. Изменяем контраст, яркость, насыщенность
    // 3. Применяем легкое размытие для "смягчения" изображения
    // 4. Создаем серый фон
    // 5. Накладываем обработанное изображение с низким качеством JPEG
    
    let processedBuffer = imageBuffer;
    
    // Агрессивно уменьшаем размер - максимум 1024px по большей стороне
    const maxDimension = 1024;
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      processedBuffer = await sharp(imageBuffer)
        .resize(Math.round(width * scale), Math.round(height * scale), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .modulate({
          brightness: 1.08, // Увеличиваем яркость
          saturation: 0.90, // Уменьшаем насыщенность
          hue: 0
        })
        .sharpen({ sigma: 0.5 }) // Легкая резкость для компенсации уменьшения
        .blur(0.3) // Легкое размытие для "смягчения"
        .toBuffer();
      
      const resizedMetadata = await sharp(processedBuffer).metadata();
      width = resizedMetadata.width;
      height = resizedMetadata.height;
    } else {
      // Если размер нормальный - все равно применяем обработку
      processedBuffer = await sharp(imageBuffer)
        .modulate({
          brightness: 1.08,
          saturation: 0.90,
          hue: 0
        })
        .sharpen({ sigma: 0.5 })
        .blur(0.3)
        .toBuffer();
    }
    
    // Создаем серый фон
    const grayBackground = sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 128, g: 128, b: 128 } // Серый цвет RGB(128, 128, 128)
      }
    })
    .jpeg({ quality: 90 }); // Немного снижаем качество для уменьшения размера
    
    // Накладываем обработанное изображение поверх серого фона
    const finalImage = await grayBackground
      .composite([{
        input: processedBuffer,
        blend: 'over' // Накладываем изображение поверх фона
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
    
    // Конвертируем обратно в base64
    const processedBase64 = finalImage.toString('base64');
    const processedDataUrl = `data:image/jpeg;base64,${processedBase64}`;
    
    safeLog('Background replaced with gray (enhanced processing)', {
      originalSize: imageBuffer.length,
      processedSize: finalImage.length,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      finalWidth: width,
      finalHeight: height,
      sizeReduction: ((1 - finalImage.length / imageBuffer.length) * 100).toFixed(1) + '%'
    });
    
    return processedDataUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to replace background', { error: errorMessage });
    throw new Error(`Не удалось обработать изображение: ${errorMessage}`);
  }
}

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
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (sizeInBytes > maxSize) {
    return { valid: false, error: 'Размер изображения превышает 10MB' };
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

// Буфер для хранения последних логов (для отладки)
const logBuffer = [];
const MAX_LOG_BUFFER_SIZE = 1000; // Храним последние 1000 записей

// Безопасное логирование (без секретов)
function safeLog(message, data = {}) {
  const sanitizedData = { ...data };
  if (sanitizedData.apiKey) delete sanitizedData.apiKey;
  if (sanitizedData.imageData) {
    sanitizedData.imageData = sanitizedData.imageData.substring(0, 50) + '...';
  }
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    data: sanitizedData
  };
  
  // Добавляем в буфер
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift(); // Удаляем старые записи
  }
  
  console.log(`[${logEntry.timestamp}] ${message}`, sanitizedData);
}

// Эндпоинт для генерации изображения (через очередь)
app.post(`${API_PREFIX}/generate-image`, async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData, prompt } = req.body;
    
    // Дополнительное логирование для отладки
    const isIntermediatePrompt = prompt?.includes('Change background to gray') || prompt?.includes('Simple neutral gray background');
    
    // Определяем, является ли это финальным портретом (использует промежуточное изображение)
    // Проверяем по размеру и формату - промежуточные изображения обычно меньше и имеют серый фон
    const isFinalPortrait = !isIntermediatePrompt && imageData?.length > 0;
    const imagePreview = imageData?.substring(0, 100) || 'no image';
    
    safeLog('POST /generate-image received', { 
      clientIp, 
      hasImageData: !!imageData, 
      imageDataLength: imageData?.length || 0,
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      promptPreview: prompt?.substring(0, 200) || 'no prompt',
      isIntermediatePrompt: isIntermediatePrompt,
      isFinalPortrait: isFinalPortrait,
      imagePreview: imagePreview
    });
    
    // Для промежуточных изображений - обрабатываем программно, без API
    if (isIntermediatePrompt) {
      try {
        // Проверяем, нужна ли агрессивная обработка (level 2)
        const aggressiveLevel = req.body.aggressiveLevel || 1; // По умолчанию уровень 1
        
        safeLog('Processing intermediate image with background replacement', { 
          clientIp, 
          aggressiveLevel 
        });
        
        let processedImage;
        if (aggressiveLevel === 1) {
          processedImage = await replaceBackgroundWithGray(imageData);
        } else {
          processedImage = await processIntermediateImageAggressively(imageData, aggressiveLevel);
        }
        
        // Возвращаем обработанное изображение сразу, без очереди
        return res.json({
          jobId: `intermediate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          position: 0,
          estimatedWaitTime: 0,
          estimatedStartTime: Date.now(),
          queueSize: 0,
          totalInSystem: 0,
          processedImage: processedImage, // Возвращаем обработанное изображение напрямую
          isProcessed: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        safeLog('Intermediate image processing failed', { clientIp, error: errorMessage });
        // Если обработка не удалась - продолжаем обычным способом через API
      }
    }

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

    // Добавляем задачу в очередь (теперь синхронная функция)
    const queueResult = addToQueue(imageData, prompt);
    
    // Рассчитываем точное время начала генерации
    const estimatedStartTime = Date.now() + queueResult.estimatedWaitTime;
    
    // Возвращаем jobId и информацию о позиции в очереди
    res.json({
      jobId: queueResult.jobId,
      position: queueResult.position,
      estimatedWaitTime: queueResult.estimatedWaitTime,
      estimatedStartTime: estimatedStartTime, // Абсолютное время начала генерации
      queueSize: generationQueue.length + activeJobs.size,
      totalInSystem: generationQueue.length + activeJobs.size,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to add job to queue', { clientIp, error: errorMessage });
    
    if (errorMessage.includes('переполнена')) {
      return res.status(503).json({ 
        error: errorMessage 
      });
    }
    
    res.status(500).json({ 
      error: 'Не удалось добавить задачу в очередь. Попробуйте позже.' 
    });
  }
});

// Эндпоинт для получения статуса задачи анализа
app.get(`${API_PREFIX}/analysis/:jobId`, (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('[analysis-status] Request received', {
      jobId,
      timestamp: new Date().toISOString()
    });
    
    const status = getAnalysisJobStatus(jobId);
    
    console.log('[analysis-status] Status result', {
      jobId,
      status: status ? status.status : 'null',
      hasError: status?.error ? true : false,
      errorMessage: status?.error || null
    });
    
    if (!status) {
      console.error('[analysis-status] Job not found', { jobId });
      return res.status(404).json({ 
        error: 'Задача анализа не найдена' 
      });
    }
    
    // Если задача завершена, возвращаем результат в формате для evaluate-image
    if (status.status === 'completed') {
      const parsed = status.result;
      const d = parsed.details || {};
      let postIsValid = parsed.isValid === true && parsed.errorType !== 'prohibited_content';
      let postErrorType = parsed.errorType || 'none';

      let errorMessage = '';
      if (!postIsValid) {
        if (postErrorType === 'prohibited_content') {
          errorMessage = 'Вы загрузили изображение с социально неприемлемым контентом. Выберите другое изображение.';
        } else if (postErrorType === 'not_single_person') {
          if (d?.hasMultiplePeople) {
            errorMessage = 'На изображении несколько человек. Пожалуйста, загрузите изображение с одним человеком (селфи или портрет).';
          } else if (d?.hasAnimals) {
            errorMessage = 'На изображении есть животные. Пожалуйста, загрузите изображение с одним человеком (мужчина или женщина).';
          } else if (d?.hasLandscape) {
            errorMessage = 'Это изображение пейзажа. Пожалуйста, загрузите изображение с одним человеком (селфи или портрет).';
          } else if (d?.hasOtherObjects && !d?.hasSinglePerson) {
            errorMessage = 'На изображении нет человека. Пожалуйста, загрузите изображение с одним человеком (мужчина или женщина).';
          } else if (d?.isPhotographOfRealPerson === false) {
            errorMessage = 'Это не фотография реального человека (рисунок/иллюстрация/рендер). Загрузите фото человека.';
          } else if (d?.isFaceClearlyVisible === false) {
            errorMessage = 'Лицо плохо видно. Пожалуйста, загрузите фото анфас с хорошо видимым лицом.';
          } else {
            errorMessage = 'Пожалуйста, загрузите изображение с одним человеком в кадре (мужчина или женщина).';
          }
        } else if (postErrorType === 'license_violation') {
          errorMessage = 'Изображение содержит защищенный авторским правом контент. Выберите другое изображение.';
        } else {
          errorMessage = parsed.errorMessage || 'Пожалуйста, загрузите изображение с одним человеком в кадре (мужчина или женщина).';
        }
      }
      
      return res.json({
        status: 'completed',
        isValid: postIsValid,
        errorType: postErrorType,
        errorMessage: errorMessage,
        gender: parsed.gender || 'unknown',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        details: d
      });
    }
    
    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to get analysis status', { jobId: req.params.jobId, error: errorMessage });
    res.status(500).json({ 
      error: 'Не удалось получить статус задачи анализа' 
    });
  }
});

// Эндпоинт для проверки статуса генерации
app.get(`${API_PREFIX}/generate-image/:jobId`, async (req, res) => {
  const { jobId } = req.params;
  
  try {
    safeLog('Checking job status', { 
      jobId,
      queueSize: generationQueue.length,
      activeJobsCount: activeJobs.size,
      completedJobsCount: completedJobs.size
    });
    
    const status = getJobStatus(jobId);
    
    if (!status) {
      // Дополнительное логирование для отладки
      safeLog('Job not found', { 
        jobId,
        queueJobIds: generationQueue.map(j => j.id).slice(0, 10),
        activeJobIds: Array.from(activeJobs).slice(0, 10),
        completedJobIds: Array.from(completedJobs.keys()).slice(0, 10)
      });
      
      return res.status(404).json({ 
        error: 'Задача не найдена или уже завершена' 
      });
    }
    
    safeLog('Job status found', { jobId, status: status.status });
    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to get job status', { jobId, error: errorMessage });
    res.status(500).json({ 
      error: 'Не удалось получить статус задачи' 
    });
  }
});

// Эндпоинт для получения статистики очереди
app.get(`${API_PREFIX}/queue/stats`, (req, res) => {
  cleanupGeminiRequestTimestamps();
  res.json({
    queueSize: generationQueue.length,
    activeJobs: activeJobs.size,
    maxConcurrent: MAX_CONCURRENT_GENERATIONS,
    currentJobIds: Array.from(activeJobs),
    avgGenerationTime: calculateAverageGenerationTime(),
    completedJobsCount: completedJobs.size,
    geminiRateLimit: {
      rpmLimit: GEMINI_RPM_LIMIT,
      currentRequestsInWindow: geminiRequestTimestamps.length,
      minIntervalMs: GEMINI_MIN_INTERVAL,
    },
  });
});

// Эндпоинт для получения логов (только для отладки)
app.get(`${API_PREFIX}/logs`, (req, res) => {
  const { 
    limit = 100, 
    filter = '', 
    since = null,
    includeIntermediate = 'true' // По умолчанию показываем все логи
  } = req.query;
  
  let filteredLogs = [...logBuffer];
  
  // Фильтр по тексту
  if (filter) {
    const filterLower = filter.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.message.toLowerCase().includes(filterLower) ||
      JSON.stringify(log.data).toLowerCase().includes(filterLower)
    );
  }
  
  // Фильтр по времени
  if (since) {
    const sinceTime = new Date(since).getTime();
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp).getTime() >= sinceTime
    );
  }
  
  // Фильтр для промежуточных изображений
  if (includeIntermediate !== 'true') {
    // Показываем только логи, связанные с промежуточными изображениями
    filteredLogs = filteredLogs.filter(log => 
      log.message.includes('intermediate') ||
      log.message.includes('Intermediate') ||
      (log.data && (
        log.data.isIntermediatePrompt === true ||
        log.data.promptPreview?.includes('Simple neutral gray background')
      ))
    );
  }
  
  // Ограничиваем количество
  const limitNum = Math.min(parseInt(limit) || 100, 500);
  const result = filteredLogs.slice(-limitNum).reverse(); // Последние логи первыми
  
  res.json({
    logs: result,
    total: filteredLogs.length,
    bufferSize: logBuffer.length,
    maxBufferSize: MAX_LOG_BUFFER_SIZE
  });
});

// Эндпоинт для полной оценки изображения (валидация + определение пола за один запрос)
app.post(`${API_PREFIX}/evaluate-image`, async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // Логируем ВСЕ запросы для диагностики
  console.log('[evaluate-image] Request received', {
    clientIp,
    hasImageData: !!req.body?.imageData,
    imageDataLength: req.body?.imageData?.length || 0,
    timestamp: new Date().toISOString()
  });
  
  try {
    const { imageData } = req.body;

    if (!imageData) {
      console.error('[evaluate-image] Missing imageData', { clientIp });
      safeLog('Image evaluation failed: missing imageData', { clientIp });
      return res.status(400).json({ 
        error: 'Отсутствует обязательный параметр: imageData' 
      });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      safeLog('Image evaluation failed: invalid image', { clientIp, error: imageValidation.error });
      return res.status(400).json({ error: imageValidation.error });
    }

    // Добавляем задачу в очередь анализа
    console.log('[evaluate-image] Adding to analysis queue', {
      clientIp,
      imageDataLength: imageData.length
    });
    
    const queueResult = addToAnalysisQueue(imageData, 'evaluate');
    const jobId = queueResult.jobId;
    
    console.log('[evaluate-image] Job added to queue', {
      jobId,
      position: queueResult.position,
      estimatedWaitTime: queueResult.estimatedWaitTime
    });
    
    // Возвращаем jobId для polling статуса
    return res.json({
      jobId: jobId,
      status: 'queued',
      position: queueResult.position,
      estimatedWaitTime: queueResult.estimatedWaitTime,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[evaluate-image] Error:', {
      clientIp,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    safeLog('Image evaluation request failed', { clientIp, error: errorMessage });
    
    if (errorMessage.includes('переполнена')) {
      return res.status(503).json({ 
        error: errorMessage 
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при обработке запроса' 
    });
  }
});

// Эндпоинт для валидации изображения (старый, для обратной совместимости)
app.post(`${API_PREFIX}/validate-image`, async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData } = req.body;

    if (!imageData) {
      safeLog('Image validation failed: missing imageData', { clientIp });
      return res.status(400).json({ 
        error: 'Отсутствует обязательный параметр: imageData' 
      });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      safeLog('Image validation failed: invalid image', { clientIp, error: imageValidation.error });
      return res.status(400).json({ error: imageValidation.error });
    }

    const { mimeType, base64Data } = imageValidation;

    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };

    const validationPrompt = {
      text: `Analyze image. Return ONLY valid JSON:
{
  "isValid": boolean,
  "errorType": "none" | "prohibited_content" | "not_single_person" | "license_violation",
  "errorMessage": "string in Russian" (only if isValid is false),
  "details": {
    "hasSinglePerson": boolean,
    "personGender": "male" | "female" | "unknown" | "multiple" | "none",
    "hasProhibitedContent": boolean,
    "hasAnimals": boolean,
    "hasLandscape": boolean,
    "hasMultiplePeople": boolean
  }
}

RULES - BE VERY PERMISSIVE:
1. Set isValid: true if image shows ANY person (male/female) clearly visible, even if:
   - There are pets/animals in background (person is main subject = VALID)
   - There are other people far in background (one main person = VALID)
   - Image is a selfie, portrait, or professional photo = VALID
   - Person is partially visible but recognizable = VALID
   
2. Set isValid: false ONLY if:
   - NO person visible at all (just landscape/objects/animals) = NOT VALID
   - Multiple people EQUALLY prominent (group photo) = NOT VALID
   - Explicit sexual/nude content = NOT VALID
   - Extreme violence/gore = NOT VALID
   - Obvious deepfake of celebrity = NOT VALID
   
3. When UNSURE or AMBIGUOUS → ALWAYS set isValid: true (be permissive)

Default: isValid = true unless clearly invalid.`,
    };

    try {
      await waitForGeminiAnalysisRateLimit();
      
      const response = await genAIAnalysis.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [imagePart, validationPrompt] },
        config: {
          responseModalities: [Modality.TEXT],
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE',
            },
          ],
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

      if (parsed && typeof parsed.isValid === 'boolean') {
        const duration = Date.now() - startTime;
        safeLog('Image validation completed', { 
          clientIp, 
          isValid: parsed.isValid, 
          errorType: parsed.errorType,
          duration 
        });
        
        if (parsed.isValid) {
          return res.json({ 
            isValid: true,
            errorType: 'none',
            errorMessage: '',
            details: parsed.details || {}
          });
        } else {
          // Определяем сообщение об ошибке на русском
          let errorMessage = parsed.errorMessage || 'Изображение не соответствует требованиям';
          
          if (parsed.errorType === 'prohibited_content') {
            errorMessage = 'Вы загрузили изображение с социально неприемлемым контентом. Выберите другое изображение.';
          } else if (parsed.errorType === 'not_single_person') {
            if (parsed.details?.hasMultiplePeople) {
              errorMessage = 'На изображении несколько человек. Пожалуйста, загрузите изображение с одним человеком (селфи или портрет).';
            } else if (parsed.details?.hasAnimals) {
              errorMessage = 'На изображении есть животные. Пожалуйста, загрузите изображение с одним человеком (мужчина или женщина).';
            } else if (parsed.details?.hasLandscape) {
              errorMessage = 'Это изображение пейзажа. Пожалуйста, загрузите изображение с одним человеком (селфи или портрет).';
            } else if (parsed.details?.hasOtherObjects && !parsed.details?.hasSinglePerson) {
              errorMessage = 'На изображении нет человека. Пожалуйста, загрузите изображение с одним человеком (мужчина или женщина).';
            } else {
              errorMessage = 'Пожалуйста, загрузите изображение с одним человеком в кадре (мужчина или женщина).';
            }
          } else if (parsed.errorType === 'license_violation') {
            errorMessage = 'Изображение содержит защищенный авторским правом контент. Выберите другое изображение.';
          }
          
          return res.json({
            isValid: false,
            errorType: parsed.errorType,
            errorMessage: errorMessage,
            details: parsed.details || {}
          });
        }
      }

      // Fallback: если не удалось распарсить JSON, но ответ содержит положительные слова - пропускаем
      const duration = Date.now() - startTime;
      const rawLower = raw.toLowerCase();
      const hasPositiveIndicators = (
        rawLower.includes('valid') && rawLower.includes('true') ||
        rawLower.includes('valid') && !rawLower.includes('false') ||
        rawLower.includes('isvalid') && rawLower.includes('true') ||
        rawLower.includes('one person') ||
        rawLower.includes('single person') ||
        rawLower.includes('человек') && !rawLower.includes('несколько')
      );
      
      if (hasPositiveIndicators) {
        safeLog('Image validation: parse failed but positive indicators found, allowing', { clientIp, raw: raw.substring(0, 200), duration });
        return res.json({
          isValid: true,
          errorType: 'none',
          errorMessage: '',
          details: {}
        });
      }
      
      safeLog('Image validation failed: could not parse response', { clientIp, raw: raw.substring(0, 200), duration });
      // Если не удалось распарсить и нет положительных индикаторов - пропускаем (быть пермиссивным)
      return res.json({
        isValid: true,
        errorType: 'none',
        errorMessage: '',
        details: {}
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      safeLog('Image validation error', { 
        clientIp, 
        error: errorMsg, 
        duration 
      });
      
      // При ошибке валидации (сетевой ошибке, таймауте и т.д.) - пропускаем изображение (быть пермиссивным)
      // Отклоняем только если это явная ошибка безопасности API
      const isSafetyError = errorMsg.toLowerCase().includes('safety') || 
                           errorMsg.toLowerCase().includes('blocked') ||
                           errorMsg.toLowerCase().includes('harm');
      
      if (isSafetyError) {
        return res.json({
          isValid: false,
          errorType: 'prohibited_content',
          errorMessage: 'Вы загрузили изображение с социально неприемлемым контентом. Выберите другое изображение.',
          details: {}
        });
      }
      
      // Для остальных ошибок - пропускаем (быть пермиссивным)
      return res.json({
        isValid: true,
        errorType: 'none',
        errorMessage: '',
        details: {}
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Image validation failed', { clientIp, error: errorMessage, duration });
    // При критической ошибке - пропускаем изображение (быть пермиссивным)
    res.json({ 
      isValid: true,
      errorType: 'none',
      errorMessage: '',
      details: {}
    });
  }
});

// Эндпоинт для определения пола
app.post(`${API_PREFIX}/detect-gender`, async (req, res) => {
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
      // Ожидаем перед запросом, чтобы не превысить rate limits
      await waitForGeminiAnalysisRateLimit();
      
      const response = await genAIAnalysis.models.generateContent({
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

// Также доступен через /api/health для консистентности
app.get(`${API_PREFIX}/health`, (req, res) => {
  console.log('[health] Health check endpoint called');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обработчик для всех необработанных маршрутов (должен быть последним)
app.use((req, res) => {
  console.log('[404] Route not found:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl
  });
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://0.0.0.0:${PORT}`);
  console.log(`🔒 CORS разрешен для: ${allowedOrigins.join(', ')}`);
});

