/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

function resolveApiKey(): string | undefined {
  return (
    (process.env.GEMINI_API_KEY as unknown as string) ||
    (process.env.API_KEY as unknown as string) ||
    // Support optional window-based injection for local dev
    (typeof window !== 'undefined' ? (window as any).GEMINI_API_KEY : undefined) ||
    // Support vite-style env if provided
    ((import.meta as any)?.env?.VITE_GEMINI_API_KEY as string | undefined)
  );
}

let ai: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (ai) return ai;
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      "Отсутствует ключ API. Установите переменную окружения GEMINI_API_KEY."
    );
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

async function callGeminiTextWithRetry(imagePart: object, textPart: object): Promise<GenerateContentResponse> {
    const maxRetries = 5;
    const initialDelayMs = 1000;

    function isRetriableErrorMessage(message: string): boolean {
        const m = message.toLowerCase();
        return (
            m.includes('internal') ||
            m.includes('"code":500') ||
            m.includes('resource_exhausted') ||
            m.includes('rate_limit') ||
            m.includes('quota') ||
            m.includes('429') ||
            m.includes('503') ||
            m.includes('unavailable') ||
            m.includes('timeout') ||
            m.includes('timed out') ||
            m.includes('etimedout') ||
            m.includes('econnreset') ||
            m.includes('network') ||
            m.includes('fetch failed')
        );
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await getClient().models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.TEXT],
                },
            });
        } catch (error) {
            console.error(`Error calling Gemini Text API (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const retriable = isRetriableErrorMessage(errorMessage);
            if (retriable && attempt < maxRetries) {
                const backoff = initialDelayMs * Math.pow(2, attempt - 1);
                const jitter = backoff * (0.5 + Math.random());
                const delay = Math.min(backoff + jitter, 15000);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Gemini Text API call failed after all retries.");
}

export type DetectedGender = 'male' | 'female' | 'unknown';
export interface GenderDetectionResult { gender: DetectedGender; confidence: number }

function stripCodeFences(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
        // remove leading ```json or ```
        const withoutStart = trimmed.replace(/^```[a-zA-Z]*\n?/, '');
        return withoutStart.replace(/```$/, '');
    }
    return trimmed;
}

export async function detectGender(imageDataUrl: string): Promise<GenderDetectionResult> {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        return { gender: 'unknown', confidence: 0 };
    }
    const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    const instruction = {
        text: "You are a precise classifier. Determine the gender presentation of the primary person in the image. Respond in STRICT JSON only, no prose, no code fences: {\n  \"gender\": \"male|female|unknown\",\n  \"confidence\": number between 0 and 1\n}.",
    };

    try {
        const response = await callGeminiTextWithRetry(imagePart, instruction);
        const raw = (response.text || '').toString();
        let parsed: any = null;
        try { parsed = JSON.parse(stripCodeFences(raw)); } catch { /* ignore */ }
        if (parsed && (parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'unknown')) {
            const conf = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
            return { gender: parsed.gender, confidence: conf };
        }
        // Fallback: try to infer from text when JSON parse failed
        const text = raw.trim().toLowerCase();
        if (text.includes('male') || text.includes('муж')) return { gender: 'male', confidence: 0.5 };
        if (text.includes('female') || text.includes('жен')) return { gender: 'female', confidence: 0.5 };
        return { gender: 'unknown', confidence: 0 };
    } catch (e) {
        console.warn('Gender detection failed, defaulting to unknown:', e);
        return { gender: 'unknown', confidence: 0 };
    }
}


// --- Helper Functions ---

/**
 * Creates a fallback prompt to use when the primary one is blocked.
 * @returns The fallback prompt string.
 */
function getFallbackPrompt(): string {
    return `Generate a professional, high-resolution business portrait of the person in this image. The style should be suitable for a corporate setting like a LinkedIn profile. The result should be a clear, photorealistic portrait against a neutral background.`;
}

/**
 * Processes the Gemini API response, extracting the image or throwing an error if none is found.
 * @param response The response from the generateContent call.
 * @returns A data URL string for the generated image.
 */
function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(`Модель ИИ ответила текстом вместо изображения: "${textResponse || 'Текстовый ответ не получен.'}"`);
}

/**
 * A wrapper for the Gemini API call that includes a retry mechanism for internal server errors.
 * @param imagePart The image part of the request payload.
 * @param textPart The text part of the request payload.
 * @returns The GenerateContentResponse from the API.
 */
async function callGeminiWithRetry(imagePart: object, textPart: object): Promise<GenerateContentResponse> {
    const maxRetries = 5;
    const initialDelayMs = 1000;

    function isRetriableErrorMessage(message: string): boolean {
        const m = message.toLowerCase();
        return (
            m.includes('internal') ||
            m.includes('"code":500') ||
            m.includes('resource_exhausted') ||
            m.includes('rate_limit') ||
            m.includes('quota') ||
            m.includes('429') ||
            m.includes('503') ||
            m.includes('unavailable') ||
            m.includes('timeout') ||
            m.includes('timed out') ||
            m.includes('etimedout') ||
            m.includes('econnreset') ||
            m.includes('network') ||
            m.includes('fetch failed')
        );
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await getClient().models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
        } catch (error) {
            console.error(`Error calling Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const retriable = isRetriableErrorMessage(errorMessage);

            if (retriable && attempt < maxRetries) {
                const backoff = initialDelayMs * Math.pow(2, attempt - 1);
                const jitter = backoff * (0.5 + Math.random());
                const delay = Math.min(backoff + jitter, 15000);
                console.log(`Retriable error detected. Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Re-throw if not a retriable error or if max retries are reached.
        }
    }
    // This should be unreachable due to the loop and throw logic above.
    throw new Error("Gemini API call failed after all retries.");
}


/**
 * Generates a styled image from a source image and a prompt.
 * It includes a fallback mechanism for prompts that might be blocked in certain regions.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param prompt The prompt to guide the image generation.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateImage(imageDataUrl: string, prompt: string): Promise<string> {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
  }
  const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    // --- First attempt with the original prompt ---
    try {
        console.log("Attempting generation with original prompt...");
        const textPart = { text: prompt };
        const response = await callGeminiWithRetry(imagePart, textPart);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        const isNoImageError = errorMessage.includes("Модель ИИ ответила текстом вместо изображения");

        if (isNoImageError) {
            console.warn("Original prompt was likely blocked. Trying a fallback prompt.");
            
            // --- Second attempt with the fallback prompt ---
            try {
                const fallbackPrompt = getFallbackPrompt();
                console.log(`Attempting generation with fallback prompt...`);
                const fallbackTextPart = { text: fallbackPrompt };
                const fallbackResponse = await callGeminiWithRetry(imagePart, fallbackTextPart);
                return processGeminiResponse(fallbackResponse);
            } catch (fallbackError) {
                console.error("Fallback prompt also failed.", fallbackError);
                const finalErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                throw new Error(`Модель ИИ не смогла сгенерировать изображение, используя ни оригинальную, ни резервную подсказку. Последняя ошибка: ${finalErrorMessage}`);
            }
        } else {
            // This is for other errors, like a final internal server error after retries.
            console.error("An unrecoverable error occurred during image generation.", error);
            throw new Error(`Модель ИИ не смогла сгенерировать изображение. Детали: ${errorMessage}`);
        }
    }
}