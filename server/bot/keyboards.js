/**
 * Keyboards for Telegram bot
 */

export const ROLES = [
  'Разработчик',
  'Тимлид',
  'Архитектор',
  'DevOps-инженер',
  'Дата-сайентист',
  'ML-инженер',
  'Продуктовый менеджер',
  'Проектный менеджер',
  'Системный аналитик',
  'Дизайнер UI/UX',
  'QA-инженер',
  'CTO',
];

export const COMPANIES = [
  'Стартап',
  'Продуктовая компания',
  'Enterprise',
  'Аутсорс/консалтинг',
  'Госкомпания',
  'Финтех',
  'Банк',
  'Страховая',
  'Ритейл',
  'Маркетплейс',
  'Медиа',
  'EdTech',
  'HealthTech',
  'Телеком',
  'Производство',
  'Логистика',
  'GameDev',
];

/**
 * Создает клавиатуру для выбора роли
 * Разбивает на строки по 2 кнопки
 */
export function createRoleKeyboard(fileId) {
  const buttons = [];
  for (let i = 0; i < ROLES.length; i += 2) {
    const row = [];
    row.push({ text: ROLES[i], callback_data: `role_${fileId}_${i}` });
    if (i + 1 < ROLES.length) {
      row.push({ text: ROLES[i + 1], callback_data: `role_${fileId}_${i + 1}` });
    }
    buttons.push(row);
  }
  return buttons;
}

/**
 * Создает клавиатуру для выбора компании
 * Разбивает на строки по 2 кнопки
 */
export function createCompanyKeyboard(fileId, roleIndex) {
  const buttons = [];
  for (let i = 0; i < COMPANIES.length; i += 2) {
    const row = [];
    row.push({ text: COMPANIES[i], callback_data: `company_${fileId}_${roleIndex}_${i}` });
    if (i + 1 < COMPANIES.length) {
      row.push({ text: COMPANIES[i + 1], callback_data: `company_${fileId}_${roleIndex}_${i + 1}` });
    }
    buttons.push(row);
  }
  return buttons;
}

/**
 * Получает роль по индексу
 */
export function getRoleByIndex(index) {
  return ROLES[index] || ROLES[0];
}

/**
 * Получает компанию по индексу
 */
export function getCompanyByIndex(index) {
  return COMPANIES[index] || COMPANIES[0];
}

