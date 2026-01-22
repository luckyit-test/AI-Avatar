/**
 * Application constants
 */
export const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'] as const;

// Company sizes instead of types
export const COMPANY_SIZES = [
  'Стартап (до 15 чел)',
  'Небольшая компания (16-100 чел)',
  'Средняя компания (101-250 чел)',
  'Крупный бизнес (251+ чел)',
] as const;

// Keep old constants for backward compatibility (will be removed later)
export const COMPANY_TYPES = [] as const;

export type VariabilityLevel = 'low' | 'medium' | 'high';
