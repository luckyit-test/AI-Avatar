/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Используем серверный прокси для всех запросов к Gemini API
// Это позволяет избежать проблем с географическими ограничениями

const API_BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin + '/api'  // В продакшене проксируется через Nginx, в dev через Vite proxy
  : 'http://localhost:3001';        // Для SSR (не используется)

export type DetectedGender = 'male' | 'female' | 'unknown';
export interface GenderDetectionResult { gender: DetectedGender; confidence: number }

export type ValidationErrorType = 'none' | 'prohibited_content' | 'not_single_person' | 'license_violation';
export interface ImageValidationResult {
  isValid: boolean;
  errorType: ValidationErrorType;
  errorMessage: string;
  details?: {
    hasSinglePerson?: boolean;
    personGender?: 'male' | 'female' | 'unknown' | 'multiple' | 'none';
    hasProhibitedContent?: boolean;
    prohibitedContentTypes?: string[];
    hasAnimals?: boolean;
    hasLandscape?: boolean;
    hasMultiplePeople?: boolean;
    hasOtherObjects?: boolean;
  };
}

export interface ImageEvaluationResult {
  isValid: boolean;
  errorType: ValidationErrorType;
  errorMessage: string;
  gender: DetectedGender;
  confidence: number;
  details?: {
    hasSinglePerson?: boolean;
    hasProhibitedContent?: boolean;
    hasAnimals?: boolean;
    hasLandscape?: boolean;
    hasMultiplePeople?: boolean;
  };
}

/**
 * Оценивает изображение (валидация + определение пола) за один запрос
 */
export async function evaluateImage(imageDataUrl: string): Promise<ImageEvaluationResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/evaluate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData: imageDataUrl }),
    });

    if (!response.ok) {
      // Пробуем получить JSON с ошибкой
      try {
        const errorData = await response.json();
        // Если сервер вернул структурированную ошибку - используем её
        if (errorData.isValid === false && errorData.errorMessage) {
          return {
            isValid: false,
            errorType: errorData.errorType || 'not_single_person',
            errorMessage: errorData.errorMessage,
            gender: 'unknown',
            confidence: 0,
            details: errorData.details || {}
          };
        }
      } catch {
        // Не удалось распарсить JSON ошибки
      }
      
      // При ошибке HTTP — отклоняем
      console.warn('Ошибка оценки изображения (HTTP):', response.status, response.statusText);
      return {
        isValid: false,
        errorType: 'not_single_person',
        errorMessage: 'Не удалось проверить изображение. Загрузите другое изображение с одним человеком.',
        gender: 'unknown',
        confidence: 0,
        details: {}
      };
    }

    const result = await response.json();
    
    // Проверяем, что результат валидный
    if (result && typeof result.isValid === 'boolean') {
      return {
        isValid: result.isValid,
        errorType: result.errorType || (result.isValid ? 'none' : 'not_single_person'),
        errorMessage: result.errorMessage || '',
        gender: result.gender || 'unknown',
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        details: result.details || {}
      };
    }
    
    // Если структура неожиданная — отклоняем
    console.warn('Неожиданная структура ответа оценки изображения:', result);
    return {
      isValid: false,
      errorType: 'not_single_person',
      errorMessage: 'Не удалось подтвердить, что это фотография одного человека. Загрузите другое изображение.',
      gender: 'unknown',
      confidence: 0,
      details: {}
    };
  } catch (error) {
    // При любой ошибке (сеть, таймаут и т.д.) — отклоняем
    console.warn('Ошибка оценки изображения (catch):', error);
    return {
      isValid: false,
      errorType: 'not_single_person',
      errorMessage: 'Не удалось проверить изображение. Загрузите другое изображение с одним человеком.',
      gender: 'unknown',
      confidence: 0,
      details: {}
    };
  }
}

/**
 * Валидирует изображение на соответствие требованиям (запрещенный контент, один человек и т.д.)
 */
export async function validateImage(imageDataUrl: string): Promise<ImageValidationResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/validate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData: imageDataUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      console.warn('Ошибка валидации изображения:', errorData);
      return {
        isValid: false,
        errorType: 'not_single_person',
        errorMessage: 'Не удалось проверить изображение. Пожалуйста, загрузите изображение с одним человеком в кадре.',
        details: {}
      };
    }

    const result = await response.json();
    return {
      isValid: result.isValid || false,
      errorType: result.errorType || 'not_single_person',
      errorMessage: result.errorMessage || 'Изображение не соответствует требованиям',
      details: result.details || {}
    };
  } catch (error) {
    console.warn('Ошибка валидации изображения:', error);
    return {
      isValid: false,
      errorType: 'not_single_person',
      errorMessage: 'Не удалось проверить изображение. Пожалуйста, загрузите изображение с одним человеком в кадре.',
      details: {}
    };
  }
}

/**
 * Определяет пол человека на изображении через серверный прокси
 */
export async function detectGender(imageDataUrl: string): Promise<GenderDetectionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/detect-gender`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData: imageDataUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      console.warn('Ошибка определения пола:', errorData);
      return { gender: 'unknown', confidence: 0 };
    }

    const result = await response.json();
    return {
      gender: result.gender || 'unknown',
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
    };
  } catch (error) {
    console.warn('Ошибка определения пола:', error);
    return { gender: 'unknown', confidence: 0 };
  }
}

export interface QueueStatus {
  status: 'queued' | 'processing' | 'completed' | 'error';
  position?: number;
  estimatedWaitTime?: number; // Время ожидания в миллисекундах
  estimatedStartTime?: number; // Абсолютное время начала генерации (timestamp)
  createdAt?: number;
  result?: { imageDataUrl: string };
  error?: string;
}

export interface QueueJob {
  jobId: string;
  position: number;
  estimatedWaitTime: number; // Время ожидания в миллисекундах
  estimatedStartTime?: number; // Абсолютное время начала генерации (timestamp)
  queueSize: number;
  totalInSystem?: number; // Общее количество задач в системе (очередь + активные)
}

/**
 * Добавляет задачу генерации в очередь и возвращает jobId
 */
export async function addGenerationToQueue(imageDataUrl: string, prompt: string): Promise<QueueJob> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        prompt: prompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return {
      jobId: result.jobId,
      position: result.position,
      estimatedWaitTime: result.estimatedWaitTime,
      queueSize: result.queueSize,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Не удалось добавить задачу в очередь: ${errorMessage}`);
  }
}

/**
 * Проверяет статус задачи генерации
 */
export async function checkGenerationStatus(jobId: string): Promise<QueueStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-image/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Задача не найдена');
      }
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Не удалось проверить статус: ${errorMessage}`);
  }
}

/**
 * Генерирует изображение через очередь с polling статуса
 */
export async function generateImage(
  imageDataUrl: string, 
  prompt: string,
  onStatusUpdate?: (status: QueueStatus) => void
): Promise<string> {
  // Добавляем задачу в очередь
  const queueJob = await addGenerationToQueue(imageDataUrl, prompt);
  
  // Polling статуса задачи
  const pollInterval = 1000; // Проверяем каждую секунду
  const maxWaitTime = 300000; // Максимум 5 минут
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkGenerationStatus(queueJob.jobId);
    
    // Вызываем callback для обновления UI
    if (onStatusUpdate) {
      onStatusUpdate(status);
    }
    
    if (status.status === 'completed' && status.result) {
      return status.result.imageDataUrl;
    }
    
    if (status.status === 'error') {
      throw new Error(status.error || 'Ошибка генерации');
    }
    
    // Ждем перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Таймаут ожидания генерации');
}
