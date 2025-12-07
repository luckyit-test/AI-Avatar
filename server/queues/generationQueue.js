/**
 * Generation queue module
 */
import {
  GEMINI_RPM_LIMIT,
  GEMINI_WINDOW_SIZE,
  MAX_REQUESTS_PER_SECOND,
  SECOND_DELAY_ON_LIMIT,
  BATCH_SIZE,
  USER_BATCH_WINDOW,
  MAX_COMPLETED_JOBS,
  MAX_HISTORY_SIZE,
  MAX_PROMPT_SOFTENING_LEVEL,
} from '../config/index.js';

// Очередь генерации
export const generationQueue = [];
export const activeJobs = new Set();
export let currentJobIds = [];

export function removeJobId(jobId) {
  currentJobIds = currentJobIds.filter(id => id !== jobId);
}

export function addJobId(jobId) {
  if (!currentJobIds.includes(jobId)) {
    currentJobIds.push(jobId);
  }
}

// Хранилище результатов завершенных задач
export const completedJobs = new Map();

// Статистика времени генерации
export const generationTimes = [];

// Система отслеживания запросов к Gemini API
export const geminiRequestTimestamps = [];
export const geminiRequestsPerSecond = new Map();
export let lastBatchSendTime = 0;
export const userBatchGroups = new Map();

// Структура задачи в очереди генерации
export class GenerationJob {
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
    this.errorDetails = null;
    this.resolve = null;
    this.reject = null;
  }
  
  getPosition() {
    const index = generationQueue.findIndex(job => job.id === this.id);
    if (index >= 0) return index + 1;
    if (activeJobs.has(this.id)) return 0;
    return -1;
  }
  
  getEstimatedWaitTime() {
    const position = this.getPosition();
    if (position <= 0) return 0;
    
    const now = Date.now();
    const jobsCreatedBefore = generationQueue.filter(j => 
      j.createdAt < this.createdAt || 
      (j.createdAt === this.createdAt && j.id < this.id)
    ).length;
    
    const activeJobsCreatedBefore = activeJobs.size;
    const totalJobsBefore = jobsCreatedBefore + activeJobsCreatedBefore;
    const batchesBeforeThis = Math.floor(totalJobsBefore / BATCH_SIZE);
    
    let timeUntilBatchSend = 0;
    
    if (lastBatchSendTime > 0) {
      const expectedBatchSendTime = lastBatchSendTime + (batchesBeforeThis * SECOND_DELAY_ON_LIMIT);
      const timeUntilExpectedSend = expectedBatchSendTime - now;
      if (timeUntilExpectedSend <= 0) {
        timeUntilBatchSend = 0;
      } else {
        timeUntilBatchSend = timeUntilExpectedSend;
      }
    } else {
      timeUntilBatchSend = batchesBeforeThis * SECOND_DELAY_ON_LIMIT;
    }
    
    cleanupGeminiRequestTimestamps();
    const currentRequestsInWindow = geminiRequestTimestamps.length;
    
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

export function buildFallbackPrompt(originalPrompt, level = 1) {
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
        result += ' Follow all content policies and avoid recreating public figures exactly.';
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

export function calculateAverageGenerationTime() {
  if (generationTimes.length === 0) {
    return 10000;
  }
  const sum = generationTimes.reduce((acc, time) => acc + time, 0);
  return Math.round(sum / generationTimes.length);
}

export function cleanupGeminiRequestTimestamps() {
  const now = Date.now();
  const cutoff = now - GEMINI_WINDOW_SIZE;
  while (geminiRequestTimestamps.length > 0 && geminiRequestTimestamps[0] < cutoff) {
    geminiRequestTimestamps.shift();
  }
}

export function cleanupGeminiRequestsPerSecond() {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 10;
  for (const [timestamp, _] of geminiRequestsPerSecond.entries()) {
    if (timestamp < cutoff) {
      geminiRequestsPerSecond.delete(timestamp);
    }
  }
}

export function addToQueue(imageData, prompt, MAX_QUEUE_SIZE) {
  if (generationQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Очередь переполнена. Попробуйте позже.');
  }
  
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job = new GenerationJob(jobId, imageData, prompt);
  
  generationQueue.push(job);
  
  return { jobId, position: job.getPosition(), estimatedWaitTime: job.getEstimatedWaitTime() };
}

export function getJobStatus(jobId) {
  // Сначала проверяем завершенные задачи (самый быстрый путь)
  const completedJob = completedJobs.get(jobId);
  if (completedJob) {
    if (completedJob.error) {
      return {
        status: 'error',
        error: completedJob.error.message || String(completedJob.error),
      };
    }
    if (completedJob.result) {
      return {
        status: 'completed',
        result: completedJob.result,
      };
    }
  }
  
  // Проверяем активные задачи
  // Если джоб в activeJobs, значит он обрабатывается (даже если объект еще не в completedJobs)
  if (activeJobs.has(jobId)) {
    return {
      status: 'processing',
      position: 0,
      estimatedWaitTime: 0,
    };
  }
  
  // Проверяем очередь
  const queuedJob = generationQueue.find(j => j.id === jobId);
  if (queuedJob) {
    return {
      status: 'queued',
      position: queuedJob.getPosition(),
      estimatedWaitTime: queuedJob.getEstimatedWaitTime(),
    };
  }
  
  return null;
}

export function setLastBatchSendTime(time) {
  lastBatchSendTime = time;
}

