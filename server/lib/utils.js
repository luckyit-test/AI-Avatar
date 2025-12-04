/**
 * Utility functions for the server.
 */

// In-memory buffer for recent logs
const logBuffer = [];
const MAX_LOG_BUFFER_SIZE = 1000; // Store last 1000 entries

/**
 * Logs messages safely, adding them to an in-memory buffer and to console.
 * Prevents sensitive data from being logged directly.
 * @param {string} message - The log message.
 * @param {object} [details={}] - Additional details to log.
 */
export function safeLog(message, details = {}) {
  const sanitizedData = { ...details };
  if (sanitizedData.apiKey) delete sanitizedData.apiKey;
  if (sanitizedData.imageData) {
    sanitizedData.imageData = sanitizedData.imageData.substring(0, 50) + '...';
  }
  if (sanitizedData.password) {
    sanitizedData.password = '[REDACTED_PASSWORD]';
  }
  if (sanitizedData.rawParams && sanitizedData.rawParams.SignatureValue) {
    sanitizedData.rawParams.SignatureValue = '[REDACTED_SIGNATURE]';
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    data: sanitizedData
  };

  // Add to buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift(); // Remove oldest entry
  }

  console.log(`[${logEntry.timestamp}] ${message}`, sanitizedData);
}

/**
 * Returns the current log buffer.
 * @returns {Array<object>} The array of log entries.
 */
export function getLogBuffer() {
  return [...logBuffer]; // Return a copy to prevent external modification
}

