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

export type ValidationErrorType =
  | 'none'
  | 'prohibited_content'
  | 'not_single_person'
  | 'license_violation'
  | 'public_figure'
  | 'technical_error';
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
  publicFigure?: boolean;
  publicFigureReason?: string | null;
  details?: {
    hasSinglePerson?: boolean;
    hasProhibitedContent?: boolean;
    hasAnimals?: boolean;
    hasLandscape?: boolean;
    hasMultiplePeople?: boolean;
    isPublicFigure?: boolean;
    publicFigureReason?: string | null;
  };
}

export interface AnalysisStatus {
  status: 'queued' | 'processing' | 'completed' | 'error';
  position?: number;
  estimatedWaitTime?: number;
  remainingTime?: number;
  statusMessage?: string;
  isValid?: boolean;
  errorType?: ValidationErrorType;
  errorMessage?: string;
  gender?: DetectedGender;
  confidence?: number;
  publicFigure?: boolean;
  publicFigureReason?: string | null;
  details?: any;
  result?: any;
  error?: string;
}

function normalizeEvaluationErrorMessage(raw: unknown): { errorType: ValidationErrorType; message: string } {
  const errorMessage = raw instanceof Error ? raw.message : String(raw ?? '');

  // Явные сообщения от бэкенда (оставляем как есть, только тип помечаем как технический)
  if (errorMessage.includes('Размер изображения превышает 5MB')) {
    return {
      errorType: 'technical_error',
      message: 'Фото слишком большое. Максимальный размер — 5 МБ. Уменьшите изображение или сделайте скриншот и попробуйте снова.',
    };
  }

  if (errorMessage.includes('Неподдерживаемый формат изображения')) {
    return {
      errorType: 'technical_error',
      message: 'Формат изображения не поддерживается. Загрузите фото в формате JPG, PNG или WEBP.',
    };
  }

  if (errorMessage.includes('Очередь переполнена')) {
    return {
      errorType: 'technical_error',
      message: 'Сервис сейчас перегружен. Подождите минуту и попробуйте ещё раз.',
    };
  }

  // Типичные сетевые/таймаутные ошибки
  const lower = errorMessage.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('abort') ||
    lower.includes('yandex_browser_network_error')
  ) {
    // Специальное сообщение для Яндекс браузера
    if (lower.includes('yandex_browser_network_error')) {
      return {
        errorType: 'technical_error',
        message: 'Проблема с Яндекс браузером. Попробуйте использовать Chrome или обновить Яндекс браузер до последней версии.',
      };
    }
    return {
      errorType: 'technical_error',
      message: 'Не удалось связаться с сервером. Проверьте интернет-соединение или попробуйте ещё раз через пару минут.',
    };
  }

  // Ошибки размера файла
  if (lower.includes('размер изображения превышает') || lower.includes('size') && lower.includes('exceed')) {
    return {
      errorType: 'technical_error',
      message: 'Фото слишком большое. Максимальный размер — 7 МБ. Уменьшите изображение или сделайте скриншот и попробуйте снова.',
    };
  }

  // Fallback — честно говорим, что это не проблема фото, а общая ошибка проверки
  return {
    errorType: 'technical_error',
    message: 'Не удалось проверить изображение из‑за технической ошибки. Попробуйте позже или используйте другое соединение.',
  };
}

/**
 * Оценивает изображение (валидация + определение пола) за один запрос с polling статуса
 */
