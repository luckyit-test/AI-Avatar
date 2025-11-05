import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env.local если существует, иначе .env
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') }); // fallback на .env
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3001;

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

// Структура задачи в очереди генерации
class GenerationJob {
  constructor(id, imageData, prompt) {
    this.id = id;
    this.imageData = imageData;
    this.prompt = prompt;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
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
    const { mimeType, base64Data } = validateImageData(job.imageData);
    const imagePart = {
      inlineData: { mimeType, data: base64Data },
    };
    const textPart = { text: job.prompt };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        safeLog('Calling Gemini API', { 
          jobId: job.id, 
          attempt
        });
        
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [imagePart, textPart] },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });
        
        // Детальное логирование ответа для отладки
        const responseParts = response.candidates?.[0]?.content?.parts || [];
        const hasImagePart = responseParts.some(part => part.inlineData);
        const hasTextPart = responseParts.some(part => part.text);
        
        safeLog('Gemini API response received', { 
          jobId: job.id,
          hasImagePart,
          hasTextPart,
          partsCount: responseParts.length,
          partsTypes: responseParts.map(p => Object.keys(p).join(',')),
          candidateFinishReason: response.candidates?.[0]?.finishReason
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
        const finishReason = response.candidates?.[0]?.finishReason || 'unknown';
        
        // IMAGE_OTHER может быть временной проблемой - пробуем повторить
        const isRetriableFinishReason = (
          finishReason === 'IMAGE_OTHER' ||
          finishReason === 'OTHER' ||
          finishReason === 'RECITATION'
        );
        
        if (isRetriableFinishReason && attempt < maxRetries) {
          safeLog('Image generation returned retriable finish reason, retrying', { 
            jobId: job.id,
            finishReason,
            attempt,
            textResponse: textResponse.substring(0, 100)
          });
          
          // Небольшая задержка перед повтором
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        const errorMessage = `Модель ИИ ответила текстом вместо изображения. Finish reason: ${finishReason}. Text: "${textResponse.substring(0, 200)}"`;
        
        safeLog('Image generation failed - text response instead of image', { 
          jobId: job.id,
          finishReason,
          textResponse: textResponse.substring(0, 200),
          hasImagePart,
          hasTextPart,
          attempt
        });
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        
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
    
    throw lastError || new Error('Превышено максимальное количество попыток');
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Детальное логирование всех ошибок генерации
    safeLog('Image generation failed (queued)', { 
      jobId: job.id, 
      error: errorMessage, 
      duration,
      errorStack: errorStack?.substring(0, 500),
      attempts: maxRetries,
      lastError: lastError ? (lastError instanceof Error ? lastError.message : String(lastError)) : null
    });
    
    // Передаем более понятное сообщение об ошибке, если это ошибка API ключа
    let userFriendlyError = 'Не удалось сгенерировать изображение. Попробуйте позже.';
    if (errorMessage.includes('API ключа') || errorMessage.includes('api key') || errorMessage.includes('leaked')) {
      userFriendlyError = 'Ошибка конфигурации сервера. Обратитесь к администратору.';
    } else if (errorMessage.includes('IMAGE_OTHER') || errorMessage.includes('finishReason')) {
      userFriendlyError = 'Временная проблема с генерацией. Попробуйте снова.';
    }
    
    job.setError(new Error(userFriendlyError));
    
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

      // Запускаем все задачи из пакета одновременно (без await - не ждем завершения!)
      batchJobs.forEach(job => {
        processJob(job).catch(err => {
          console.error('Unexpected error in processJob:', err);
          activeJobs.delete(job.id);
          currentJobIds = currentJobIds.filter(id => id !== job.id);
          // Перезапускаем обработку очереди после ошибки
          processQueue();
        });
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
  "isValid": boolean,  // true только если все три вопроса: ДА, ДА, НЕТ (не нарушает)
  "errorType": "none" | "prohibited_content" | "not_single_person" | "license_violation",
  "errorMessage": "строка на русском" (только если isValid: false),
  "gender": "male" | "female" | "unknown",  // ОБЯЗАТЕЛЬНО верни пол, если isValid: true
  "confidence": число от 0 до 1,  // уверенность в определении пола
  "details": {
    "isPhotographOfRealPerson": boolean,  // это фото реального человека?
    "isSelfieOnePerson": boolean,  // это селфи/портрет одного человека?
    "hasSinglePerson": boolean,  // есть ли один человек на фото?
    "isFaceClearlyVisible": boolean,  // лицо хорошо видно?
    "hasProhibitedContent": boolean,  // есть запрещенный контент?
    "hasMultiplePeople": boolean  // несколько людей?
  }
}

ВАЖНО:
- Если это фото реального человека, селфи одного человека, и нет запрещенного контента → isValid: true, и ОБЯЗАТЕЛЬНО верни gender ("male" или "female")
- Если что-то не так → isValid: false и укажи errorType
- Будь строгим только к реальным проблемам (рисунки, группа людей, запрещенный контент)
- Если это явно фото одного человека - принимай (isValid: true)`,
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

// Получаем API ключи из переменных окружения
const GEMINI_API_KEY_GENERATION = process.env.GEMINI_API_KEY; // Основной ключ для генерации
const GEMINI_API_KEY_ANALYSIS = process.env.GEMINI_API_KEY_ANALYSIS; // Ключ для анализа изображений

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

// Эндпоинт для генерации изображения (через очередь)
app.post(`${API_PREFIX}/generate-image`, async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData, prompt } = req.body;
    
    // Дополнительное логирование для отладки
    safeLog('POST /generate-image received', { 
      clientIp, 
      hasImageData: !!imageData, 
      imageDataLength: imageData?.length || 0,
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0
    });

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
      let postErrorType = postIsValid ? 'none' : (parsed.errorType === 'prohibited_content' ? 'prohibited_content' : 'not_single_person');
      
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
        }
      }
      
      return res.json({
        status: 'completed',
        isValid: postIsValid,
        errorType: postErrorType || 'none',
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
