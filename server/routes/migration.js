/**
 * Routes for running migrations
 * Protected by environment variable MIGRATION_TOKEN
 */
import express from 'express';
import { migrateTelegramDataUrls } from '../scripts/migrate-telegram-data-urls.js';

const router = express.Router();

// Защищенный эндпоинт для запуска миграции
router.post('/migrate/telegram-data-urls', async (req, res) => {
  try {
    // Проверяем токен из заголовка или query параметра
    const token = req.headers['x-migration-token'] || req.query.token;
    const expectedToken = process.env.MIGRATION_TOKEN || 'default-migration-token-change-me';
    
    if (!token || token !== expectedToken) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing migration token'
      });
    }
    
    console.log('[Migration API] Migration started via HTTP endpoint');
    
    // Запускаем миграцию асинхронно
    migrateTelegramDataUrls()
      .then((result) => {
        console.log('[Migration API] Migration completed:', result);
      })
      .catch((error) => {
        console.error('[Migration API] Migration failed:', error);
      });
    
    // Возвращаем ответ сразу (миграция выполняется в фоне)
    res.json({ 
      success: true,
      message: 'Migration started. Check server logs for progress.',
      note: 'This is an async operation. Check logs for completion status.'
    });
    
  } catch (error) {
    console.error('[Migration API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to start migration',
      message: error.message 
    });
  }
});

// Эндпоинт для проверки статуса (опционально)
router.get('/migrate/status', (req, res) => {
  res.json({ 
    status: 'Migration endpoint is available',
    note: 'Use POST /api/migrate/telegram-data-urls with X-Migration-Token header'
  });
});

export default router;

