/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Используем серверный прокси для всех запросов к Gemini API
// Это позволяет избежать проблем с географическими ограничениями

const API_BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin + '/api'  // В продакшене проксируется через Nginx
  : 'http://localhost:3001/api';    // Для локальной разработки

export type DetectedGender = 'male' | 'female' | 'unknown';
export interface GenderDetectionResult { gender: DetectedGender; confidence: number }

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

/**
 * Генерирует изображение через серверный прокси
 * Все запросы к Gemini API идут с сервера, а не из браузера пользователя
 */
export async function generateImage(imageDataUrl: string, prompt: string): Promise<string> {
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
    
    if (!result.imageDataUrl) {
      throw new Error('Сервер не вернул изображение');
    }

    return result.imageDataUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Не удалось сгенерировать изображение: ${errorMessage}`);
  }
}
