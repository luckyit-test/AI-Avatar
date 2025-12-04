import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI, Modality } from '@google/genai';
import { join, basename } from 'path';
import { promises as fs } from 'fs';

// Import configuration
import {
  PORT,
  IMAGE_ROOT_DIR,
  GENERATION_INTERVAL,
  MAX_QUEUE_SIZE,
  MAX_CONCURRENT_GENERATIONS,
  GEMINI_RPM_LIMIT,
  GEMINI_MIN_INTERVAL,
  GEMINI_ANALYSIS_RPM_LIMIT,
  GEMINI_ANALYSIS_MIN_INTERVAL,
  GEMINI_WINDOW_SIZE,
  MAX_REQUESTS_PER_SECOND,
  SECOND_DELAY_ON_LIMIT,
  BATCH_SIZE,
  USER_BATCH_WINDOW,
  MAX_CONCURRENT_ANALYSIS,
  AVERAGE_ANALYSIS_TIME,
  MAX_COMPLETED_JOBS,
  MAX_HISTORY_SIZE,
  MAX_PROMPT_SOFTENING_LEVEL,
  GEMINI_API_KEY_GENERATION,
  GEMINI_API_KEY_ANALYSIS,
  ALLOWED_ORIGINS,
  API_PREFIX,
  ROBOKASSA_LOGIN,
  ROBOKASSA_PASSWORD1,
  ROBOKASSA_PASSWORD2,
  ROBOKASSA_IS_TEST,
  ROBOKASSA_PAYMENT_AMOUNT,
  ROBOKASSA_PAYMENT_DESC,
} from './config/index.js';

// Import database
import { initializeDatabase, db, getAdminSettingsStmt } from './db/index.js';
import { saveOrder, loadOrder, listOrders, createNextInvId, orderImages } from './db/orders.js';
import { getPromoByCode, savePromo, listPromos, normalizePromoCode, deletePromoStmt, promoAttemptsByIp } from './db/promocodes.js';

// Import queues
import { 
  generationQueue, 
  activeJobs, 
  completedJobs, 
  generationTimes,
  GenerationJob,
  buildFallbackPrompt,
  calculateAverageGenerationTime,
  cleanupGeminiRequestTimestamps,
  cleanupGeminiRequestsPerSecond,
  addToQueue,
  getJobStatus,
  geminiRequestTimestamps,
  geminiRequestsPerSecond,
  lastBatchSendTime,
  userBatchGroups,
} from './queues/generationQueue.js';
import { 
  analysisQueue, 
  activeAnalysisJobs, 
  completedAnalysisJobs,
  AnalysisJob,
  waitForGeminiAnalysisRateLimit,
  addToAnalysisQueue,
  getAnalysisJobStatus,
} from './queues/analysisQueue.js';

// Import middleware
import { rateLimit } from './middleware/rateLimit.js';
import { requireAdminAuth, getAdminSessionFromRequest, createAdminSession, deleteAdminSession, ADMIN_SESSION_TTL_MS } from './middleware/auth.js';

// Import services
import { validateImageData, validatePrompt } from './services/validation.js';
import { replaceBackgroundWithGray, processIntermediateImageAggressively } from './services/imageProcessing.js';
import { generatePortraitsForOrder } from './services/portraitGeneration.js';
import { buildPortraitPrompts } from './services/promptBuilder.js';

// Import utilities
import { safeLog, getLogBuffer } from './lib/utils.js';

// Import routes
import adminRoutes, { initializeAdminRoutes } from './routes/admin.js';
import generationRoutes, { initializeGenerationRoutes } from './routes/generation.js';
import analysisRoutes, { initializeAnalysisRoutes } from './routes/analysis.js';
import paymentRoutes, { initializePaymentRoutes } from './routes/payment.js';

const app = express();

// Initialize database
initializeDatabase();

// Local wrapper functions that call processQueue/processAnalysisQueue
// These functions are needed because processQueue/processAnalysisQueue are server-specific
function addToQueueLocal(imageData, prompt) {
  const result = addToQueue(imageData, prompt, MAX_QUEUE_SIZE);
  processQueue();
  return result;
}

function addToAnalysisQueueLocal(imageData, type) {
  console.log('[addToAnalysisQueueLocal] Adding task to queue', { type, queueSize: analysisQueue.length });
  const result = addToAnalysisQueue(imageData, type);
  console.log('[addToAnalysisQueueLocal] Task added', { jobId: result.jobId, queueSize: analysisQueue.length });
  processAnalysisQueue();
  return result;
}

// All classes and utility functions are now imported from modules:
// - GenerationJob, AnalysisJob from queues modules
// - buildFallbackPrompt, calculateAverageGenerationTime, cleanupGeminiRequestTimestamps, etc. from queues modules
// - waitForGeminiAnalysisRateLimit from queues/analysisQueue.js

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

