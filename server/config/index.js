/**
 * Конфигурация сервера
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env.local если существует, иначе .env
dotenv.config({ path: join(__dirname, '../../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });

export const PORT = process.env.PORT || 3001;
export const IMAGE_ROOT_DIR = process.env.IMAGE_ROOT_DIR || '/data/images';
export const DB_PATH = process.env.ORDERS_DB_PATH || '/data/newava_orders.db';

// Настройки очереди генерации
export const GENERATION_INTERVAL = parseInt(process.env.GENERATION_INTERVAL || '3000');
export const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100');
export const MAX_CONCURRENT_GENERATIONS = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '6');

// Настройки rate limiting для Gemini API
export const GEMINI_RPM_LIMIT = parseInt(process.env.GEMINI_RPM_LIMIT || '15');
export const GEMINI_MIN_INTERVAL = Math.ceil(60000 / GEMINI_RPM_LIMIT);
export const GEMINI_ANALYSIS_RPM_LIMIT = parseInt(process.env.GEMINI_ANALYSIS_RPM_LIMIT || '500');
export const GEMINI_ANALYSIS_MIN_INTERVAL = Math.ceil(60000 / GEMINI_ANALYSIS_RPM_LIMIT);
export const GEMINI_WINDOW_SIZE = 60000; // Окно в 1 минуту
export const MAX_REQUESTS_PER_SECOND = 6;
export const SECOND_DELAY_ON_LIMIT = 2000;
export const BATCH_SIZE = 6;
export const USER_BATCH_WINDOW = 200;

// Настройки анализа
export const MAX_CONCURRENT_ANALYSIS = parseInt(process.env.MAX_CONCURRENT_ANALYSIS || '7');
export const AVERAGE_ANALYSIS_TIME = 10000; // 10 секунд на анализ

// Настройки хранения результатов
export const MAX_COMPLETED_JOBS = 100;
export const MAX_HISTORY_SIZE = 50;
export const MAX_PROMPT_SOFTENING_LEVEL = 4;

// API ключи Gemini
export const GEMINI_API_KEY_GENERATION = process.env.GEMINI_API_KEY;
export const GEMINI_API_KEY_ANALYSIS = process.env.GEMINI_API_KEY_ANALYSIS;

// Robokassa config
export const ROBOKASSA_LOGIN = process.env.ROBOKASSA_LOGIN || 'newava.pro';
export const ROBOKASSA_PASSWORD1 = process.env.ROBOKASSA_PASSWORD1;
export const ROBOKASSA_PASSWORD2 = process.env.ROBOKASSA_PASSWORD2;
export const ROBOKASSA_IS_TEST = process.env.ROBOKASSA_IS_TEST === '1' ? 1 : 0;
export const ROBOKASSA_PAYMENT_AMOUNT = parseFloat(process.env.ROBOKASSA_PAYMENT_AMOUNT || '100.00');
export const ROBOKASSA_PAYMENT_DESC =
  process.env.ROBOKASSA_PAYMENT_DESC || 'Генерация бизнес-портретов (1 пакет из 6 изображений)';

// CORS настройки
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

// Rate limiting настройки
export const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут
export const RATE_LIMIT_MAX_REQUESTS = 200;

// API prefix
export const API_PREFIX = '/api';

// Проверка обязательных переменных окружения
if (!GEMINI_API_KEY_GENERATION) {
  console.error('❌ ERROR: GEMINI_API_KEY не установлен в переменных окружения');
  console.error('   Установите переменную GEMINI_API_KEY в .env файле или через docker-compose.yml');
  process.exit(1);
}

if (!GEMINI_API_KEY_ANALYSIS) {
  console.error('❌ ERROR: GEMINI_API_KEY_ANALYSIS не установлен в переменных окружения');
  console.error('   Установите переменную GEMINI_API_KEY_ANALYSIS в .env файле или через docker-compose.yml');
  process.exit(1);
}

// Выводим информацию о загруженных переменных (без значений для безопасности)
console.log('✅ Переменные окружения загружены:');
console.log(`   - GEMINI_API_KEY: ${GEMINI_API_KEY_GENERATION ? '✅ установлен' : '❌ не установлен'}`);
console.log(`   - GEMINI_API_KEY_ANALYSIS: ${GEMINI_API_KEY_ANALYSIS ? '✅ установлен' : '❌ не установлен'}`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ')}`);
console.log(`   - ROBOKASSA_LOGIN: ${ROBOKASSA_LOGIN}`);
console.log(`   - ROBOKASSA_IS_TEST: ${ROBOKASSA_IS_TEST}`);

