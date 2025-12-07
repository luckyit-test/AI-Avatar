/**
 * Generation routes
 */
import express from 'express';
import { API_PREFIX, MAX_QUEUE_SIZE } from '../config/index.js';
import { addToQueue, getJobStatus, generationQueue, activeJobs, completedJobs } from '../queues/generationQueue.js';

const router = express.Router();

// Dependencies that need to be injected
let validateImageData, validatePrompt, replaceBackgroundWithGray, processIntermediateImageAggressively, safeLog, addToQueueLocal;

export function initializeGenerationRoutes(dependencies) {
  ({ validateImageData, validatePrompt, replaceBackgroundWithGray, processIntermediateImageAggressively, safeLog, addToQueueLocal } = dependencies);
}

// Generate image
router.post(`${API_PREFIX}/generate-image`, async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { imageData, prompt } = req.body;
    
    const isIntermediatePrompt = prompt?.includes('Change background to gray') || prompt?.includes('Simple neutral gray background');
    
    safeLog('POST /generate-image received', { 
      clientIp, 
      hasImageData: !!imageData, 
      imageDataLength: imageData?.length || 0,
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      isIntermediatePrompt,
    });
    
    safeLog('STEP 1: After POST log', { clientIp });
    
    // Для промежуточных изображений - обрабатываем программно
    safeLog('STEP 2: CHECKING intermediate prompt', { clientIp, isIntermediatePrompt });
    if (isIntermediatePrompt) {
      try {
        const aggressiveLevel = req.body.aggressiveLevel || 1;
        safeLog('Processing intermediate image with background replacement', { clientIp, aggressiveLevel });
        
        let processedImage;
        if (aggressiveLevel === 1) {
          processedImage = await replaceBackgroundWithGray(imageData);
        } else {
          processedImage = await processIntermediateImageAggressively(imageData, aggressiveLevel);
        }
        
        safeLog('Intermediate image processed successfully', { clientIp });
        return res.json({
          jobId: `intermediate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          position: 0,
          estimatedWaitTime: 0,
          estimatedStartTime: Date.now(),
          queueSize: 0,
          totalInSystem: 0,
          processedImage: processedImage,
          isProcessed: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        safeLog('Intermediate image processing failed', { clientIp, error: errorMessage });
        // НЕ возвращаем ошибку, продолжаем обычным способом
      }
    }
    
    safeLog('AFTER intermediate prompt check', { clientIp, isIntermediatePrompt });

    // Валидация входных данных
    safeLog('BEFORE validation', { clientIp, hasImageData: !!imageData, hasPrompt: !!prompt });
    if (!imageData || !prompt) {
      safeLog('Validation failed: missing parameters', { clientIp });
      return res.status(400).json({ 
        error: 'Отсутствуют обязательные параметры: imageData и prompt' 
      });
    }

    safeLog('BEFORE imageValidation', { clientIp });
    const imageValidation = validateImageData(imageData);
    safeLog('AFTER imageValidation', { clientIp, valid: imageValidation.valid, error: imageValidation.error });
    if (!imageValidation.valid) {
      safeLog('Validation failed: invalid image', { clientIp, error: imageValidation.error });
      return res.status(400).json({ error: imageValidation.error });
    }

    safeLog('BEFORE promptValidation', { clientIp });
    const promptValidation = validatePrompt(prompt);
    safeLog('AFTER promptValidation', { clientIp, valid: promptValidation.valid, error: promptValidation.error });
    if (!promptValidation.valid) {
      safeLog('Validation failed: invalid prompt', { clientIp, error: promptValidation.error });
      return res.status(400).json({ error: promptValidation.error });
    }

    // Добавляем задачу в очередь (используем addToQueueLocal который вызывает processQueue)
    safeLog('BEFORE addToQueueLocal check', { clientIp, hasAddToQueueLocal: !!addToQueueLocal });
    if (!addToQueueLocal) {
      safeLog('ERROR: addToQueueLocal not initialized!', { clientIp });
      return res.status(500).json({ 
        error: 'Ошибка конфигурации сервера. Попробуйте позже.' 
      });
    }
    
    safeLog('CALLING addToQueueLocal', { clientIp, imageDataLength: imageData?.length || 0, promptLength: prompt?.length || 0 });
    const queueResult = addToQueueLocal(imageData, prompt);
    safeLog('AFTER addToQueueLocal', { clientIp, jobId: queueResult?.jobId });
    const estimatedStartTime = Date.now() + queueResult.estimatedWaitTime;
    
    res.json({
      jobId: queueResult.jobId,
      position: queueResult.position,
      estimatedWaitTime: queueResult.estimatedWaitTime,
      estimatedStartTime: estimatedStartTime,
      queueSize: generationQueue.length + activeJobs.size,
      totalInSystem: generationQueue.length + activeJobs.size,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    safeLog('Failed to add job to queue', { clientIp, error: errorMessage });
    
    if (errorMessage.includes('переполнена')) {
      return res.status(503).json({ error: errorMessage });
    }
    
    res.status(500).json({ 
      error: 'Не удалось добавить задачу в очередь. Попробуйте позже.' 
    });
  }
});

// Get generation job status
router.get(`${API_PREFIX}/generate-image/:jobId`, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    safeLog('GET /generate-image/:jobId', { 
      jobId,
      queueSize: generationQueue.length,
      activeJobsCount: activeJobs.size,
      completedJobsCount: completedJobs.size,
      jobInQueue: generationQueue.find(j => j.id === jobId) ? 'yes' : 'no',
      jobInActive: activeJobs.has(jobId) ? 'yes' : 'no',
      jobInCompleted: completedJobs.has(jobId) ? 'yes' : 'no'
    });
    
    const status = getJobStatus(jobId);
    
    if (!status) {
      safeLog('Job not found in getJobStatus', { 
        jobId,
        queueJobIds: generationQueue.map(j => j.id).slice(0, 5),
        activeJobIds: Array.from(activeJobs).slice(0, 5),
        completedJobIds: Array.from(completedJobs.keys()).slice(0, 5)
      });
      return res.status(404).json({ error: 'Задача генерации не найдена' });
    }
    
    safeLog('Job status found', { jobId, status: status.status });
    res.json(status);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    safeLog('Error in GET /generate-image/:jobId', { jobId: req.params.jobId, error: errorMessage });
    res.status(500).json({ error: 'Ошибка при получении статуса задачи' });
  }
});

export default router;