// addToQueue is now handled by addToQueueLocal wrapper above

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
  console.log('[processAnalysisJob] Started', {
    jobId: job.id,
    type: job.type,
    queueSize: analysisQueue.length,
    activeJobs: activeAnalysisJobs.size,
    maxConcurrent: MAX_CONCURRENT_ANALYSIS
  });
  
  safeLog('processAnalysisJob started', {
    jobId: job.id,
    type: job.type,
    queueSize: analysisQueue.length,
    activeJobs: activeAnalysisJobs.size,
    maxConcurrent: MAX_CONCURRENT_ANALYSIS
  });
  
  activeAnalysisJobs.add(job.id);
  job.startedAt = Date.now();
  
  try {
    console.log('[processAnalysisJob] Calling performImageAnalysis', { jobId: job.id, type: job.type });
    safeLog('Calling performImageAnalysis', { jobId: job.id, type: job.type });
    const result = await performImageAnalysis(job.imageData, job.type, job.id);
    console.log('[processAnalysisJob] performImageAnalysis completed', { jobId: job.id, hasResult: !!result });
    safeLog('performImageAnalysis completed', { jobId: job.id, hasResult: !!result });
    
    job.setResult(result);
    
    // Сохраняем завершенную задачу
    completedAnalysisJobs.set(job.id, job);
    if (completedAnalysisJobs.size > MAX_COMPLETED_JOBS) {
      const firstKey = completedAnalysisJobs.keys().next().value;
      completedAnalysisJobs.delete(firstKey);
    }
    
    activeAnalysisJobs.delete(job.id);
    console.log('[processAnalysisJob] Completed successfully', { jobId: job.id });
    safeLog('Analysis job completed successfully', { jobId: job.id });
    processAnalysisQueue(); // Проверяем, есть ли еще задачи для обработки
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[processAnalysisJob] Failed', {
      jobId: job.id,
      error: errorMessage,
      errorStack: errorStack?.substring(0, 500)
    });
    
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
  console.log('[processAnalysisQueue] Called', {
    queueSize: analysisQueue.length,
    activeJobs: activeAnalysisJobs.size,
    maxConcurrent: MAX_CONCURRENT_ANALYSIS
  });
  
  safeLog('processAnalysisQueue called', {
    queueSize: analysisQueue.length,
    activeJobs: activeAnalysisJobs.size,
    maxConcurrent: MAX_CONCURRENT_ANALYSIS
  });
  
  // Запускаем новые задачи, пока не достигнут лимит параллельных анализов
  while (activeAnalysisJobs.size < MAX_CONCURRENT_ANALYSIS && analysisQueue.length > 0) {
    const job = analysisQueue.shift();
    console.log('[processAnalysisQueue] Starting job', {
      jobId: job.id,
      type: job.type,
      queueSize: analysisQueue.length,
      activeJobs: activeAnalysisJobs.size
    });
    
    safeLog('Starting analysis job from queue', {
      jobId: job.id,
      type: job.type,
      queueSize: analysisQueue.length,
      activeJobs: activeAnalysisJobs.size
    });
    
    // Запускаем задачу асинхронно (не ждем завершения)
    processAnalysisJob(job).catch(err => {
      console.error('[processAnalysisQueue] Unexpected error in processAnalysisJob:', err);
      safeLog('Unexpected error in processAnalysisJob', {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err)
      });
      activeAnalysisJobs.delete(job.id);
    });
    
    // Небольшая задержка между запусками для снижения нагрузки
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (analysisQueue.length > 0) {
    console.log('[processAnalysisQueue] Queue not empty but max concurrent reached', {
      queueSize: analysisQueue.length,
      activeJobs: activeAnalysisJobs.size,
      maxConcurrent: MAX_CONCURRENT_ANALYSIS
    });
    safeLog('processAnalysisQueue: queue not empty but max concurrent reached', {
      queueSize: analysisQueue.length,
      activeJobs: activeAnalysisJobs.size,
      maxConcurrent: MAX_CONCURRENT_ANALYSIS
    });
  }
}

// Добавление задачи в очередь анализа
// addToAnalysisQueue is now imported from modules, use addToAnalysisQueueLocal wrapper

// getAnalysisJobStatus and getJobStatus are imported from queue modules

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

// rateLimit and API_PREFIX are imported from middleware/rateLimit.js and config/index.js

// Initialize routes BEFORE other handlers to ensure they have priority
// Routes are initialized after genAI and genAIAnalysis are created (see below)

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

// All prompt building functions are imported from services/promptBuilder.js
// buildPortraitPrompts is imported at the top of the file (line 82)

