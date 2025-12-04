/**
 * Prompt utilities for server (JS version)
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function describeRole(role) {
  switch (role) {
    case 'Разработчик':
      return 'focus on a hands-on software engineer; practical, focused, clean look';
    case 'Тимлид':
      return 'team lead presence; approachable leadership, confident yet friendly';
    case 'Архитектор':
      return 'solution architect; strategic, minimalistic aesthetic, systems-thinking vibe';
    case 'DevOps-инженер':
      return 'DevOps engineer; pragmatic, modern tech environment, reliability mindset';
    case 'Дата-сайентист':
      return 'data scientist; analytical, thoughtful expression, subtle academic touch';
    case 'ML-инженер':
      return 'machine learning engineer; innovative, research-meets-engineering tone';
    case 'Продуктовый менеджер':
      return 'product manager; customer-centric, strategic and collaborative presence';
    case 'Проектный менеджер':
      return 'project manager; organized and composed, clarity and control';
    case 'Системный аналитик':
      return 'systems analyst; detail-oriented, structured and precise';
    case 'Дизайнер UI/UX':
      return 'UI/UX designer; creative yet professional, tasteful minimalism';
    case 'QA-инженер':
      return 'QA engineer; meticulous, quality-driven, methodical calmness';
    case 'CTO':
      return 'CTO; executive gravitas, visionary leadership, crisp and premium look';
    default:
      return 'technology professional; credible and modern';
  }
}

export function describeCompany(company) {
  switch (company) {
    case 'Стартап':
      return 'startup context; dynamic, energetic, minimalistic background or open space';
    case 'Продуктовая компания':
      return 'product company; polished yet approachable, modern product-office background';
    case 'Enterprise':
      return 'enterprise context; formal, premium lighting, subtle corporate background';
    case 'Аутсорс/консалтинг':
      return 'consulting; versatile, neutral background with tidy professional styling';
    case 'Госкомпания':
      return 'public sector; conservative and respectful styling, neutral elegant backdrop';
    case 'Финтех':
      return 'fintech; clean, confident, high-contrast corporate aesthetic';
    case 'Банк':
      return 'banking; conservative modern corporate environment, high trust aesthetic';
    case 'Страховая':
      return 'insurance; reassuring, trustworthy, balanced corporate tone';
    case 'Ритейл':
      return 'retail; practical and approachable, lively yet professional vibe';
    case 'Маркетплейс':
      return 'marketplace; dynamic and product-centric, modern office look';
    case 'Медиа':
      return 'media; creative corporate style, light editorial touch';
    case 'EdTech':
      return 'edtech; friendly and modern academic-corporate blend';
    case 'HealthTech':
      return 'healthtech; clean, clinical-inspired but warm and human tone';
    case 'Телеком':
      return 'telecom; high-tech corporate, sleek and structured';
    case 'Производство':
      return 'manufacturing; robust and grounded, clean industrial hints';
    case 'Логистика':
      return 'logistics; efficient, organized, neutral corporate environment';
    case 'GameDev':
      return 'gamedev; creative tech culture, relaxed smart-casual aesthetic';
    default:
      return 'professional context; neutral corporate setting';
  }
}

export function attireByContext(gender, role, company) {
  const baseFemale = 'No facial hair. No beard. No mustache.';
  const baseMale = 'Preserve facial hair exactly as in original. If no facial hair in original, do not add any. Do not remove facial hair if present. Grooming neat and professional.';

  const isFormalCompany = company === 'Enterprise' || company === 'Госкомпания' || company === 'Аутсорс/консалтинг';
  const isModernCompany = company === 'Стартап' || company === 'Продуктовая компания' || company === 'Финтех';

  const roleSmartCasual = 'smart-casual, solid neutral colors, no large logos';
  const roleBusinessCasual = 'business-casual blazer or knit, shirt or blouse, no tie';
  const roleFormal = 'business formal suit or tailored blazer, crisp shirt/blouse';

  const femaleModernPool = [
    'minimal blouse',
    'fine knit sweater',
    'turtleneck knit',
    'cardigan over tee',
    'light overshirt',
    'denim jacket (clean, no distress)',
  ];
  const femaleFormalPool = [
    'tailored blazer over blouse',
    'structured knit jacket',
  ];
  const maleModernPool = [
    'plain tee under lightweight overshirt',
    'oxford shirt, no tie',
    'turtleneck knit',
    'merino crewneck sweater',
    'cardigan over shirt',
  ];
  const maleFormalPool = [
    'tailored blazer, no tie',
    'business suit with open collar',
  ];
  const roleCreative = 'smart-casual with tasteful minimal design accents';

  let attireCore;
  switch (role) {
    case 'Разработчик':
    case 'DevOps-инженер':
    case 'QA-инженер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; t-shirt or plain shirt/hoodie acceptable`;
      break;
    case 'Дизайнер UI/UX':
      attireCore = `${roleCreative}; premium minimal knit or blouse; no loud patterns`;
      break;
    case 'Дата-сайентист':
    case 'ML-инженер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; cardigan or lightweight knit`;
      break;
    case 'Продуктовый менеджер':
    case 'Проектный менеджер':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; knit or blouse; no suit; no tie; no formal blazer`;
      break;
    case 'Архитектор':
      attireCore = isFormalCompany ? `${roleBusinessCasual}; tailored blazer` : `${roleSmartCasual}; minimal knit or overshirt; no suit`;
      break;
    case 'Тимлид':
      attireCore = isFormalCompany ? roleBusinessCasual : `${roleSmartCasual}; clean and approachable; no suit`;
      break;
    case 'CTO':
      attireCore = isFormalCompany ? roleFormal : 'executive smart-casual; tailored blazer, no tie';
      break;
    default:
      attireCore = isFormalCompany ? roleBusinessCasual : roleSmartCasual;
  }

  let companyFlavor = '';
  if (company === 'Финтех') companyFlavor = 'sleek monochrome palette';
  if (company === 'Стартап') companyFlavor = 'fresh, dynamic, contemporary casual';
  if (company === 'Продуктовая компания') companyFlavor = 'approachable and modern';
  if (company === 'Госкомпания') companyFlavor = 'conservative and respectful styling';
  if (company === 'Аутсорс/консалтинг') companyFlavor = 'polished and versatile';

  const noSuitModern = (isModernCompany && role !== 'CTO') ? 'No suit. No tie. No tuxedo. Avoid formal blazer.' : '';
  const femaleNoSuit = (gender === 'female' && isModernCompany && role !== 'CTO') ? 'Avoid suit jacket; prefer blouse/knit.' : '';

  let garment = '';
  if (gender === 'female') {
    garment = isFormalCompany ? randomChoice(femaleFormalPool) : randomChoice(femaleModernPool);
  } else if (gender === 'male') {
    garment = isFormalCompany ? randomChoice(maleFormalPool) : randomChoice(maleModernPool);
  }

  const grooming = gender === 'female' ? baseFemale : baseMale;
  return `${attireCore}. ${companyFlavor}. Specific garment: ${garment}. ${noSuitModern} ${femaleNoSuit} ${grooming}`.trim();
}

