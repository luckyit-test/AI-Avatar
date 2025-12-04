/**
 * Валидация переменных окружения при запуске
 * Этот модуль проверяет наличие обязательных переменных и выводит предупреждения
 */

export function validateEnvironmentVariables() {
  const errors = [];
  const warnings = [];

  // Обязательные переменные
  if (!process.env.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY не установлен');
  }

  if (!process.env.GEMINI_API_KEY_ANALYSIS) {
    errors.push('GEMINI_API_KEY_ANALYSIS не установлен');
  }

  // Важные переменные (предупреждения)
  if (!process.env.ROBOKASSA_PASSWORD1) {
    warnings.push('ROBOKASSA_PASSWORD1 не установлен - платежи могут не работать');
  }

  if (!process.env.ROBOKASSA_PASSWORD2) {
    warnings.push('ROBOKASSA_PASSWORD2 не установлен - платежи могут не работать');
  }

  // Выводим предупреждения
  if (warnings.length > 0) {
    console.warn('⚠️  Предупреждения переменных окружения:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Выводим ошибки и завершаем работу
  if (errors.length > 0) {
    console.error('❌ Критические ошибки переменных окружения:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nУстановите эти переменные в .env файле или через docker-compose.yml');
    process.exit(1);
  }

  // Выводим информацию о текущих переменных (без значений)
  console.log('✅ Переменные окружения проверены:');
  console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   - GEMINI_API_KEY_ANALYSIS: ${process.env.GEMINI_API_KEY_ANALYSIS ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   - PORT: ${process.env.PORT || '3001 (по умолчанию)'}`);
  console.log(`   - ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || '* (по умолчанию)'}`);
  console.log(`   - ROBOKASSA_LOGIN: ${process.env.ROBOKASSA_LOGIN || 'newava.pro (по умолчанию)'}`);
}