// Old duplicate functions removed - using imported versions from modules

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
        generatePortraitsForOrder(invId, MAX_QUEUE_SIZE).catch(err => {
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
      console.log('[Gallery] Returning cached portraits:', galleryCache.length);
      return res.json({ portraits: galleryCache.slice(0, limit) });
    }

    // Получаем последние завершенные заказы с портретами
    // Пробуем сначала строгие условия, потом смягчаем
    let stmt = db.prepare(`
      SELECT invId, generatedImagesJson, createdAt, status
      FROM orders 
      WHERE status = 'completed' 
        AND generatedImagesJson IS NOT NULL 
        AND generatedImagesJson != 'null'
        AND imagesCount > 0
      ORDER BY createdAt DESC 
      LIMIT 50
    `);
    
    let orders = stmt.all();
    
    // Если не нашли завершенные заказы, пробуем найти любые заказы с портретами
    if (orders.length === 0) {
      console.log('[Gallery] No completed orders found, trying to find any orders with portraits');
      stmt = db.prepare(`
        SELECT invId, generatedImagesJson, createdAt, status
        FROM orders 
        WHERE generatedImagesJson IS NOT NULL 
          AND generatedImagesJson != 'null'
          AND generatedImagesJson != ''
          AND (imagesCount > 0 OR generatedImagesJson LIKE '%/images/%')
        ORDER BY createdAt DESC 
        LIMIT 50
      `);
      orders = stmt.all();
      console.log('[Gallery] Found orders with portraits (any status):', orders.length);
    } else {
      console.log('[Gallery] Found completed orders:', orders.length);
    }
    
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

    console.log('[Gallery] Total portraits extracted:', portraits.length);

    // Перемешиваем для разнообразия
    for (let i = portraits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [portraits[i], portraits[j]] = [portraits[j], portraits[i]];
    }

    // Обновляем кэш
    galleryCache = portraits;
    galleryCacheTime = now;

    console.log('[Gallery] Returning portraits:', portraits.slice(0, limit).length);
    res.json({ portraits: portraits.slice(0, limit) });
  } catch (err) {
    console.error('[Gallery] Failed to load recent portraits:', err);
    res.status(500).json({ error: 'Не удалось загрузить галерею портретов' });
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

    const token = createAdminSession();

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
      deleteAdminSession(session.token);
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

// Инициализируем два клиента Gemini (API keys already imported from config)
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY_GENERATION }); // Для генерации
const genAIAnalysis = new GoogleGenAI({ apiKey: GEMINI_API_KEY_ANALYSIS }); // Для анализа

// Initialize routes with dependencies
initializeAdminRoutes({
  listOrders,
  loadOrder,
  listPromos,
  getPromoByCode,
  savePromo,
  normalizePromoCode,
  deletePromoStmt,
});

initializeGenerationRoutes({
  validateImageData,
  validatePrompt,
  replaceBackgroundWithGray,
  processIntermediateImageAggressively,
  safeLog,
});

initializeAnalysisRoutes({
  validateImageData,
  genAIAnalysis,
  safeLog,
  addToAnalysisQueueLocal,
});

initializePaymentRoutes({
  createNextInvId,
  saveOrder,
  loadOrder,
  orderImages,
  generatePortraitsForOrder,
});

// Mount routes IMMEDIATELY after initialization, BEFORE other route handlers
app.use(adminRoutes);
app.use(generationRoutes);
app.use(analysisRoutes);
app.use(paymentRoutes);

// --- SQLite orders storage + in-memory image store ---
// Для продакшена используем SQLite как простую БД, файл монтируем в volume (/data).
// Database initialization and all DB operations are now in db/index.js, db/orders.js, db/promocodes.js
// orderImages Map is exported from db/orders.js
// promoAttemptsByIp is imported from db/promocodes.js (line 44)

// Admin session functions are imported from middleware/auth.js
// adminSessions Map is internal to middleware/auth.js module
// listOrders is imported from db/orders.js (line 43)

// createNextInvId is imported from db/orders.js
// Routes are already mounted above (after initialization)

// Раздаём сохранённые изображения как статику
app.use('/images', express.static(IMAGE_ROOT_DIR));

// validateImageData and validatePrompt are imported from services/validation.js (line 79)
// safeLog is imported from lib/utils.js

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

    // Добавляем задачу в очередь (используем локальную обертку, которая вызывает processQueue)
    const queueResult = addToQueueLocal(imageData, prompt);
    
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
  
  let filteredLogs = getLogBuffer();
  
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
    
    const queueResult = addToAnalysisQueueLocal(imageData, 'evaluate');
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

// Обработка ошибок при запуске сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://0.0.0.0:${PORT}`);
  console.log(`🔒 CORS разрешен для: ${allowedOrigins.join(', ')}`);
}).on('error', (err) => {
  console.error('❌ Ошибка при запуске сервера:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`   Порт ${PORT} уже занят. Попробуйте использовать другой порт.`);
  }
  process.exit(1);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанное исключение:', err);
  safeLog('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение промиса:', reason);
  safeLog('Unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});

