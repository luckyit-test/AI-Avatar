/**
 * Система построения промптов для новогодних фотосессий
 * 
 * Структура:
 * 1. Определение категории из анализа (66 категорий)
 * 2. Базовые шаблоны категорий
 * 3. Модули стилей (12)
 * 4. Модули локаций (20)
 * 5. Система вариаций (действия, позы, эмоции, ракурсы)
 * 6. Функция сборки промптов
 */

/**
 * Утилита для случайного выбора из массива
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Утилита для перемешивания массива
 */
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Утилита для получения уникальных элементов из массива
 */
function getUniqueItems(arr, count) {
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Определяет категорию из результата анализа изображения
 * Возвращает ID категории из 66 возможных
 */
export function determineCategory(analysisResult) {
  const { peopleCount, animalsCount, people, animals } = analysisResult;
  
  // Нормализуем количество (если больше 4, считаем как 4+)
  const normalizedPeopleCount = Math.min(peopleCount, 4);
  const normalizedAnimalsCount = Math.min(animalsCount || 0, 4);
  const totalSubjects = normalizedPeopleCount + normalizedAnimalsCount;
  
  // Если только животные
  if (normalizedPeopleCount === 0 && normalizedAnimalsCount > 0) {
    if (normalizedAnimalsCount === 1) return 'animal-1';
    if (normalizedAnimalsCount === 2) return 'animal-2';
    if (normalizedAnimalsCount === 3) return 'animal-3';
    return 'animal-4plus';
  }
  
  // Если только люди
  if (normalizedAnimalsCount === 0) {
    return determinePeopleCategory(normalizedPeopleCount, people);
  }
  
  // Комбинации людей и животных
  return determineMixedCategory(normalizedPeopleCount, normalizedAnimalsCount, people, animals);
}

/**
 * Определяет категорию для групп людей
 */
function determinePeopleCategory(count, people) {
  if (!people || people.length === 0) {
    // Fallback на базовые категории
    if (count === 1) return 'adult-woman-1';
    if (count === 2) return 'couple-romantic';
    if (count === 3) return 'family-parents-child-girl';
    return 'family-large-4plus';
  }
  
  if (count === 1) {
    const person = people[0];
    const age = person.age || 'adult';
    const gender = person.gender || 'unknown';
    
    if (age === 'child') {
      return gender === 'female' ? 'child-girl-1' : 'child-boy-1';
    } else if (age === 'elderly') {
      return gender === 'female' ? 'elderly-woman-1' : 'elderly-man-1';
    } else {
      return gender === 'female' ? 'adult-woman-1' : 'adult-man-1';
    }
  }
  
  if (count === 2) {
    return determineTwoPeopleCategory(people);
  }
  
  if (count === 3) {
    return determineThreePeopleCategory(people);
  }
  
  // 4+ людей
  return determineFourPlusPeopleCategory(people);
}

/**
 * Определяет категорию для двух людей
 */
function determineTwoPeopleCategory(people) {
  const p1 = people[0];
  const p2 = people[1];
  const age1 = p1.age || 'adult';
  const age2 = p2.age || 'adult';
  const gender1 = p1.gender || 'unknown';
  const gender2 = p2.gender || 'unknown';
  
  // Два ребенка
  if (age1 === 'child' && age2 === 'child') {
    if (gender1 === 'female' && gender2 === 'female') return 'children-2-girls';
    if (gender1 === 'male' && gender2 === 'male') return 'children-2-boys';
    return 'children-boy-girl';
  }
  
  // Ребенок + взрослый
  if ((age1 === 'child' && age2 === 'adult') || (age1 === 'adult' && age2 === 'child')) {
    const child = age1 === 'child' ? p1 : p2;
    const adult = age1 === 'adult' ? p1 : p2;
    const childGender = child.gender || 'unknown';
    const adultGender = adult.gender || 'unknown';
    
    if (childGender === 'female' && adultGender === 'female') return 'parent-child-mom-daughter';
    if (childGender === 'female' && adultGender === 'male') return 'parent-child-dad-daughter';
    if (childGender === 'male' && adultGender === 'female') return 'parent-child-mom-son';
    if (childGender === 'male' && adultGender === 'male') return 'parent-child-dad-son';
  }
  
  // Два взрослых
  if (age1 === 'adult' && age2 === 'adult') {
    if (gender1 === 'female' && gender2 === 'female') return 'adults-2-women';
    if (gender1 === 'male' && gender2 === 'male') return 'adults-2-men';
    // Разные полы - романтическая пара
    return 'couple-romantic';
  }
  
  // Взрослый + пожилой
  if ((age1 === 'adult' && age2 === 'elderly') || (age1 === 'elderly' && age2 === 'adult')) {
    const adult = age1 === 'adult' ? p1 : p2;
    const elderly = age1 === 'elderly' ? p1 : p2;
    const adultGender = adult.gender || 'unknown';
    const elderlyGender = elderly.gender || 'unknown';
    
    if (adultGender === 'female' && elderlyGender === 'female') return 'adult-elderly-woman-grandma';
    if (adultGender === 'female' && elderlyGender === 'male') return 'adult-elderly-woman-grandpa';
    if (adultGender === 'male' && elderlyGender === 'female') return 'adult-elderly-man-grandma';
    if (adultGender === 'male' && elderlyGender === 'male') return 'adult-elderly-man-grandpa';
  }
  
  // Два пожилых
  if (age1 === 'elderly' && age2 === 'elderly') {
    return 'elderly-couple';
  }
  
  // Fallback
  return 'couple-romantic';
}

/**
 * Определяет категорию для трех людей
 */
function determineThreePeopleCategory(people) {
  const ages = people.map(p => p.age || 'adult');
  const genders = people.map(p => p.gender || 'unknown');
  
  // Три ребенка
  if (ages.every(a => a === 'child')) {
    const femaleCount = genders.filter(g => g === 'female').length;
    if (femaleCount === 3) return 'children-3-girls';
    if (femaleCount === 0) return 'children-3-boys';
    if (femaleCount === 2) return 'children-2girls-1boy';
    return 'children-1girl-2boys';
  }
  
  // Семья: родители + ребенок
  const hasChild = ages.some(a => a === 'child');
  const hasAdults = ages.filter(a => a === 'adult').length >= 2;
  
  if (hasChild && hasAdults) {
    const child = people.find(p => (p.age || 'adult') === 'child');
    const childGender = child?.gender || 'unknown';
    return childGender === 'female' ? 'family-parents-child-girl' : 'family-parents-child-boy';
  }
  
  // Бабушка/дедушка + родители
  const hasElderly = ages.some(a => a === 'elderly');
  if (hasElderly && hasAdults) {
    const elderly = people.find(p => (p.age || 'adult') === 'elderly');
    return elderly?.gender === 'female' ? 'family-grandma-parents' : 'family-grandpa-parents';
  }
  
  // Бабушка + дедушка + ребенок
  if (hasElderly && ages.filter(a => a === 'elderly').length === 2 && hasChild) {
    const child = people.find(p => (p.age || 'adult') === 'child');
    const childGender = child?.gender || 'unknown';
    return childGender === 'female' ? 'family-grandparents-child-girl' : 'family-grandparents-child-boy';
  }
  
  // Три взрослых
  if (ages.every(a => a === 'adult')) {
    const femaleCount = genders.filter(g => g === 'female').length;
    if (femaleCount === 3) return 'adults-3-women';
    if (femaleCount === 0) return 'adults-3-men';
    if (femaleCount === 2) return 'adults-2women-1man';
    return 'adults-1woman-2men';
  }
  
  // Fallback
  return 'family-parents-child-girl';
}

/**
 * Определяет категорию для 4+ людей
 */
function determineFourPlusPeopleCategory(people) {
  const ages = people.map(p => p.age || 'adult');
  const genders = people.map(p => p.gender || 'unknown');
  
  // Семья: родители + двое детей
  const childCount = ages.filter(a => a === 'child').length;
  const adultCount = ages.filter(a => a === 'adult').length;
  
  if (childCount === 2 && adultCount === 2) {
    const children = people.filter(p => (p.age || 'adult') === 'child');
    const femaleChildren = children.filter(p => (p.gender || 'unknown') === 'female').length;
    if (femaleChildren === 2) return 'family-parents-2girls';
    if (femaleChildren === 0) return 'family-parents-2boys';
    return 'family-parents-boy-girl';
  }
  
  // Три поколения: бабушка + дедушка + родители
  const elderlyCount = ages.filter(a => a === 'elderly').length;
  if (elderlyCount === 2 && adultCount === 2) {
    return 'family-3generations-4';
  }
  
  // Три поколения: бабушка + дедушка + родители + ребенок
  if (elderlyCount === 2 && adultCount === 2 && childCount === 1) {
    const child = people.find(p => (p.age || 'adult') === 'child');
    const childGender = child?.gender || 'unknown';
    return childGender === 'female' ? 'family-3generations-5-girl' : 'family-3generations-5-boy';
  }
  
  // Бабушка + дедушка + двое детей
  if (elderlyCount === 2 && childCount === 2) {
    const children = people.filter(p => (p.age || 'adult') === 'child');
    const femaleChildren = children.filter(p => (p.gender || 'unknown') === 'female').length;
    if (femaleChildren === 2) return 'family-grandparents-2girls';
    if (femaleChildren === 0) return 'family-grandparents-2boys';
    return 'family-grandparents-boy-girl';
  }
  
  // Большие группы взрослых
  if (ages.every(a => a === 'adult')) {
    const femaleCount = genders.filter(g => g === 'female').length;
    if (femaleCount === 4) return 'adults-4-women';
    if (femaleCount === 0) return 'adults-4-men';
    if (femaleCount === 2) return 'adults-2women-2men';
    if (femaleCount === 3) return 'adults-3women-1man';
    return 'adults-1woman-3men';
  }
  
  // Большие семьи (5+)
  if (people.length >= 5) {
    return 'family-large-5plus';
  }
  
  // Fallback
  return 'family-large-4plus';
}

/**
 * Определяет категорию для комбинаций людей и животных
 */
function determineMixedCategory(peopleCount, animalsCount, people, animals) {
  // Ребенок + животное
  if (peopleCount === 1 && animalsCount === 1) {
    const person = people[0];
    const age = person.age || 'adult';
    const gender = person.gender || 'unknown';
    
    if (age === 'child') {
      return gender === 'female' ? 'child-girl-animal' : 'child-boy-animal';
    }
    return gender === 'female' ? 'adult-woman-animal' : 'adult-man-animal';
  }
  
  // Два человека + животное
  if (peopleCount === 2 && animalsCount === 1) {
    return 'family-2people-animal';
  }
  
  // Один человек + два животных
  if (peopleCount === 1 && animalsCount === 2) {
    const person = people[0];
    const gender = person.gender || 'unknown';
    return gender === 'female' ? 'adult-woman-2animals' : 'adult-man-2animals';
  }
  
  // Два животных
  if (peopleCount === 0 && animalsCount === 2) {
    return 'animals-2';
  }
  
  // Три животных
  if (peopleCount === 0 && animalsCount === 3) {
    return 'animals-3';
  }
  
  // Три человека + животное
  if (peopleCount === 3 && animalsCount === 1) {
    return 'family-3people-animal';
  }
  
  // Два человека + два животных
  if (peopleCount === 2 && animalsCount === 2) {
    return 'family-2people-2animals';
  }
  
  // Один человек + три животных
  if (peopleCount === 1 && animalsCount === 3) {
    return 'adult-person-3animals';
  }
  
  // Четыре животных
  if (peopleCount === 0 && animalsCount >= 4) {
    return 'animals-4plus';
  }
  
  // Fallback
  return 'family-2people-animal';
}

// ============================================================================
// БАЗОВЫЕ ШАБЛОНЫ КАТЕГОРИЙ (66 категорий)
// ============================================================================

/**
 * Базовые шаблоны для каждой категории
 * Каждый шаблон содержит:
 * - Описание участников
 * - Плейсхолдеры для стиля, локации, вариаций
 * - Инструкции по сохранению лиц
 */
const CATEGORY_TEMPLATES = {
  // КАТЕГОРИЯ 1: Один человек/животное
  'child-girl-1': {
    description: 'Маленькая девочка (возраст ~6-10 лет)',
    template: `Маленькая девочка (возраст ~6-10 лет) в новогоднем наряде. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'child-boy-1': {
    description: 'Маленький мальчик (возраст ~6-10 лет)',
    template: `Маленький мальчик (возраст ~6-10 лет) в новогоднем костюме. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-woman-1': {
    description: 'Молодая женщина или девушка',
    template: `Молодая женщина (возраст ~20-40 лет) в новогоднем наряде. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-man-1': {
    description: 'Молодой мужчина или мужчина средних лет',
    template: `Молодой мужчина (возраст ~20-40 лет) в новогоднем наряде. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'elderly-woman-1': {
    description: 'Пожилая женщина (бабушка)',
    template: `Пожилая женщина (бабушка, возраст ~60-75 лет) в новогоднем наряде. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'elderly-man-1': {
    description: 'Пожилой мужчина (дедушка)',
    template: `Пожилой мужчина (дедушка, возраст ~60-75 лет) в новогоднем наряде. 
[FACE_PRESERVATION]
[BODY_PRESERVATION]
[ATTIRE_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'animal-1': {
    description: 'Одно домашнее животное',
    template: `Домашнее животное (собака или кошка) в новогоднем колпаке или наряде. 
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  // КАТЕГОРИЯ 2: Два человека/животных
  'children-2-girls': {
    description: 'Две девочки',
    template: `Две девочки (возраст ~6-10 лет) в новогодних платьях. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'children-2-boys': {
    description: 'Два мальчика',
    template: `Два мальчика (возраст ~6-10 лет) в новогодних костюмах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'children-boy-girl': {
    description: 'Девочка и мальчик (брат и сестра)',
    template: `Брат и сестра (девочка и мальчик, возраст ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'parent-child-mom-daughter': {
    description: 'Мама и дочка',
    template: `Мама (женщина ~30-40 лет) и дочка (девочка ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'parent-child-dad-daughter': {
    description: 'Папа и дочка',
    template: `Папа (мужчина ~30-40 лет) и дочка (девочка ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'parent-child-mom-son': {
    description: 'Мама и сын',
    template: `Мама (женщина ~30-40 лет) и сын (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'parent-child-dad-son': {
    description: 'Папа и сын',
    template: `Папа (мужчина ~30-40 лет) и сын (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-2-women': {
    description: 'Две женщины',
    template: `Две женщины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-2-men': {
    description: 'Два мужчины',
    template: `Два мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'couple-romantic': {
    description: 'Романтическая пара (женщина и мужчина)',
    template: `Романтическая пара: женщина (возраст ~25-35 лет) и мужчина (возраст ~25-35 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-elderly-woman-grandma': {
    description: 'Взрослая женщина и бабушка',
    template: `Дочь (женщина ~30-40 лет) и мама-бабушка (пожилая женщина ~60-75 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-elderly-woman-grandpa': {
    description: 'Взрослая женщина и дедушка',
    template: `Дочь (женщина ~30-40 лет) и дедушка (пожилой мужчина ~60-75 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-elderly-man-grandma': {
    description: 'Взрослый мужчина и бабушка',
    template: `Сын (мужчина ~30-40 лет) и бабушка (пожилая женщина ~60-75 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-elderly-man-grandpa': {
    description: 'Взрослый мужчина и дедушка',
    template: `Сын (мужчина ~30-40 лет) и дедушка (пожилой мужчина ~60-75 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'elderly-couple': {
    description: 'Бабушка и дедушка',
    template: `Бабушка (пожилая женщина ~60-75 лет) и дедушка (пожилой мужчина ~60-75 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'child-girl-animal': {
    description: 'Девочка и домашнее животное',
    template: `Девочка (возраст ~6-10 лет) и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'child-boy-animal': {
    description: 'Мальчик и домашнее животное',
    template: `Мальчик (возраст ~6-10 лет) и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-woman-animal': {
    description: 'Женщина и домашнее животное',
    template: `Женщина (возраст ~25-40 лет) и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-man-animal': {
    description: 'Мужчина и домашнее животное',
    template: `Мужчина (возраст ~25-40 лет) и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'animals-2': {
    description: 'Два домашних животных',
    template: `Два домашних животных (собаки или кошки) в новогодних колпаках или нарядах. 
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  // КАТЕГОРИЯ 3: Три человека/животных
  'children-3-girls': {
    description: 'Три девочки',
    template: `Три девочки (возраст ~6-10 лет) в новогодних платьях. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'children-3-boys': {
    description: 'Три мальчика',
    template: `Три мальчика (возраст ~6-10 лет) в новогодних костюмах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'children-2girls-1boy': {
    description: 'Две девочки и один мальчик',
    template: `Две девочки и один мальчик (возраст ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'children-1girl-2boys': {
    description: 'Одна девочка и два мальчика',
    template: `Одна девочка и два мальчика (возраст ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-parents-child-girl': {
    description: 'Семья: мама, папа и дочка',
    template: `Семья: мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и дочка (девочка ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-parents-child-boy': {
    description: 'Семья: мама, папа и сын',
    template: `Семья: мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и сын (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandma-parents': {
    description: 'Бабушка, мама и папа',
    template: `Бабушка (пожилая женщина ~60-75 лет), мама (женщина ~30-40 лет) и папа (мужчина ~30-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandpa-parents': {
    description: 'Дедушка, мама и папа',
    template: `Дедушка (пожилой мужчина ~60-75 лет), мама (женщина ~30-40 лет) и папа (мужчина ~30-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandparents-child-girl': {
    description: 'Бабушка, дедушка и внучка',
    template: `Бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет) и внучка (девочка ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandparents-child-boy': {
    description: 'Бабушка, дедушка и внук',
    template: `Бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет) и внук (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-3-women': {
    description: 'Три женщины',
    template: `Три женщины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-3-men': {
    description: 'Три мужчины',
    template: `Три мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-2women-1man': {
    description: 'Две женщины и один мужчина',
    template: `Две женщины и один мужчина (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-1woman-2men': {
    description: 'Одна женщина и два мужчины',
    template: `Одна женщина и два мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-2people-animal': {
    description: 'Два человека и одно животное',
    template: `Два человека и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-woman-2animals': {
    description: 'Женщина и два животных',
    template: `Женщина (возраст ~25-40 лет) и два домашних животных (собаки или кошки) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-man-2animals': {
    description: 'Мужчина и два животных',
    template: `Мужчина (возраст ~25-40 лет) и два домашних животных (собаки или кошки) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'animals-3': {
    description: 'Три домашних животных',
    template: `Три домашних животных (собаки или кошки) в новогодних колпаках или нарядах. 
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  // КАТЕГОРИЯ 4+: Четыре и более человек/животных
  'family-parents-2girls': {
    description: 'Семья: мама, папа и две дочки',
    template: `Семья: мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и две дочки (девочки ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-parents-2boys': {
    description: 'Семья: мама, папа и два сына',
    template: `Семья: мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и два сына (мальчики ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-parents-boy-girl': {
    description: 'Семья: мама, папа, дочка и сын',
    template: `Семья: мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет), дочка (девочка ~6-10 лет) и сын (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-3generations-4': {
    description: 'Бабушка, дедушка, мама и папа',
    template: `Три поколения: бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет), мама (женщина ~30-40 лет) и папа (мужчина ~30-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-3generations-5-girl': {
    description: 'Бабушка, дедушка, мама, папа и внучка',
    template: `Три поколения: бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет), мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и внучка (девочка ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-3generations-5-boy': {
    description: 'Бабушка, дедушка, мама, папа и внук',
    template: `Три поколения: бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет), мама (женщина ~30-40 лет), папа (мужчина ~30-40 лет) и внук (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandparents-2girls': {
    description: 'Бабушка, дедушка и две внучки',
    template: `Бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет) и две внучки (девочки ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandparents-2boys': {
    description: 'Бабушка, дедушка и два внука',
    template: `Бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет) и два внука (мальчики ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-grandparents-boy-girl': {
    description: 'Бабушка, дедушка, внучка и внук',
    template: `Бабушка (пожилая женщина ~60-75 лет), дедушка (пожилой мужчина ~60-75 лет), внучка (девочка ~6-10 лет) и внук (мальчик ~6-10 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-4-women': {
    description: 'Четыре женщины',
    template: `Четыре женщины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-4-men': {
    description: 'Четыре мужчины',
    template: `Четыре мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-2women-2men': {
    description: 'Две женщины и два мужчины',
    template: `Две женщины и два мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-3women-1man': {
    description: 'Три женщины и один мужчина',
    template: `Три женщины и один мужчина (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adults-1woman-3men': {
    description: 'Одна женщина и три мужчины',
    template: `Одна женщина и три мужчины (возраст ~20-40 лет) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-3people-animal': {
    description: 'Три человека и одно животное',
    template: `Три человека и домашнее животное (собака или кошка) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[ANIMAL_DESCRIPTION]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-2people-2animals': {
    description: 'Два человека и два животных',
    template: `Два человека и два домашних животных (собаки или кошки) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'adult-person-3animals': {
    description: 'Один человек и три животных',
    template: `Человек (возраст ~25-40 лет) и три домашних животных (собаки или кошки) в новогодних нарядах. 
[FACE_PRESERVATION]
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'animals-4plus': {
    description: 'Четыре и более животных',
    template: `Четыре или более домашних животных (собаки или кошки) в новогодних колпаках или нарядах. 
[ANIMAL_DESCRIPTION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-large-4plus': {
    description: 'Большая семья (4+ человек)',
    template: `Большая семья (4 или более человек разных возрастов) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  },
  
  'family-large-5plus': {
    description: 'Большая семья (5+ человек)',
    template: `Большая семья (5 или более человек разных возрастов) в новогодних нарядах. 
[FACE_PRESERVATION_MULTIPLE]
[STYLE_MODULE]
[LOCATION_MODULE]
[ACTION_VARIATION]
[POSE_VARIATION]
[EMOTION_VARIATION]
[COMPOSITION_VARIATION]
[LIGHTING_VARIATION]
[CAMERA_SPECS]
Фотографическое качество, естественное освещение, профессиональная съемка.`
  }
};

// ============================================================================
// МОДУЛИ СТИЛЕЙ (12 стилей)
// ============================================================================

const STYLE_MODULES = {
  'family': {
    name: 'Семейная новогодняя',
    module: `Теплая семейная атмосфера с традиционными новогодними элементами. 
Семья у елки, открытие подарков, совместное приготовление праздничного стола, улыбки, естественное взаимодействие между членами семьи. 
Новогодние элементы: елка, подарки, праздничный стол, новогодние игрушки, семейные традиции.`
  },
  
  'romantic': {
    name: 'Романтическая новогодняя',
    module: `Романтическая атмосфера для пар в новогоднюю ночь. 
Пара у камина, бокалы шампанского, новогодние огни, нежные позы, интимная обстановка, мягкое освещение. 
Новогодние элементы: новогодние огни, шампанское, камин, романтическая елка, бенгальские огни.`
  },
  
  'party': {
    name: 'Праздничная вечеринка',
    module: `Яркая, веселая атмосфера новогоднего праздника. 
Активные позы, смех, танцы, праздничные аксессуары, яркие новогодние цвета, динамика. 
Новогодние элементы: конфетти, серпантин, новогодние колпаки, хлопушки, праздничная музыка.`
  },
  
  'fairy-tale': {
    name: 'Сказочная новогодняя',
    module: `Волшебная атмосфера новогодней сказки с элементами магии. 
Сказочные декорации, волшебное освещение, элементы фантазии, магия праздника, чудесная атмосфера. 
Новогодние элементы: волшебная елка, снежинки, звезды, сказочные персонажи (Дед Мороз, Снегурочка), магия.`
  },
  
  'elegant': {
    name: 'Элегантная новогодняя',
    module: `Изысканная, стильная новогодняя фотосессия. 
Элегантная новогодняя одежда, классические позы, роскошная обстановка, изысканный декор, утонченность. 
Новогодние элементы: роскошная елка, дорогие украшения, элегантный новогодний стол, шампанское, свечи.`
  },
  
  'playful': {
    name: 'Игривая новогодняя',
    module: `Веселая, динамичная новогодняя фотосессия с играми и развлечениями. 
Активные движения, смешные позы, игры, развлечения, детский восторг, веселье. 
Новогодние элементы: новогодние игрушки, игры с подарками, снежки, катание на санках, веселье.`
  },
  
  'cozy': {
    name: 'Уютная домашняя новогодняя',
    module: `Домашняя, комфортная новогодняя атмосфера. 
Домашняя новогодняя одежда, расслабленные позы, теплая обстановка, домашний уют, комфорт. 
Новогодние элементы: домашняя елка, теплые пледы, горячий чай/какао, домашние украшения, уют.`
  },
  
  'winter-tale': {
    name: 'Зимняя сказка на улице',
    module: `Морозная, снежная атмосфера зимней новогодней сказки на улице. 
Зимняя одежда, снег, лед, морозные узоры, зимние развлечения, свежий воздух. 
Новогодние элементы: снег, ледяные фигуры, новогодние огни на улице, снежинки, зимние забавы.`
  },
  
  'glamorous': {
    name: 'Гламурная новогодняя',
    module: `Роскошная, шикарная новогодняя фотосессия. 
Дорогая новогодняя одежда, роскошные декорации, профессиональный макияж, шик, изысканность. 
Новогодние элементы: роскошная елка, дорогие украшения, элегантный декор, шампанское, роскошь.`
  },
  
  'retro': {
    name: 'Ретро новогодняя',
    module: `Стилизация под новогодние праздники прошлых эпох (50-80е годы). 
Винтажная новогодняя одежда, ретро-декорации, старинная новогодняя атмосфера, ностальгия. 
Новогодние элементы: винтажные игрушки, старинные украшения, ретро-елка, традиции прошлого.`
  },
  
  'midnight': {
    name: 'Новогодняя ночь (полночь)',
    module: `Торжественная атмосфера встречи Нового года в полночь. 
Бой курантов, фейерверки, шампанское, поздравления, торжественность, праздничное настроение. 
Новогодние элементы: часы, фейерверки, шампанское, поздравления, новогодний салют.`
  },
  
  'children': {
    name: 'Детская новогодняя',
    module: `Волшебная новогодняя атмосфера для детей. 
Детский восторг, игры, подарки, сказочные персонажи, радость, магия для детей. 
Новогодние элементы: детская елка, подарки от Деда Мороза, детские игрушки, сказочные персонажи, магия для детей.`
  }
};

// ============================================================================
// МОДУЛИ ЛОКАЦИЙ (20 локаций)
// ============================================================================

const LOCATION_MODULES = {
  'living-room': {
    name: 'Домашняя гостиная с елкой',
    module: `Уютная гостиная в квартире или доме с новогодней елкой. 
Новогодние элементы: елка, подарки под елкой, праздничный стол, камин, новогодние украшения, гирлянды. 
Атмосфера: домашний уют, семейная атмосфера, тепло.`
  },
  
  'winter-house': {
    name: 'Зимний загородный домик',
    module: `Уютный деревянный домик в зимнем лесу с новогодним декором. 
Новогодние элементы: елка, камин, деревянные стены, снег за окном, новогодние огни, уют. 
Атмосфера: сказочная, уютная, романтическая.`
  },
  
  'city-street': {
    name: 'Городская улица в новогоднем убранстве',
    module: `Городская улица, украшенная новогодними огнями и декорациями. 
Новогодние элементы: новогодние огни, снег, праздничные украшения, витрины магазинов, новогодняя атмосфера. 
Атмосфера: праздничная, динамичная, городская.`
  },
  
  'city-square': {
    name: 'Новогодняя площадь с елкой',
    module: `Главная площадь города с большой новогодней елкой. 
Новогодние элементы: огромная елка, новогодние огни, праздничные декорации, каток, новогодние ярмарки. 
Атмосфера: торжественная, праздничная, массовая.`
  },
  
  'outdoor-rink': {
    name: 'Каток под открытым небом',
    module: `Каток на улице с новогодним декором и освещением. 
Новогодние элементы: лед, новогодние огни вокруг катка, елка рядом, снег, зимняя атмосфера. 
Атмосфера: активная, веселая, зимняя.`
  },
  
  'winter-forest': {
    name: 'Зимний лес с елкой',
    module: `Зимняя поляна в лесу с новогодней елкой. 
Новогодние элементы: елка в лесу, снег, деревья, природная красота, уединение, сказка. 
Атмосфера: сказочная, романтическая, природная.`
  },
  
  'luxury-hall': {
    name: 'Роскошный зал/дворец',
    module: `Роскошный зал или дворец с новогодним декором. 
Новогодние элементы: огромная роскошная елка, дорогие украшения, элегантный декор, роскошь. 
Атмосфера: элегантная, торжественная, роскошная.`
  },
  
  'cafe-restaurant': {
    name: 'Новогоднее кафе/ресторан',
    module: `Уютное кафе или ресторан с новогодним убранством. 
Новогодние элементы: новогодний декор, праздничный стол, новогоднее меню, елка, уютная атмосфера. 
Атмосфера: уютная, романтическая, праздничная.`
  },
  
  'theater': {
    name: 'Новогодний театр/концертный зал',
    module: `Театральный зал или концертная площадка с новогодним декором. 
Новогодние элементы: новогоднее представление, елка на сцене, праздничный декор, торжественность. 
Атмосфера: торжественная, элегантная, праздничная.`
  },
  
  'ski-resort': {
    name: 'Горнолыжный курорт',
    module: `Горнолыжный курорт с новогодней атмосферой. 
Новогодние элементы: елка на курорте, новогодние огни, снег, горы, праздничная атмосфера курорта. 
Атмосфера: активная, праздничная, курортная.`
  },
  
  'park': {
    name: 'Новогодний парк/сквер',
    module: `Городской парк или сквер с новогодними украшениями. 
Новогодние элементы: новогодние огни на деревьях, елка в парке, снег, праздничная атмосфера. 
Атмосфера: праздничная, игривая, семейная.`
  },
  
  'village-house': {
    name: 'Деревенский дом с русской печью',
    module: `Традиционный деревенский дом с новогодним убранством. 
Новогодние элементы: елка, русская печь, деревянная мебель, традиционный новогодний декор, уют. 
Атмосфера: традиционная, уютная, семейная.`
  },
  
  'photo-studio': {
    name: 'Новогодняя фотостудия',
    module: `Профессиональная фотостудия с новогодним декором. 
Новогодние элементы: новогодние декорации, елка, контролируемое освещение, новогодний фон. 
Атмосфера: профессиональная, контролируемая, праздничная.`
  },
  
  'luxury-hotel': {
    name: 'Роскошный отель',
    module: `Роскошный отель с новогодним декором. 
Новогодние элементы: роскошная елка в холле, элегантный декор, новогодние огни, роскошь. 
Атмосфера: элегантная, роскошная, торжественная.`
  },
  
  'balcony-terrace': {
    name: 'Новогодний балкон/терраса',
    module: `Балкон или терраса с видом на новогодний город. 
Новогодние элементы: новогодние огни города, елка на балконе, новогодние украшения, вид на праздник. 
Атмосфера: романтическая, уютная, городская.`
  },
  
  'library': {
    name: 'Новогодняя библиотека',
    module: `Старинная библиотека с новогодним декором. 
Новогодние элементы: елка между книжными полками, камин, новогодние украшения, интеллектуальная атмосфера. 
Атмосфера: уютная, элегантная, интеллектуальная.`
  },
  
  'loft': {
    name: 'Новогодний лофт',
    module: `Современный лофт с новогодним декором. 
Новогодние элементы: современная елка, новогодние огни, современный дизайн, стиль. 
Атмосфера: современная, стильная, праздничная.`
  },
  
  'greenhouse': {
    name: 'Новогодний сад/оранжерея',
    module: `Зимний сад или оранжерея с новогодним декором. 
Новогодние элементы: елка среди растений, новогодние огни, стеклянные стены, необычная атмосфера. 
Атмосфера: необычная, романтическая, сказочная.`
  },
  
  'cottage': {
    name: 'Новогодний коттедж',
    module: `Современный загородный коттедж с новогодним декором. 
Новогодние элементы: елка, большие окна с видом на снег, современный новогодний декор, уют. 
Атмосфера: современная, уютная, семейная.`
  },
  
  'workshop': {
    name: 'Новогодняя мастерская/ателье',
    module: `Мастерская или ателье с новогодним декором. 
Новогодние элементы: елка в мастерской, новогодние украшения ручной работы, творческая атмосфера. 
Атмосфера: творческая, уютная, необычная.`
  }
};

// ============================================================================
// СИСТЕМА ВАРИАЦИЙ (действия, позы, эмоции, ракурсы, освещение)
// ============================================================================

/**
 * Вариации действий для новогодних фотосессий
 */
const ACTION_VARIATIONS = {
  // Действия для одного человека
  single: [
    'открывает подарки у елки',
    'украшает елку новогодними игрушками',
    'готовит праздничный стол',
    'смотрит на новогодние огни',
    'читает новогоднюю книгу у камина',
    'пьет горячий чай/какао',
    'танцует под новогоднюю музыку',
    'смотрит в окно на снег',
    'держит в руках новогодние игрушки',
    'стоит у елки с улыбкой',
    'сидит у камина с подарками',
    'готовит новогодние угощения',
    'смотрит на фейерверки',
    'держит бокал шампанского',
    'играет с новогодними игрушками',
    'стоит на балконе с видом на город',
    'украшает дом новогодними гирляндами',
    'готовит новогодние подарки',
    'смотрит на новогоднюю елку с восторгом',
    'стоит в новогоднем наряде'
  ],
  
  // Действия для двух людей
  couple: [
    'открывают подарки вместе у елки',
    'украшают елку вместе',
    'готовят праздничный стол вместе',
    'танцуют под новогоднюю музыку',
    'сидят у камина с бокалами шампанского',
    'обнимаются у елки',
    'играют в новогодние игры',
    'готовят новогодний ужин вместе',
    'смотрят на фейерверки вместе',
    'поздравляют друг друга',
    'стоят в обнимку у елки',
    'сидят на диване с подарками',
    'готовят новогодние подарки вместе',
    'танцуют в новогодних нарядах',
    'смотрят новогодний фильм вместе',
    'играют в снежки на улице',
    'катаются на коньках вместе',
    'стоят на балконе с видом на город',
    'готовят новогодние угощения вместе',
    'обнимаются под новогодними огнями'
  ],
  
  // Действия для семьи (3+ человек)
  family: [
    'открывают подарки всей семьей у елки',
    'украшают елку всей семьей',
    'готовят праздничный стол всей семьей',
    'играют в новогодние игры всей семьей',
    'танцуют под новогоднюю музыку',
    'сидят у камина всей семьей',
    'готовят новогодний ужин вместе',
    'смотрят на фейерверки всей семьей',
    'поздравляют друг друга',
    'стоят у елки всей семьей',
    'играют в снежки на улице',
    'катаются на коньках вместе',
    'готовят новогодние подарки вместе',
    'смотрят новогодний фильм вместе',
    'готовят новогодние угощения вместе',
    'стоят на балконе с видом на город',
    'играют в новогодние игры всей семьей',
    'танцуют в новогодних нарядах',
    'обнимаются всей семьей у елки',
    'готовят новогодние подарки вместе'
  ],
  
  // Действия с животными
  withAnimals: [
    'играют с питомцем у елки',
    'держат питомца в новогоднем колпаке',
    'играют с питомцем новогодними игрушками',
    'стоят с питомцем у елки',
    'сидят с питомцем у камина',
    'готовят подарки для питомца',
    'играют с питомцем в снежки',
    'стоят с питомцем на балконе',
    'играют с питомцем новогодними игрушками',
    'держат питомца в новогоднем наряде'
  ]
};

/**
 * Вариации поз для новогодних фотосессий
 */
const POSE_VARIATIONS = {
  // Позы для одного человека
  single: [
    'стоит у елки, смотря на камеру',
    'сидит у камина, держа подарки',
    'стоит на балконе, смотря на город',
    'сидит на диване с новогодними игрушками',
    'стоит у окна, смотря на снег',
    'сидит у елки, держа подарки',
    'стоит в центре комнаты с улыбкой',
    'сидит на полу у елки',
    'стоит у камина с бокалом шампанского',
    'сидит за столом с новогодними угощениями',
    'стоит у елки, держа новогодние игрушки',
    'сидит на ковре у елки',
    'стоит на балконе с видом на город',
    'сидит у камина с книгой',
    'стоит у елки с подарками'
  ],
  
  // Позы для двух людей
  couple: [
    'стоят в обнимку у елки',
    'сидят у камина, обнимаясь',
    'стоят на балконе, обнимаясь',
    'сидят на диване, обнимаясь',
    'стоят у елки, держась за руки',
    'сидят у камина с бокалами шампанского',
    'стоят в обнимку на балконе',
    'сидят на полу у елки, обнимаясь',
    'стоят у елки, целуясь',
    'сидят у камина, держась за руки',
    'стоят на балконе, держась за руки',
    'сидят на диване с подарками',
    'стоят у елки, обнимаясь',
    'сидят у камина, обнимаясь',
    'стоят в обнимку у елки'
  ],
  
  // Позы для семьи (3+ человек)
  family: [
    'стоят у елки всей семьей',
    'сидят у камина всей семьей',
    'стоят на балконе всей семьей',
    'сидят на диване всей семьей',
    'стоят у елки, обнимаясь',
    'сидят у камина, обнимаясь',
    'стоят на балконе, обнимаясь',
    'сидят на полу у елки всей семьей',
    'стоят у елки, держась за руки',
    'сидят у камина, держась за руки',
    'стоят на балконе, держась за руки',
    'сидят на диване с подарками',
    'стоят у елки всей семьей',
    'сидят у камина всей семьей',
    'стоят в обнимку у елки всей семьей'
  ]
};

/**
 * Вариации эмоций для новогодних фотосессий
 */
const EMOTION_VARIATIONS = [
  'радостная улыбка',
  'детский восторг',
  'нежное выражение',
  'веселье и смех',
  'счастливое выражение лица',
  'теплая улыбка',
  'восторженное выражение',
  'нежная улыбка',
  'радостное выражение',
  'счастливая улыбка',
  'детская радость',
  'нежное выражение лица',
  'веселое выражение',
  'радостное лицо',
  'счастливое лицо'
];

/**
 * Вариации композиции для новогодних фотосессий
 */
const COMPOSITION_VARIATIONS = {
  vertical: [
    'вертикальная композиция, фокус на человеке',
    'вертикальная композиция, человек в центре',
    'вертикальная композиция, портретная ориентация',
    'вертикальная композиция, фокус на лице',
    'вертикальная композиция, человек на переднем плане'
  ],
  
  horizontal: [
    'горизонтальная композиция, группа в ряд',
    'горизонтальная композиция, широкий план',
    'горизонтальная композиция, все в кадре',
    'горизонтальная композиция, общий план',
    'горизонтальная композиция, группа в центре'
  ]
};

/**
 * Вариации освещения для новогодних фотосессий
 */
const LIGHTING_VARIATIONS = [
  'естественное освещение от елки и камина',
  'теплое освещение от новогодних огней',
  'мягкое освещение от гирлянд',
  'романтическое освещение от свечей',
  'яркое освещение от новогодних огней',
  'мягкое естественное освещение',
  'теплое освещение от камина',
  'волшебное освещение от елки',
  'романтическое освещение от огней',
  'естественное освещение от окна',
  'теплое освещение от новогодних огней',
  'мягкое освещение от гирлянд',
  'яркое освещение от елки',
  'романтическое освещение от свечей',
  'естественное освещение от камина'
];

/**
 * Технические характеристики камер для новогодних фотосессий
 */
const CAMERA_SPECS = [
  'Canon EOS R5',
  'Sony A7R IV',
  'Nikon Z9'
];

/**
 * Вариации объективов для новогодних фотосессий
 */
const LENS_VARIATIONS = {
  portrait: [
    '85mm f/1.8',
    '85mm f/1.4',
    '85mm f/2.0'
  ],
  general: [
    '50mm f/1.4',
    '50mm f/1.8',
    '50mm f/2.0'
  ]
};

/**
 * Вариации ISO для новогодних фотосессий
 */
const ISO_VARIATIONS = [
  'ISO 100',
  'ISO 200',
  'ISO 400'
];

/**
 * Генерирует технические характеристики камеры
 */
function generateCameraSpecs(orientation, variationIndex) {
  const camera = randomChoice(CAMERA_SPECS);
  
  // Выбираем объектив в зависимости от ориентации и композиции
  const isPortrait = orientation === 'vertical';
  const lensPool = isPortrait ? LENS_VARIATIONS.portrait : LENS_VARIATIONS.general;
  const lens = getUniqueItems(lensPool, 6)[variationIndex % lensPool.length];
  
  // Выбираем ISO
  const iso = getUniqueItems(ISO_VARIATIONS, 6)[variationIndex % ISO_VARIATIONS.length];
  
  // Определяем диафрагму в зависимости от объектива
  const aperture = lens.includes('f/1.4') ? 'f/1.4' : lens.includes('f/1.8') ? 'f/1.8' : 'f/2.0';
  
  return {
    camera,
    lens,
    iso,
    aperture,
    specs: `${camera}, объектив ${lens}, ${iso}, диафрагма ${aperture}, профессиональная фотография высокого качества`
  };
}

/**
 * Генерирует инструкцию по сохранению лиц из исходного фото
 */
function generateFacePreservation(analysisResult, isMultiple = false) {
  const { people } = analysisResult;
  
  // Базовая инструкция по сохранению бороды и усов для всех мужчин
  const facialHairInstruction = `КРИТИЧЕСКИ ВАЖНО: Сохранить усы и бороду в ТОЧНОМ исходном состоянии. 
Если в исходном фото у человека есть борода - сохранить её ТОЧНО такой же (длина, густота, форма, стиль). 
Если в исходном фото у человека есть усы - сохранить их ТОЧНО такими же (длина, форма, стиль). 
Если в исходном фото человек без бороды и усов - НЕ добавлять бороду и усы. 
Если в исходном фото человек с бородой - НЕ удалять бороду. 
Если в исходном фото человек с усами - НЕ удалять усы. 
Усы и борода должны выглядеть ИДЕНТИЧНО исходному фото во всех деталях.`;
  
  if (!people || people.length === 0) {
    return `Сохранить точные черты лица, форму лица, цвет глаз, прическу, все уникальные особенности из исходного фото. ${facialHairInstruction}`;
  }
  
  if (isMultiple && people.length > 1) {
    const hasMen = people.some(p => p.gender === 'male');
    const facialHairText = hasMen ? ` ${facialHairInstruction}` : '';
    return `Сохранить точные черты лиц всех ${people.length} человек из исходного фото: форму лиц, цвет глаз, прически, все уникальные особенности каждого человека. Каждый человек должен быть узнаваем как в исходном фото.${facialHairText}`;
  }
  
  const person = people[0];
  const gender = person.gender === 'male' ? 'мужчина' : person.gender === 'female' ? 'женщина' : 'человек';
  const facialHairText = person.gender === 'male' ? ` ${facialHairInstruction}` : '';
  
  return `Сохранить точные черты лица ${gender} из исходного фото: форму лица, цвет глаз, прическу, все уникальные особенности. Человек должен быть узнаваем как в исходном фото.${facialHairText}`;
}

/**
 * Генерирует инструкцию по сохранению роста и телосложения из исходного фото
 */
function generateBodyPreservation(analysisResult, isMultiple = false) {
  const { people } = analysisResult;
  
  const bodyPreservationBase = `КРИТИЧЕСКИ ВАЖНО: Сохранить рост и телосложение в ТОЧНОМ исходном состоянии. 
Рост должен быть ИДЕНТИЧЕН исходному фото (низкий, средний, высокий - как в оригинале). 
Телосложение должно быть ИДЕНТИЧНО исходному фото (худощавое, среднее, полное, спортивное - как в оригинале). 
Пропорции тела должны соответствовать исходному фото. 
НЕ изменять рост, НЕ изменять телосложение, НЕ изменять пропорции тела. 
Все параметры тела должны быть ТОЧНО такими же, как в исходном фото.`;
  
  if (!people || people.length === 0) {
    return bodyPreservationBase;
  }
  
  if (isMultiple && people.length > 1) {
    return `КРИТИЧЕСКИ ВАЖНО: Сохранить рост и телосложение всех ${people.length} человек в ТОЧНОМ исходном состоянии. 
Рост каждого человека должен быть ИДЕНТИЧЕН исходному фото. 
Телосложение каждого человека должно быть ИДЕНТИЧНО исходному фото. 
Пропорции тела каждого человека должны соответствовать исходному фото. 
НЕ изменять рост, НЕ изменять телосложение, НЕ изменять пропорции тела ни у одного человека. 
Все параметры тела должны быть ТОЧНО такими же, как в исходном фото.`;
  }
  
  return bodyPreservationBase;
}

/**
 * Новогодняя одежда для разных стилей и категорий
 */
const NEW_YEAR_ATTIRE = {
  // Одежда для детей
  child: {
    girl: {
      'family': [
        'новогоднее платье с елочками и снежинками, красного или зеленого цвета',
        'нарядное платье с новогодними узорами, украшенное блестками',
        'красивое платье в новогодней тематике с бантами и лентами',
        'праздничное платье с новогодними мотивами, теплые колготки',
        'нарядное платье с новогодними украшениями, праздничные туфли'
      ],
      'romantic': [
        'элегантное новогоднее платье пастельных тонов',
        'нежное платье с новогодними акцентами',
        'романтическое платье с новогодними элементами'
      ],
      'party': [
        'яркое новогоднее платье с блестками и конфетти',
        'праздничное платье с новогодними колпаками',
        'веселое платье с новогодними узорами'
      ],
      'fairy-tale': [
        'сказочное платье как у Снегурочки, белое или голубое',
        'волшебное платье с новогодними звездами',
        'сказочное платье с новогодними элементами'
      ],
      'elegant': [
        'элегантное новогоднее платье классического покроя',
        'нарядное платье с изысканными новогодними деталями',
        'роскошное платье для новогоднего праздника'
      ],
      'playful': [
        'веселое платье с новогодними игрушками',
        'игривое платье с новогодними узорами',
        'детское платье с новогодними элементами'
      ],
      'cozy': [
        'уютное платье с новогодними мотивами, теплые носки',
        'домашнее платье с новогодними узорами',
        'комфортное платье для новогоднего вечера'
      ],
      'winter-tale': [
        'теплое зимнее платье с новогодними элементами, варежки',
        'зимнее платье с новогодними узорами, теплая обувь',
        'утепленное платье для зимней новогодней фотосессии'
      ],
      'glamorous': [
        'гламурное платье с новогодними блестками',
        'роскошное платье для новогоднего праздника',
        'шикарное платье с новогодними украшениями'
      ],
      'retro': [
        'винтажное платье в новогоднем стиле 50-80х годов',
        'ретро платье с новогодними мотивами',
        'старинное платье для новогоднего праздника'
      ],
      'midnight': [
        'элегантное платье для встречи Нового года',
        'нарядное платье для новогодней ночи',
        'праздничное платье для полночи'
      ],
      'children': [
        'детское платье с новогодними игрушками',
        'веселое платье для детского новогоднего праздника',
        'сказочное платье для детей'
      ]
    },
    boy: {
      'family': [
        'новогодний костюм с елочками и снежинками, красного или зеленого цвета',
        'нарядный костюм с новогодними узорами, праздничная рубашка',
        'красивый костюм в новогодней тематике с галстуком',
        'праздничный костюм с новогодними мотивами',
        'нарядный костюм с новогодними украшениями'
      ],
      'romantic': [
        'элегантный новогодний костюм пастельных тонов',
        'нежный костюм с новогодними акцентами'
      ],
      'party': [
        'яркий новогодний костюм с блестками',
        'праздничный костюм с новогодними колпаками',
        'веселый костюм с новогодними узорами'
      ],
      'fairy-tale': [
        'сказочный костюм как у Деда Мороза, красный или синий',
        'волшебный костюм с новогодними звездами',
        'сказочный костюм с новогодними элементами'
      ],
      'elegant': [
        'элегантный новогодний костюм классического покроя',
        'нарядный костюм с изысканными новогодними деталями'
      ],
      'playful': [
        'веселый костюм с новогодними игрушками',
        'игривый костюм с новогодними узорами'
      ],
      'cozy': [
        'уютный костюм с новогодними мотивами, теплые носки',
        'домашний костюм с новогодними узорами'
      ],
      'winter-tale': [
        'теплый зимний костюм с новогодними элементами, варежки',
        'зимний костюм с новогодними узорами, теплая обувь'
      ],
      'glamorous': [
        'гламурный костюм с новогодними блестками',
        'роскошный костюм для новогоднего праздника'
      ],
      'retro': [
        'винтажный костюм в новогоднем стиле 50-80х годов',
        'ретро костюм с новогодними мотивами'
      ],
      'midnight': [
        'элегантный костюм для встречи Нового года',
        'нарядный костюм для новогодней ночи'
      ],
      'children': [
        'детский костюм с новогодними игрушками',
        'веселый костюм для детского новогоднего праздника'
      ]
    }
  },
  
  // Одежда для взрослых женщин
  adultWoman: {
    'family': [
      'элегантное новогоднее платье красного или зеленого цвета с новогодними узорами',
      'нарядное платье с новогодними мотивами, праздничные аксессуары',
      'красивое платье в новогодней тематике, украшенное блестками',
      'праздничное платье с новогодними элементами, элегантная обувь',
      'нарядное платье с новогодними украшениями, праздничные украшения'
    ],
    'romantic': [
      'романтическое платье пастельных тонов с новогодними акцентами',
      'нежное платье с новогодними элементами, элегантные аксессуары',
      'элегантное платье для романтического новогоднего вечера'
    ],
    'party': [
      'яркое платье с новогодними блестками и конфетти',
      'праздничное платье с новогодними колпаками',
      'веселое платье с новогодними узорами, праздничные аксессуары'
    ],
    'fairy-tale': [
      'сказочное платье как у Снегурочки, белое или голубое',
      'волшебное платье с новогодними звездами',
      'сказочное платье с новогодними элементами'
    ],
    'elegant': [
      'элегантное вечернее платье с изысканными новогодними деталями',
      'роскошное платье для новогоднего праздника',
      'нарядное платье классического покроя с новогодними акцентами'
    ],
    'playful': [
      'веселое платье с новогодними игрушками',
      'игривое платье с новогодними узорами',
      'динамичное платье для новогоднего праздника'
    ],
    'cozy': [
      'уютное платье с новогодними мотивами, теплые аксессуары',
      'домашнее платье с новогодними узорами, комфортная обувь',
      'комфортное платье для новогоднего вечера дома'
    ],
    'winter-tale': [
      'теплое зимнее платье с новогодними элементами, варежки',
      'зимнее платье с новогодними узорами, теплая обувь',
      'утепленное платье для зимней новогодней фотосессии'
    ],
    'glamorous': [
      'гламурное платье с новогодними блестками, роскошные аксессуары',
      'роскошное платье для новогоднего праздника',
      'шикарное платье с новогодними украшениями'
    ],
    'retro': [
      'винтажное платье в новогоднем стиле 50-80х годов',
      'ретро платье с новогодними мотивами',
      'старинное платье для новогоднего праздника'
    ],
    'midnight': [
      'элегантное вечернее платье для встречи Нового года',
      'нарядное платье для новогодней ночи',
      'праздничное платье для полночи'
    ],
    'children': [
      'детское платье с новогодними игрушками',
      'веселое платье для детского новогоднего праздника'
    ]
  },
  
  // Одежда для взрослых мужчин
  adultMan: {
    'family': [
      'элегантный новогодний свитер красного или зеленого цвета с новогодними узорами',
      'нарядный свитер с новогодними мотивами, праздничная рубашка',
      'красивый свитер в новогодней тематике, классические брюки',
      'праздничный свитер с новогодними элементами, элегантная обувь',
      'нарядный свитер с новогодними украшениями, праздничные аксессуары'
    ],
    'romantic': [
      'элегантный свитер пастельных тонов с новогодними акцентами',
      'нежный свитер с новогодними элементами, элегантные аксессуары',
      'романтический свитер для новогоднего вечера'
    ],
    'party': [
      'яркий свитер с новогодними блестками',
      'праздничный свитер с новогодними колпаками',
      'веселый свитер с новогодними узорами'
    ],
    'fairy-tale': [
      'сказочный костюм с новогодними элементами',
      'волшебный свитер с новогодними звездами',
      'сказочный наряд для новогоднего праздника'
    ],
    'elegant': [
      'элегантный костюм с изысканными новогодними деталями',
      'роскошный костюм для новогоднего праздника',
      'нарядный костюм классического покроя с новогодними акцентами'
    ],
    'playful': [
      'веселый свитер с новогодними игрушками',
      'игривый свитер с новогодними узорами',
      'динамичный наряд для новогоднего праздника'
    ],
    'cozy': [
      'уютный свитер с новогодними мотивами, теплые аксессуары',
      'домашний свитер с новогодними узорами, комфортная обувь',
      'комфортный наряд для новогоднего вечера дома'
    ],
    'winter-tale': [
      'теплый зимний свитер с новогодними элементами, варежки',
      'зимний свитер с новогодними узорами, теплая обувь',
      'утепленный наряд для зимней новогодней фотосессии'
    ],
    'glamorous': [
      'гламурный костюм с новогодними блестками',
      'роскошный костюм для новогоднего праздника',
      'шикарный наряд с новогодними украшениями'
    ],
    'retro': [
      'винтажный костюм в новогоднем стиле 50-80х годов',
      'ретро костюм с новогодними мотивами',
      'старинный наряд для новогоднего праздника'
    ],
    'midnight': [
      'элегантный костюм для встречи Нового года',
      'нарядный костюм для новогодней ночи',
      'праздничный наряд для полночи'
    ],
    'children': [
      'детский свитер с новогодними игрушками',
      'веселый наряд для детского новогоднего праздника'
    ]
  },
  
  // Одежда для пожилых
  elderly: {
    woman: {
      'family': [
        'элегантное новогоднее платье классического покроя с новогодними узорами',
        'нарядное платье с новогодними мотивами, праздничные аксессуары',
        'красивое платье в новогодней тематике, элегантная обувь'
      ],
      'romantic': [
        'романтическое платье пастельных тонов',
        'нежное платье с новогодними элементами'
      ],
      'cozy': [
        'уютное платье с новогодними мотивами',
        'домашнее платье с новогодними узорами'
      ],
      'elegant': [
        'элегантное платье с изысканными новогодними деталями',
        'роскошное платье для новогоднего праздника'
      ]
    },
    man: {
      'family': [
        'элегантный новогодний костюм классического покроя с новогодними узорами',
        'нарядный костюм с новогодними мотивами, праздничная рубашка',
        'красивый костюм в новогодней тематике'
      ],
      'romantic': [
        'элегантный костюм пастельных тонов',
        'нежный костюм с новогодними элементами'
      ],
      'cozy': [
        'уютный свитер с новогодними мотивами',
        'домашний костюм с новогодними узорами'
      ],
      'elegant': [
        'элегантный костюм с изысканными новогодними деталями',
        'роскошный костюм для новогоднего праздника'
      ]
    }
  }
};

/**
 * Генерирует описание новогодней одежды для промпта
 */
function generateNewYearAttire(analysisResult, styleId, variationIndex) {
  const { people } = analysisResult;
  
  if (!people || people.length === 0) {
    return 'новогодний наряд, соответствующий выбранному стилю';
  }
  
  const attireDescriptions = [];
  
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const age = person.age || 'adult';
    const gender = person.gender || 'unknown';
    
    let attirePool = [];
    
    // Определяем пул одежды в зависимости от возраста и пола
    if (age === 'child') {
      if (gender === 'female' && NEW_YEAR_ATTIRE.child.girl[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.child.girl[styleId];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.child.boy[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.child.boy[styleId];
      } else {
        attirePool = NEW_YEAR_ATTIRE.child.girl[styleId] || NEW_YEAR_ATTIRE.child.boy[styleId] || ['новогодний наряд'];
      }
    } else if (age === 'elderly') {
      if (gender === 'female' && NEW_YEAR_ATTIRE.elderly.woman[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.elderly.woman[styleId];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.elderly.man[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.elderly.man[styleId];
      } else {
        attirePool = NEW_YEAR_ATTIRE.elderly.woman[styleId] || NEW_YEAR_ATTIRE.elderly.man[styleId] || ['новогодний наряд'];
      }
    } else {
      // Взрослые
      if (gender === 'female' && NEW_YEAR_ATTIRE.adultWoman[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.adultWoman[styleId];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.adultMan[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.adultMan[styleId];
      } else {
        attirePool = NEW_YEAR_ATTIRE.adultWoman[styleId] || NEW_YEAR_ATTIRE.adultMan[styleId] || ['новогодний наряд'];
      }
    }
    
    // Выбираем уникальную одежду для каждого человека
    const selectedAttire = getUniqueItems(attirePool, 6)[(variationIndex + i) % attirePool.length];
    attireDescriptions.push(selectedAttire);
  }
  
  // Если несколько человек, объединяем описания
  if (attireDescriptions.length > 1) {
    return `Одежда: ${attireDescriptions.join('; ')}. Каждый человек в уникальном новогоднем наряде, соответствующим выбранному стилю.`;
  }
  
  return `Одежда: ${attireDescriptions[0] || 'новогодний наряд, соответствующий выбранному стилю'}.`;
}

/**
 * Генерирует описание животных из исходного фото
 */
function generateAnimalDescription(analysisResult, isMultiple = false) {
  const { animals } = analysisResult;
  
  if (!animals || animals.length === 0) {
    return 'Домашнее животное (собака или кошка) в новогоднем колпаке или наряде.';
  }
  
  if (isMultiple && animals.length > 1) {
    const animalTypes = animals.map(a => {
      if (a.type === 'dog') return 'собака';
      if (a.type === 'cat') return 'кошка';
      return 'животное';
    }).join(', ');
    
    return `${animals.length} домашних животных (${animalTypes}) в новогодних колпаках или нарядах.`;
  }
  
  const animal = animals[0];
  const animalType = animal.type === 'dog' ? 'собака' : animal.type === 'cat' ? 'кошка' : 'животное';
  
  return `${animalType} в новогоднем колпаке или наряде.`;
}

/**
 * Определяет ориентацию фото на основе категории, стиля и локации
 */
function determineOrientation(categoryId, styleId, locationId, peopleCount) {
  // Для одного человека - чаще вертикальная
  if (peopleCount === 1) {
    // Исключения для горизонтальных локаций
    if (['city-street', 'city-square', 'outdoor-rink', 'park'].includes(locationId)) {
      return 'horizontal';
    }
    return 'vertical';
  }
  
  // Для двух людей - зависит от стиля и локации
  if (peopleCount === 2) {
    if (styleId === 'romantic') {
      return 'vertical'; // Романтические пары - вертикальные
    }
    if (['city-street', 'city-square', 'outdoor-rink', 'park'].includes(locationId)) {
      return 'horizontal';
    }
    return 'vertical';
  }
  
  // Для 3+ людей - чаще горизонтальная
  if (peopleCount >= 3) {
    // Исключения для вертикальных локаций
    if (['photo-studio', 'library', 'balcony-terrace'].includes(locationId)) {
      return 'vertical';
    }
    return 'horizontal';
  }
  
  // Fallback
  return 'horizontal';
}

/**
 * Выбирает вариации для конкретного промпта
 */
function selectVariations(categoryId, styleId, locationId, variationIndex, analysisResult) {
  const { peopleCount } = analysisResult;
  const isSingle = peopleCount === 1;
  const isCouple = peopleCount === 2;
  const isFamily = peopleCount >= 3;
  
  // Выбираем действия
  let actions;
  if (isSingle) {
    actions = ACTION_VARIATIONS.single;
  } else if (isCouple) {
    actions = ACTION_VARIATIONS.couple;
  } else {
    actions = ACTION_VARIATIONS.family;
  }
  
  // Если есть животные, добавляем действия с животными
  if (analysisResult.animalsCount > 0) {
    actions = [...actions, ...ACTION_VARIATIONS.withAnimals];
  }
  
  // Выбираем позы
  let poses;
  if (isSingle) {
    poses = POSE_VARIATIONS.single;
  } else if (isCouple) {
    poses = POSE_VARIATIONS.couple;
  } else {
    poses = POSE_VARIATIONS.family;
  }
  
  // Определяем ориентацию
  const orientation = determineOrientation(categoryId, styleId, locationId, peopleCount);
  const compositions = orientation === 'vertical' 
    ? COMPOSITION_VARIATIONS.vertical 
    : COMPOSITION_VARIATIONS.horizontal;
  
  // Выбираем уникальные вариации для каждого промпта
  const action = getUniqueItems(actions, 6)[variationIndex % actions.length];
  const pose = getUniqueItems(poses, 6)[variationIndex % poses.length];
  const emotion = getUniqueItems(EMOTION_VARIATIONS, 6)[variationIndex % EMOTION_VARIATIONS.length];
  const composition = getUniqueItems(compositions, 6)[variationIndex % compositions.length];
  const lighting = getUniqueItems(LIGHTING_VARIATIONS, 6)[variationIndex % LIGHTING_VARIATIONS.length];
  
  // Генерируем технические характеристики камеры
  const cameraSpecs = generateCameraSpecs(orientation, variationIndex);
  
  return {
    action,
    pose,
    emotion,
    composition,
    lighting,
    orientation,
    cameraSpecs
  };
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ СБОРКИ ПРОМПТОВ
// ============================================================================

/**
 * Строит промпты для новогодней фотосессии
 * 
 * @param {Object} analysisResult - Результат анализа изображения
 * @param {string} styleId - ID стиля (из NEW_YEAR_STYLES)
 * @param {string} locationId - ID локации (из NEW_YEAR_LOCATIONS)
 * @returns {Array<Object>} Массив из 6 промптов с ориентацией
 */
export function buildNewYearPrompts(analysisResult, styleId, locationId) {
  // 1. Определяем категорию
  const categoryId = determineCategory(analysisResult);
  
  // 2. Получаем базовый шаблон категории
  const categoryTemplate = CATEGORY_TEMPLATES[categoryId];
  if (!categoryTemplate) {
    throw new Error(`Не найдена категория: ${categoryId}`);
  }
  
  // 3. Получаем модули стиля и локации
  const styleModule = STYLE_MODULES[styleId];
  if (!styleModule) {
    throw new Error(`Не найден стиль: ${styleId}`);
  }
  
  const locationModule = LOCATION_MODULES[locationId];
  if (!locationModule) {
    throw new Error(`Не найдена локация: ${locationId}`);
  }
  
  // 4. Генерируем инструкции по сохранению лиц, телосложения и описанию животных
  const isMultiple = analysisResult.peopleCount > 1;
  const facePreservation = generateFacePreservation(analysisResult, isMultiple);
  const bodyPreservation = generateBodyPreservation(analysisResult, isMultiple);
  const animalDescription = analysisResult.animalsCount > 0 
    ? generateAnimalDescription(analysisResult, analysisResult.animalsCount > 1)
    : '';
  
  // 5. Генерируем 6 промптов с разными вариациями
  const prompts = [];
  
  for (let i = 0; i < 6; i++) {
    // Выбираем вариации для этого промпта
    const variations = selectVariations(categoryId, styleId, locationId, i, analysisResult);
    
    // Генерируем описание одежды для этого промпта
    const attireDescription = generateNewYearAttire(analysisResult, styleId, i);
    
    // Собираем промпт
    let prompt = categoryTemplate.template;
    
    // Заменяем плейсхолдеры
    prompt = prompt.replace(/\[FACE_PRESERVATION\]/g, facePreservation);
    prompt = prompt.replace(/\[FACE_PRESERVATION_MULTIPLE\]/g, facePreservation);
    prompt = prompt.replace(/\[BODY_PRESERVATION\]/g, bodyPreservation);
    prompt = prompt.replace(/\[ATTIRE_DESCRIPTION\]/g, attireDescription);
    prompt = prompt.replace(/\[ANIMAL_DESCRIPTION\]/g, animalDescription);
    prompt = prompt.replace(/\[ANIMAL_DESCRIPTION_MULTIPLE\]/g, animalDescription);
    prompt = prompt.replace(/\[STYLE_MODULE\]/g, styleModule.module);
    prompt = prompt.replace(/\[LOCATION_MODULE\]/g, locationModule.module);
    prompt = prompt.replace(/\[ACTION_VARIATION\]/g, variations.action);
    prompt = prompt.replace(/\[POSE_VARIATION\]/g, variations.pose);
    prompt = prompt.replace(/\[EMOTION_VARIATION\]/g, variations.emotion);
    prompt = prompt.replace(/\[COMPOSITION_VARIATION\]/g, variations.composition);
    prompt = prompt.replace(/\[LIGHTING_VARIATION\]/g, variations.lighting);
    prompt = prompt.replace(/\[CAMERA_SPECS\]/g, variations.cameraSpecs.specs);
    
    // Добавляем ориентацию и технические характеристики в конец промпта
    prompt += ` Ориентация: ${variations.orientation === 'vertical' ? 'вертикальная (portrait)' : 'горизонтальная (landscape)'}. Технические характеристики: ${variations.cameraSpecs.specs}.`;
    
    prompts.push({
      prompt,
      orientation: variations.orientation,
      variationIndex: i,
      cameraSpecs: variations.cameraSpecs
    });
  }
  
  return prompts;
}

/**
 * Получает информацию о категории
 */
export function getCategoryInfo(categoryId) {
  return CATEGORY_TEMPLATES[categoryId] || null;
}

/**
 * Получает информацию о стиле
 */
export function getStyleInfo(styleId) {
  return STYLE_MODULES[styleId] || null;
}

/**
 * Получает информацию о локации
 */
export function getLocationInfo(locationId) {
  return LOCATION_MODULES[locationId] || null;
}