export async function evaluateImage(imageDataUrl: string, onStatusUpdate?: (status: AnalysisStatus) => void): Promise<ImageEvaluationResult> {
  try {
    // Проверка размера перед отправкой
    const base64Size = (imageDataUrl.length * 3) / 4;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (base64Size > MAX_SIZE) {
      console.error('[evaluateImage] Image too large', { base64Size, maxSize: MAX_SIZE });
      throw new Error('Размер изображения превышает 10MB');
    }

    // Определяем браузер для специальной обработки
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const isYandexBrowser = /YaBrowser|Yandex/i.test(userAgent);
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const isYandexMobile = isMobile && isYandexBrowser;
    const isChrome = /Chrome/i.test(userAgent) && !isYandexBrowser;
    
      console.log('[evaluateImage] Starting evaluation', {
      apiBaseUrl: API_BASE_URL,
      imageDataLength: imageDataUrl?.length || 0,
      estimatedSizeMB: (base64Size / (1024 * 1024)).toFixed(2),
      userAgent,
      browser: isYandexBrowser ? 'Yandex' : (isChrome ? 'Chrome' : 'Other'),
      isMobile,
      isYandexMobile
    });
    
    // Добавляем задачу в очередь с таймаутом для мобильных устройств
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 секунд таймаут
    
    // Проверяем, что используем HTTPS (критично для мобильных браузеров)
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const isHttps = currentUrl.startsWith('https://');
    const isHttp = currentUrl.startsWith('http://');
    
    if (isHttp && !isHttps) {
      console.warn('[evaluateImage] WARNING: Using HTTP instead of HTTPS! This may cause issues on mobile browsers.');
      errorLogger.log('HTTPSWarning', 'Using HTTP instead of HTTPS - may cause request failures', {
        currentUrl,
        apiBaseUrl: API_BASE_URL,
        isMobile,
        isYandexMobile
      });
    }
    
    let response: Response;
    try {
      console.log('[evaluateImage] Sending request to:', `${API_BASE_URL}/evaluate-image`);
      console.log('[evaluateImage] Current page URL:', currentUrl);
      console.log('[evaluateImage] Protocol check:', { isHttps, isHttp, currentUrl });
      
      const requestBody = JSON.stringify({ imageData: imageDataUrl });
      console.log('[evaluateImage] Request body size:', {
        bodyLength: requestBody.length,
        bodySizeMB: (requestBody.length / (1024 * 1024)).toFixed(2),
        browser: isYandexBrowser ? 'Yandex' : (isChrome ? 'Chrome' : 'Other'),
        isMobile,
        isYandexMobile
      });

      // Для Яндекс браузера (особенно мобильного) используем более длинный таймаут и дополнительные заголовки
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      };

      // Для Яндекс браузера (особенно мобильного) добавляем дополнительные опции
      if (isYandexBrowser) {
        // Увеличиваем таймаут для Яндекс браузера (особенно на мобильных)
        clearTimeout(timeoutId);
        const yandexTimeout = setTimeout(() => controller.abort(), isYandexMobile ? 120000 : 90000); // 120 сек для мобильного, 90 для десктопа
        fetchOptions.signal = controller.signal;
        
        console.log('[evaluateImage] Using extended timeout for Yandex browser', {
          isMobile: isYandexMobile,
          timeout: isYandexMobile ? 120000 : 90000
        });
        
        response = await fetch(`${API_BASE_URL}/evaluate-image`, fetchOptions);
        clearTimeout(yandexTimeout);
      } else {
        response = await fetch(`${API_BASE_URL}/evaluate-image`, fetchOptions);
        clearTimeout(timeoutId);
      }
      
      console.log('[evaluateImage] Fetch completed', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        browser: isYandexBrowser ? 'Yandex' : (isChrome ? 'Chrome' : 'Other')
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      const errorDetails = {
        name: fetchError?.name,
        message: fetchError?.message,
        stack: fetchError?.stack,
        cause: fetchError?.cause,
        browser: isYandexBrowser ? 'Yandex' : (isChrome ? 'Chrome' : 'Other'),
        isYandexBrowser,
        isMobile,
        isYandexMobile,
        apiUrl: `${API_BASE_URL}/evaluate-image`,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
        isHttps: typeof window !== 'undefined' ? window.location.href.startsWith('https://') : false,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown'
      };
      
      console.error('[evaluateImage] Fetch error:', errorDetails);
      
      // Логируем ошибку для диагностики
      if (typeof window !== 'undefined') {
        try {
          const { errorLogger } = await import('../lib/errorLogger');
          errorLogger.log('FetchError', fetchError?.message || 'Unknown fetch error', errorDetails);
        } catch (e) {
          // Игнорируем если модуль не доступен
        }
      }
      
      if (fetchError.name === 'AbortError') {
        console.error('[evaluateImage] Request aborted (timeout)');
        throw new Error('timeout');
      }
      
      // Детальная информация о сетевой ошибке
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        console.error('[evaluateImage] Network error - possible causes:', {
          message: fetchError.message,
          apiUrl: `${API_BASE_URL}/evaluate-image`,
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
          browser: isYandexBrowser ? 'Yandex' : (isChrome ? 'Chrome' : 'Other')
        });
        
        // Для Яндекс браузера - специальное сообщение
        if (isYandexBrowser) {
          throw new Error('yandex_browser_network_error');
        }
      }
      
      throw fetchError;
    }

    console.log('[evaluateImage] Response received', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      console.error('[evaluateImage] Response error', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Более детальные сообщения об ошибках
      if (response.status === 413) {
        throw new Error('Размер изображения превышает 10MB');
      } else if (response.status === 400) {
        throw new Error(errorData.error || 'Некорректный запрос');
      } else if (response.status >= 500) {
        throw new Error('timeout');
      }
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const queueResult = await response.json();
    const jobId = queueResult.jobId;
    
    // Polling статуса задачи
    // Используем интервал 1 секунда - достаточно для обновления UI таймера
    const pollInterval = 1000; // Проверяем каждую секунду (вместо 500 мс)
    const maxWaitTime = 30000; // Максимум 30 секунд
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const statusController = new AbortController();
      const statusTimeoutId = setTimeout(() => statusController.abort(), 10000); // 10 секунд для проверки статуса
      
      let statusResponse: Response;
      try {
        statusResponse = await fetch(`${API_BASE_URL}/analysis/${jobId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: statusController.signal,
        });
        clearTimeout(statusTimeoutId);
      } catch (statusError: any) {
        clearTimeout(statusTimeoutId);
        if (statusError.name === 'AbortError') {
          throw new Error('timeout');
        }
        throw statusError;
      }

      if (!statusResponse.ok) {
        if (statusResponse.status === 404) {
          throw new Error('Задача анализа не найдена');
        }
        const errorData = await statusResponse.json().catch(() => ({ error: 'Неизвестная ошибка' }));
        throw new Error(errorData.error || `HTTP ${statusResponse.status}`);
      }

      const status: AnalysisStatus = await statusResponse.json();
      
      // Вызываем callback для обновления UI
      if (onStatusUpdate) {
        onStatusUpdate(status);
      }
      
      if (status.status === 'completed') {
        // Возвращаем результат в формате ImageEvaluationResult
        const publicFigureFlag = status.publicFigure ?? status.details?.isPublicFigure ?? false;
        const publicFigureReason = status.publicFigureReason ?? status.details?.publicFigureReason ?? null;
        const resolvedErrorType: ValidationErrorType = (status.errorType as ValidationErrorType) 
          || (publicFigureFlag ? 'public_figure' : (status.isValid ? 'none' : 'not_single_person'));

        return {
          isValid: status.isValid ?? false,
          errorType: resolvedErrorType,
          errorMessage: status.errorMessage || '',
          gender: status.gender || 'unknown',
          confidence: Math.max(0, Math.min(1, status.confidence || 0)),
          publicFigure: publicFigureFlag,
          publicFigureReason,
          details: status.details || {}
        };
      }
      
      if (status.status === 'error') {
        throw new Error(status.error || 'Ошибка анализа');
      }
      
      // Ждем перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Таймаут ожидания анализа');
  } catch (error) {
    // При технической ошибке (сеть, таймаут, ошибка сервера) возвращаем честное сообщение,
    // которое не обвиняет пользователя в "неправильном" фото.
    const { errorType, message } = normalizeEvaluationErrorMessage(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : typeof error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Детальное логирование для диагностики
    const errorDetails = {
      error: errorMessage,
      errorName,
      mappedMessage: message,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: errorStack,
      apiBaseUrl: API_BASE_URL,
      isMobile: /Mobile|Android|iPhone|iPad/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      isYandex: /YaBrowser|Yandex/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString()
    };
    
    console.error('[evaluateImage] Error caught:', errorDetails);

    // Дополнительная информация для пользователя в консоли
    if (typeof window !== 'undefined') {
      console.error('[evaluateImage] Full error details:', {
        error,
        apiUrl: `${API_BASE_URL}/evaluate-image`,
        timestamp: new Date().toISOString()
      });
      
      // Сохраняем ошибку для диагностики
      // Логируем в консоль - пользователь может скопировать логи через UI
    }

    return {
      isValid: false,
      errorType,
      errorMessage: message,
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
  processedImage?: string; // Для обработанных промежуточных изображений
}

export interface CreatePaymentResponse {
  redirectUrl: string;
  invId: string | number;
}

export interface PaymentStatusResponse {
  paid: boolean;
  error?: string;
}

export interface PromoUseResponse {
  ok: boolean;
  invId?: string | number;
  remainingUses?: number;
  error?: string;
}

export interface AdminAuthResponse {
  ok: boolean;
  error?: string;
}

/**
 * Добавляет задачу генерации в очередь и возвращает jobId
 */
export async function addGenerationToQueue(imageDataUrl: string, prompt: string, aggressiveLevel?: number): Promise<QueueJob> {
  const isIntermediate = prompt.includes('Change background to gray') || prompt.includes('Simple neutral gray background');
  console.log('[addGenerationToQueue] Adding job to queue', {
    isIntermediate,
    aggressiveLevel: aggressiveLevel || 1,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 100),
    imageDataLength: imageDataUrl.length
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        prompt: prompt,
        aggressiveLevel: aggressiveLevel || 1, // Уровень обработки: 1 = обычный, 2+ = агрессивный
      }),
    });
    
    console.log('[addGenerationToQueue] Response received', {
      isIntermediate,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Если это обработанное промежуточное изображение - возвращаем его сразу
    if (result.isProcessed && result.processedImage) {
      console.log('[addGenerationToQueue] Received processed intermediate image directly');
      // Для обработанных изображений создаем "мгновенную" задачу
      return {
        jobId: result.jobId,
        position: 0,
        estimatedWaitTime: 0,
        queueSize: 0,
        processedImage: result.processedImage // Сохраняем обработанное изображение
      };
    }
    
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
 * Создаёт платёж в Robokassa и возвращает URL для редиректа
 */
export async function createPayment(
  imageData: string,
  gender: DetectedGender,
  role: string,
  company: string
): Promise<CreatePaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/payment/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData,
      gender,
      role,
      company,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Не удалось создать платёж');
  }

  return response.json();
}

/**
 * Применяет промокод для бесплатной генерации (обходит оплату Robokassa)
 */
export async function usePromoCode(
  code: string,
  imageData: string,
  gender: DetectedGender,
  role: string,
  company: string
): Promise<PromoUseResponse> {
  const response = await fetch(`${API_BASE_URL}/promo/use`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      imageData,
      gender,
      role,
      company,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: text || 'Ошибка применения промокода' };
  }

  return response.json();
}

// --- Admin auth helpers ---

export async function adminCheckSession(): Promise<AdminAuthResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    return { ok: false };
  }

  return response.json();
}

export async function adminLogin(password: string): Promise<AdminAuthResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, error: text || 'Ошибка входа администратора' };
  }

  return response.json();
}

export async function adminLogout(): Promise<void> {
  await fetch(`${API_BASE_URL}/admin/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}

/**
 * Проверяет статус платежа по invId
 */
export async function checkPaymentStatus(invId: string): Promise<PaymentStatusResponse> {
  const url = new URL(`${API_BASE_URL}/payment/status`);
  url.searchParams.set('invId', invId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return { paid: false, error: 'Ошибка запроса статуса платежа' };
  }

  return response.json();
}

export interface OrderInfo {
  invId: string;
  status: 'created' | 'paid' | 'processing' | 'completed' | 'failed';
  amount: string;
  createdAt: number;
  gender: string | null;
  role: string | null;
  company: string | null;
  hasImageData: boolean;
  generatedImages: Record<string, string> | null;
  failureReason: string | null;
  retries: number;
}

/**
 * Получает информацию о заказе по invId
 */
export async function fetchOrder(invId: string): Promise<OrderInfo> {
  const response = await fetch(`${API_BASE_URL}/order/${invId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
    throw new Error(errorData.error || 'Заказ не найден');
  }

  return response.json();
}

/**
 * Проверяет статус задачи генерации
 */
export async function checkGenerationStatus(jobId: string): Promise<QueueStatus> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Неизвестная ошибка' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const status = await response.json();

      if (status.status === 'error') {
        console.warn('[checkGenerationStatus] Job error:', { 
          jobId, 
          error: status.error,
          errorDetails: status.errorDetails || 'no details',
          finishReason: status.finishReason || status.errorDetails?.finishReason || 'unknown',
          safetyRatings: status.safetyRatings || status.errorDetails?.safetyRatings || 'no ratings'
        });
        
        // Дополнительное логирование для диагностики
        if (status.finishReason || status.errorDetails?.finishReason) {
          console.error('[checkGenerationStatus] Error details:', {
            finishReason: status.finishReason || status.errorDetails?.finishReason,
            safetyRatings: status.safetyRatings || status.errorDetails?.safetyRatings,
            fullErrorDetails: JSON.stringify(status.errorDetails || {}, null, 2)
          });
        }
      }

      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        error instanceof Error &&
        (error.name === 'TypeError' || /failed to fetch/i.test(error.message) || /networkerror/i.test(error.message));

      console.error('[checkGenerationStatus] Fetch error:', { jobId, attempt, error: errorMessage });

      if (isNetworkError && attempt < maxRetries) {
        // Ждём немного и повторяем попытку, чтобы сгладить кратковременные сетевые сбои
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }

      lastError = error instanceof Error ? error : new Error(errorMessage);
      break;
    }
  }

  const finalError = lastError ?? new Error('Неизвестная ошибка');
  throw new Error(`Не удалось проверить статус: ${finalError.message}`);
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
  
  // Если это обработанное промежуточное изображение - возвращаем его сразу
  if ('processedImage' in queueJob && queueJob.processedImage) {
    console.log('[generateImage] Returning processed intermediate image directly');
    if (onStatusUpdate) {
      onStatusUpdate({
        status: 'completed',
        result: { imageDataUrl: queueJob.processedImage }
      });
    }
    return queueJob.processedImage;
  }
  
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
