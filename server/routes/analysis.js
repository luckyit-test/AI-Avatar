/**
 * Analysis routes
 */
import express from 'express';
import { Modality } from '@google/genai';
import { API_PREFIX } from '../config/index.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getAnalysisJobStatus } from '../queues/analysisQueue.js';
import { waitForGeminiAnalysisRateLimit } from '../queues/analysisQueue.js';

const router = express.Router();

// Dependencies that need to be injected
let validateImageData, genAIAnalysis, safeLog, addToAnalysisQueueLocal;

export function initializeAnalysisRoutes(dependencies) {
  ({ validateImageData, genAIAnalysis, safeLog, addToAnalysisQueueLocal } = dependencies);
}

// Evaluate image (with rate limiting)
router.post(`${API_PREFIX}/evaluate-image`, rateLimit, async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
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
      return res.status(503).json({ error: errorMessage });
    }
    
    res.status(500).json({ error: 'Ошибка при обработке запроса' });
  }
});

// Get analysis job status
router.get(`${API_PREFIX}/analysis/:jobId`, (req, res) => {
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
          errorMessage = 'Изображение содержит запрещенный контент';
        } else if (postErrorType === 'not_single_person') {
          errorMessage = 'На фото должно быть одно лицо';
        } else if (postErrorType === 'license_violation') {
          errorMessage = 'Изображение нарушает авторские права';
        } else {
          errorMessage = parsed.errorMessage || 'Изображение не прошло валидацию';
        }
      }

      return res.json({
        isValid: postIsValid,
        errorType: postErrorType,
        errorMessage: errorMessage || null,
        gender: parsed.gender || 'unknown',
        confidence: parsed.confidence || 0.5,
        details: {
          hasSinglePerson: d.hasSinglePerson ?? d.isSelfieOnePerson ?? true,
          hasProhibitedContent: d.hasProhibitedContent ?? false,
          hasAnimals: d.hasAnimals ?? false,
          hasLandscape: d.hasLandscape ?? false,
          hasMultiplePeople: d.hasMultiplePeople ?? false,
        }
      });
    }
    
    res.json(status);
  } catch (err) {
    console.error('[analysis-status] Error:', err);
    res.status(500).json({ error: 'Ошибка при получении статуса анализа' });
  }
});

// Validate image (legacy endpoint)
router.post(`${API_PREFIX}/validate-image`, rateLimit, async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Отсутствует обязательный параметр: imageData' });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      return res.status(400).json({ error: imageValidation.error });
    }

    const { mimeType, base64Data } = imageValidation;
    const imagePart = { inlineData: { mimeType, data: base64Data } };

    await waitForGeminiAnalysisRateLimit();
    
    const response = await genAIAnalysis.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [imagePart, { text: 'Analyze image. Return ONLY valid JSON: {"isValid": boolean, "errorType": "none" | "prohibited_content" | "not_single_person" | "license_violation", "errorMessage": "string", "details": {"hasSinglePerson": boolean, "personGender": "male" | "female" | "unknown", "hasProhibitedContent": boolean}}' }] },
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
    
    if (!parsed || typeof parsed.isValid !== 'boolean') {
      throw new Error('Failed to parse validation response');
    }

    res.json(parsed);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    safeLog('Image validation failed', { clientIp, error: errorMessage });
    res.status(500).json({ error: 'Не удалось проверить изображение' });
  }
});

// Detect gender (with rate limiting)
router.post(`${API_PREFIX}/detect-gender`, rateLimit, async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Отсутствует обязательный параметр: imageData' });
    }

    const imageValidation = validateImageData(imageData);
    if (!imageValidation.valid) {
      return res.status(400).json({ error: imageValidation.error });
    }

    const { mimeType, base64Data } = imageValidation;
    const imagePart = { inlineData: { mimeType, data: base64Data } };

    await waitForGeminiAnalysisRateLimit();
    
    const response = await genAIAnalysis.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [imagePart, { text: 'Определи пол человека на фото. Верни ТОЛЬКО JSON: {"gender": "male" | "female" | "unknown", "confidence": число от 0 до 1}' }] },
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
    
    if (!parsed || !parsed.gender) {
      throw new Error('Failed to parse gender detection response');
    }

    res.json({ gender: parsed.gender || 'unknown', confidence: parsed.confidence || 0.5 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    safeLog('Gender detection failed', { clientIp, error: errorMessage });
    res.status(500).json({ error: 'Не удалось определить пол' });
  }
});

export default router;

