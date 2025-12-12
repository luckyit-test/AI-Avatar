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
    const expectedToken = process.env.MIGRATION_TOKEN || 'migration-token-2024';
    
    if (!token || token !== expectedToken) {
      console.warn('[Migration API] Unauthorized access attempt');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing migration token'
      });
    }
    
    console.log('[Migration API] Migration started via HTTP endpoint');
    
    // Запускаем миграцию синхронно и ждем результата
    try {
      await migrateTelegramDataUrls();
      console.log('[Migration API] Migration completed successfully');
      res.json({ 
        success: true,
        message: 'Migration completed successfully. Check server logs for details.'
      });
    } catch (migrationError) {
      console.error('[Migration API] Migration failed:', migrationError);
      res.status(500).json({ 
        success: false,
        error: 'Migration failed',
        message: migrationError.message 
      });
    }
    
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

