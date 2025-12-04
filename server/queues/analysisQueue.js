/**
 * Analysis queue module
 */
import {
  MAX_CONCURRENT_ANALYSIS,
  AVERAGE_ANALYSIS_TIME,
  GEMINI_ANALYSIS_RPM_LIMIT,
  GEMINI_ANALYSIS_MIN_INTERVAL,
  GEMINI_WINDOW_SIZE,
} from '../config/index.js';

// Очередь анализа изображений
export const analysisQueue = [];
export const activeAnalysisJobs = new Set();
export const completedAnalysisJobs = new Map();
export const geminiAnalysisRequestTimestamps = [];

// Структура задачи в очереди анализа
export class AnalysisJob {
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
    if (activeAnalysisJobs.has(this.id)) return 0;
    return -1;
  }
  
  getEstimatedWaitTime() {
    const position = this.getPosition();
    if (position <= 0) return 0;
    
    const jobsBeforeThis = position - 1;
    const activeCount = activeAnalysisJobs.size;
    const availableSlots = MAX_CONCURRENT_ANALYSIS - activeCount;
    
    if (availableSlots > 0 && jobsBeforeThis < availableSlots) {
      return 0;
    }
    
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

export function cleanupGeminiAnalysisRequestTimestamps() {
  const now = Date.now();
  const cutoff = now - GEMINI_WINDOW_SIZE;
  while (geminiAnalysisRequestTimestamps.length > 0 && geminiAnalysisRequestTimestamps[0] < cutoff) {
    geminiAnalysisRequestTimestamps.shift();
  }
}

export async function waitForGeminiAnalysisRateLimit() {
  cleanupGeminiAnalysisRequestTimestamps();
  const now = Date.now();
  
  if (geminiAnalysisRequestTimestamps.length >= GEMINI_ANALYSIS_RPM_LIMIT) {
    const oldestRequest = geminiAnalysisRequestTimestamps[0];
    const waitTime = GEMINI_WINDOW_SIZE - (now - oldestRequest) + 100;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      cleanupGeminiAnalysisRequestTimestamps();
    }
  }
  
  if (geminiAnalysisRequestTimestamps.length > 0) {
    const lastRequest = geminiAnalysisRequestTimestamps[geminiAnalysisRequestTimestamps.length - 1];
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < GEMINI_ANALYSIS_MIN_INTERVAL) {
      const waitTime = GEMINI_ANALYSIS_MIN_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  geminiAnalysisRequestTimestamps.push(Date.now());
  cleanupGeminiAnalysisRequestTimestamps();
}

export function addToAnalysisQueue(imageData, type) {
  const jobId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job = new AnalysisJob(jobId, imageData, type);
  
  analysisQueue.push(job);
  
  return { jobId, position: job.getPosition(), estimatedWaitTime: job.getEstimatedWaitTime() };
}

export function getAnalysisJobStatus(jobId) {
  const queuedJob = analysisQueue.find(j => j.id === jobId);
  if (queuedJob) {
    return {
      status: 'queued',
      position: queuedJob.getPosition(),
      estimatedWaitTime: queuedJob.getEstimatedWaitTime(),
    };
  }
  
  if (activeAnalysisJobs.has(jobId)) {
    return {
      status: 'processing',
      position: 0,
      estimatedWaitTime: 0,
    };
  }
  
  const completedJob = completedAnalysisJobs.get(jobId);
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
  
  return null;
}

