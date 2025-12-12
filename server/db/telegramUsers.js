/**
 * Telegram users database operations
 */
import { db } from './index.js';

// Create table for tracking free generations
db.exec(`
CREATE TABLE IF NOT EXISTS telegram_free_generations (
  userId INTEGER PRIMARY KEY,
  usedAt INTEGER NOT NULL,
  invId TEXT,
  FOREIGN KEY (invId) REFERENCES orders(invId)
);
`);

const getUserFreeGenerationStmt = db.prepare(`SELECT * FROM telegram_free_generations WHERE userId = ?`);
const insertFreeGenerationStmt = db.prepare(`
INSERT INTO telegram_free_generations (userId, usedAt, invId)
VALUES (@userId, @usedAt, @invId)
ON CONFLICT(userId) DO NOTHING
`);

/**
 * Проверяет, использовал ли пользователь бесплатную генерацию
 */
export function hasUsedFreeGeneration(userId) {
  const row = getUserFreeGenerationStmt.get(userId);
  return !!row;
}

/**
 * Отмечает, что пользователь использовал бесплатную генерацию
 */
export function markFreeGenerationUsed(userId, invId) {
  insertFreeGenerationStmt.run({
    userId,
    usedAt: Date.now(),
    invId: invId || null,
  });
}

/**
 * Получает информацию о бесплатной генерации пользователя
 */
export function getFreeGenerationInfo(userId) {
  const row = getUserFreeGenerationStmt.get(userId);
  if (!row) return null;
  return {
    userId: row.userId,
    usedAt: row.usedAt,
    invId: row.invId,
  };
}

