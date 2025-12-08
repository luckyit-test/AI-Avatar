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
// МОДУЛИ ЛОКАЦИЙ (25 локаций)
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
  },
  
  'new-year-dacha': {
    name: 'Новогодняя дача',
    module: `Загородная дача с новогодним убранством и зимней атмосферой. 
Новогодние элементы: елка на даче, деревянная веранда, снег вокруг, новогодние огни, уютная дачная атмосфера, зимний сад. 
Атмосфера: уютная, семейная, загородная.`
  },
  
  'eiffel-tower': {
    name: 'Эйфелева башня',
    module: `Роскошная новогодняя атмосфера у Эйфелевой башни в Париже. 
Новогодние элементы: Эйфелева башня, новогодние огни, парижская атмосфера, праздничное освещение, роскошный декор. 
Атмосфера: роскошная, романтическая, торжественная.`
  },
  
  'new-year-ball': {
    name: 'Новогодний бал',
    module: `Роскошный новогодний бал в великолепном зале. 
Новогодние элементы: бальный зал, роскошная елка, элегантные декорации, бальные платья, торжественная атмосфера, музыка. 
Атмосфера: роскошная, элегантная, торжественная.`
  },
  
  'santa-residence': {
    name: 'Резиденция Деда Мороза',
    module: `Волшебная резиденция Деда Мороза с новогодней магией. 
Новогодние элементы: резиденция Деда Мороза, волшебная елка, сказочные декорации, магия праздника, игрушки, подарки. 
Атмосфера: сказочная, волшебная, детская.`
  },
  
  'metro-new-year': {
    name: 'Новый год в метро',
    module: `Необычная новогодняя атмосфера в метро с праздничным декором. 
Новогодние элементы: метро, новогодние украшения, праздничное освещение, необычная обстановка, городская атмосфера. 
Атмосфера: необычная, современная, городская.`
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
  // Убраны действия, которые могут заставить повернуть голову
  single: [
    'открывает подарки у елки',
    'украшает елку новогодними игрушками',
    'готовит праздничный стол',
    'читает новогоднюю книгу у камина',
    'пьет горячий чай/какао',
    'держит в руках новогодние игрушки',
    'стоит у елки',
    'сидит у камина с подарками',
    'готовит новогодние угощения',
    'держит бокал шампанского',
    'играет с новогодними игрушками',
    'стоит на балконе',
    'украшает дом новогодними гирляндами',
    'готовит новогодние подарки',
    'стоит в новогоднем наряде',
    'держит новогодние подарки',
    'украшает елку гирляндами',
    'готовит праздничные блюда',
    'держит новогодние игрушки',
    'стоит у праздничного стола'
  ],
  
  // Действия для двух людей
  // Убраны действия, которые могут заставить повернуть голову
  couple: [
    'открывают подарки вместе у елки',
    'украшают елку вместе',
    'готовят праздничный стол вместе',
    'сидят у камина с бокалами шампанского',
    'обнимаются у елки',
    'играют в новогодние игры',
    'готовят новогодний ужин вместе',
    'поздравляют друг друга',
    'стоят в обнимку у елки',
    'сидят на диване с подарками',
    'готовят новогодние подарки вместе',
    'стоят на балконе',
    'готовят новогодние угощения вместе',
    'обнимаются у елки',
    'держат подарки вместе',
    'украшают елку вместе',
    'готовят праздничные блюда вместе',
    'стоят у праздничного стола',
    'держат бокалы шампанского',
    'обнимаются у камина'
  ],
  
  // Действия для семьи (3+ человек)
  // Убраны действия, которые могут заставить повернуть голову
  family: [
    'открывают подарки всей семьей у елки',
    'украшают елку всей семьей',
    'готовят праздничный стол всей семьей',
    'играют в новогодние игры всей семьей',
    'сидят у камина всей семьей',
    'готовят новогодний ужин вместе',
    'поздравляют друг друга',
    'стоят у елки всей семьей',
    'готовят новогодние подарки вместе',
    'готовят новогодние угощения вместе',
    'стоят на балконе',
    'обнимаются всей семьей у елки',
    'держат подарки всей семьей',
    'украшают елку всей семьей',
    'готовят праздничные блюда вместе',
    'стоят у праздничного стола',
    'обнимаются у камина',
    'держат новогодние игрушки',
    'стоят у елки всей семьей',
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
  // Убраны все упоминания о взглядах и направлениях, которые могут изменить ракурс головы
  single: [
    'стоит у елки',
    'сидит у камина, держа подарки',
    'стоит на балконе',
    'сидит на диване с новогодними игрушками',
    'стоит у окна',
    'сидит у елки, держа подарки',
    'стоит в центре комнаты',
    'сидит на полу у елки',
    'стоит у камина с бокалом шампанского',
    'сидит за столом с новогодними угощениями',
    'стоит у елки, держа новогодние игрушки',
    'сидит на ковре у елки',
    'стоит на балконе',
    'сидит у камина с книгой',
    'стоит у елки с подарками'
  ],
  
  // Позы для двух людей
  // Ограничены позами, которые не кардинально меняют ракурс лица
  couple: [
    'стоят в обнимку у елки',
    'сидят у камина, обнимаясь',
    'стоят на балконе, обнимаясь',
    'сидят на диване, обнимаясь',
    'стоят у елки, держась за руки',
    'сидят у камина с бокалами шампанского',
    'стоят в обнимку на балконе',
    'сидят на полу у елки, обнимаясь',
    'стоят у елки, обнимаясь',
    'сидят у камина, держась за руки',
    'стоят на балконе, держась за руки',
    'сидят на диване с подарками',
    'стоят у елки, обнимаясь',
    'сидят у камина, обнимаясь',
    'стоят в обнимку у елки'
  ],
  
  // Позы для семьи (3+ человек)
  // Ограничены позами, которые не кардинально меняют ракурс лица
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
 * Ограничены естественными выражениями для лучшего сохранения узнаваемости лица
 */
const EMOTION_VARIATIONS = [
  'естественное выражение лица',
  'легкая улыбка',
  'спокойное выражение',
  'естественная улыбка',
  'мягкое выражение',
  'естественное выражение',
  'легкая улыбка',
  'спокойное лицо',
  'естественная улыбка',
  'мягкая улыбка',
  'естественное выражение лица',
  'легкая улыбка',
  'спокойное выражение',
  'естественная улыбка',
  'мягкое выражение'
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
  
  // Строгая инструкция по сохранению бороды и усов
  const facialHairInstruction = `КРИТИЧЕСКИ ВАЖНО: Сохранить усы и бороду в ТОЧНОМ исходном состоянии. 
Если в исходном фото у человека есть борода - сохранить её ТОЧНО такой же (длина, густота, форма, стиль, цвет). 
Если в исходном фото у человека есть усы - сохранить их ТОЧНО такими же (длина, форма, стиль, цвет). 
Если в исходном фото человек без бороды и усов - НЕ добавлять бороду и усы. 
Если в исходном фото человек с бородой - НЕ удалять бороду, НЕ изменять её параметры. 
Если в исходном фото человек с усами - НЕ удалять усы, НЕ изменять их параметры. 
Усы и борода должны выглядеть ИДЕНТИЧНО исходному фото во всех деталях. 
НЕ изменять растительность на лице, НЕ добавлять растительность, если её нет в исходном фото, НЕ удалять растительность, если она есть в исходном фото.`;
  
  // Строгая инструкция по сохранению черт лица с фиксацией ракурса
  const faceFeaturesInstruction = `КРИТИЧЕСКИ ВАЖНО: Сохранить ТОЧНЫЕ черты лица из исходного фото: форму лица, форму носа, форму губ, форму глаз, расстояние между глазами, форму бровей, форму подбородка, форму скул, все пропорции лица, цвет глаз, цвет кожи, все уникальные особенности лица. 
КРИТИЧЕСКИ ВАЖНО: Сохранить ТОЧНЫЙ ракурс лица из исходного фото. Ракурс головы должен быть ИДЕНТИЧЕН исходному фото (если в исходнике анфас - строго анфас; если профиль - строго профиль; если три четверти - строго три четверти; если легкий поворот - сохранить тот же легкий поворот). НЕ поворачивать голову, НЕ менять угол лица, НЕ менять ракурс головы относительно исходного фото. Голова должна быть в ТОЧНО ТАКОМ ЖЕ положении относительно камеры, как в исходном фото.
Выражение лица должно быть ЕСТЕСТВЕННЫМ и близким к исходному фото (не кардинально менять мимику - если в исходнике улыбка, то легкая улыбка; если нейтральное выражение, то нейтральное или легкая улыбка). 
Направление взгляда должно быть близким к исходному (если в исходнике смотрит в камеру, то преимущественно в камеру; если смотрит в сторону, то в ту же сторону или естественный взгляд вперед). НЕ поворачивать голову для изменения направления взгляда.`;
  
  if (!people || people.length === 0) {
    // Если нет данных о людях, добавляем общую инструкцию о растительности на лице
    return `${faceFeaturesInstruction} Сохранить прическу, все уникальные особенности из исходного фото. ${facialHairInstruction}`;
  }
  
  if (isMultiple && people.length > 1) {
    // Для нескольких людей: проверяем, есть ли мужчины, и добавляем инструкцию о растительности
    const hasMen = people.some(p => p.gender === 'male');
    const facialHairText = hasMen ? ` ${facialHairInstruction}` : '';
    return `${faceFeaturesInstruction} Сохранить прически всех ${people.length} человек, все уникальные особенности каждого человека. Каждый человек должен быть ИДЕНТИЧНО узнаваем как в исходном фото.${facialHairText}`;
  }
  
  // Для одного человека: добавляем инструкцию о растительности только для мужчин
  const person = people[0];
  const gender = person.gender === 'male' ? 'мужчина' : person.gender === 'female' ? 'женщина' : 'человек';
  const facialHairText = person.gender === 'male' ? ` ${facialHairInstruction}` : '';
  
  return `${faceFeaturesInstruction} Сохранить прическу ${gender}, все уникальные особенности. Человек должен быть ИДЕНТИЧНО узнаваем как в исходном фото.${facialHairText}`;
}

/**
 * Генерирует инструкцию по сохранению роста и телосложения из исходного фото
 */
function generateBodyPreservation(analysisResult, isMultiple = false) {
  const { people } = analysisResult;
  
  const bodyPreservationBase = `КРИТИЧЕСКИ ВАЖНО: Сохранить рост и телосложение в ТОЧНОМ исходном состоянии. 
Рост должен быть ИДЕНТИЧЕН исходному фото (низкий, средний, высокий - как в оригинале). 
Телосложение должно быть ИДЕНТИЧНО исходному фото (худощавое, среднее, полное, спортивное - как в оригинале). 
Пропорции тела должны быть ТОЧНО такими же, как в исходном фото (длина рук, длина ног, ширина плеч, размер талии, размер бедер, все пропорции). 
НЕ изменять рост, НЕ изменять телосложение, НЕ изменять пропорции тела, НЕ изменять размеры частей тела. 
Все параметры тела должны быть ТОЧНО такими же, как в исходном фото.`;
  
  if (!people || people.length === 0) {
    return bodyPreservationBase;
  }
  
  if (isMultiple && people.length > 1) {
    return `КРИТИЧЕСКИ ВАЖНО: Сохранить рост и телосложение всех ${people.length} человек в ТОЧНОМ исходном состоянии. 
Рост каждого человека должен быть ИДЕНТИЧЕН исходному фото. 
Телосложение каждого человека должно быть ИДЕНТИЧНО исходному фото. 
Пропорции тела каждого человека должны быть ТОЧНО такими же, как в исходном фото (длина рук, длина ног, ширина плеч, размер талии, размер бедер, все пропорции). 
НЕ изменять рост, НЕ изменять телосложение, НЕ изменять пропорции тела, НЕ изменять размеры частей тела ни у одного человека. 
Все параметры тела должны быть ТОЧНО такими же, как в исходном фото.`;
  }
  
  return bodyPreservationBase;
}

/**
 * Праздничные головные уборы для новогодних фотосессий
 */
const NEW_YEAR_HEADWEAR = {
  child: {
    girl: [
      'элегантная новогодняя тиара с кристаллами и снежинками',
      'роскошная корона с новогодними звездами',
      'стильная шапочка Деда Мороза из дорогого бархата',
      'элегантный обруч с новогодними украшениями',
      'красивая диадема с новогодними мотивами',
      'стильный новогодний венок из еловых веток с украшениями'
    ],
    boy: [
      'элегантная шапочка Деда Мороза из дорогого бархата',
      'стильный новогодний колпак премиум-класса',
      'роскошная шапка с новогодними узорами',
      'элегантный берет с новогодними акцентами',
      'стильная шапка с помпоном и новогодними элементами'
    ]
  },
  adultWoman: [
    'элегантная новогодняя тиара с кристаллами Swarovski',
    'роскошная диадема с новогодними звездами и жемчугом',
    'стильная шапочка Деда Мороза из дорогого бархата и меха',
    'элегантный обруч с новогодними украшениями премиум-класса',
    'красивая корона с новогодними мотивами и драгоценными камнями',
    'роскошный новогодний венок из еловых веток с золотыми украшениями',
    'элегантная шляпка с новогодними акцентами',
    'стильная повязка на голову с новогодними элементами'
  ],
  adultMan: [
    'элегантная шапочка Деда Мороза из дорогого бархата и меха',
    'стильный новогодний колпак премиум-класса',
    'роскошная шапка с новогодними узорами из качественных материалов',
    'элегантный берет с новогодними акцентами',
    'стильная шапка с помпоном и новогодними элементами',
    'элегантная кепка с новогодними мотивами',
    'роскошная шапка-ушанка с новогодними украшениями'
  ],
  elderly: {
    woman: [
      'элегантная новогодняя тиара с кристаллами',
      'роскошная диадема с новогодними звездами',
      'стильная шапочка Деда Мороза из дорогого бархата',
      'элегантный обруч с новогодними украшениями'
    ],
    man: [
      'элегантная шапочка Деда Мороза из дорогого бархата',
      'стильный новогодний колпак премиум-класса',
      'роскошная шапка с новогодними узорами',
      'элегантный берет с новогодними акцентами'
    ]
  }
};

/**
 * Новогодняя одежда для разных стилей и категорий
 */
const NEW_YEAR_ATTIRE = {
  // Одежда для детей
  child: {
    girl: {
      'family': [
        'роскошное новогоднее платье из дорогого атласа с вышитыми елочками и снежинками, красного или изумрудно-зеленого цвета, украшенное кристаллами',
        'элегантное нарядное платье премиум-класса с новогодними узорами, украшенное блестками и пайетками, качественный крой',
        'стильное красивое платье в новогодней тематике с бантами и лентами из дорогих материалов, праздничные детали',
        'роскошное праздничное платье с новогодними мотивами, теплые качественные колготки, элегантная обувь',
        'элегантное нарядное платье с новогодними украшениями, праздничные туфли премиум-класса, качественные аксессуары',
        'стильное платье из дорогого бархата с новогодними вышивками, роскошные детали, элегантный покрой',
        'красивое платье с новогодними мотивами из качественного шелка, праздничные украшения, стильный дизайн',
        'роскошное платье с новогодними узорами из премиум-материалов, элегантные аксессуары, дорогие детали',
        'элегантное платье с новогодними элементами, качественный крой, стильные украшения',
        'нарядное платье премиум-класса с новогодними мотивами, роскошные детали, элегантный стиль'
      ],
      'romantic': [
        'роскошное элегантное новогоднее платье пастельных тонов из дорогого шелка, нежные новогодние акценты, качественный крой',
        'стильное нежное платье премиум-класса с новогодними акцентами, элегантные детали, дорогие материалы',
        'элегантное романтическое платье с новогодними элементами из качественного атласа, роскошные украшения',
        'красивое платье пастельных тонов с новогодними мотивами, стильный дизайн, премиум-материалы',
        'роскошное платье для романтического новогоднего вечера, элегантный покрой, качественные детали',
        'элегантное платье с новогодними элементами из дорогого бархата, нежные акценты, стильный крой',
        'стильное платье премиум-класса с новогодними узорами, роскошные детали, элегантный дизайн',
        'красивое романтическое платье с новогодними мотивами, качественные материалы, дорогие украшения',
        'элегантное платье пастельных тонов с новогодними акцентами, премиум-класс, стильный покрой',
        'роскошное платье для романтического вечера, новогодние элементы, качественный дизайн'
      ],
      'party': [
        'яркое роскошное новогоднее платье с блестками и конфетти из дорогих материалов, праздничные детали',
        'стильное праздничное платье премиум-класса с новогодними колпаками, качественный крой, элегантные аксессуары',
        'элегантное веселое платье с новогодними узорами, роскошные украшения, стильный дизайн',
        'красивое платье с новогодними блестками из дорогого атласа, праздничные элементы, премиум-материалы',
        'роскошное платье для новогодней вечеринки, яркие новогодние акценты, качественный покрой',
        'стильное платье с новогодними узорами премиум-класса, элегантные детали, дорогие материалы',
        'элегантное праздничное платье с новогодними элементами, роскошные украшения, стильный дизайн',
        'красивое платье для вечеринки с новогодними мотивами, качественные материалы, премиум-класс',
        'роскошное платье с новогодними блестками, элегантный крой, дорогие детали',
        'стильное платье премиум-класса для новогоднего праздника, яркие акценты, качественный дизайн'
      ],
      'fairy-tale': [
        'роскошное сказочное платье как у Снегурочки из дорогого белого или голубого бархата, кристаллы, элегантный покрой',
        'стильное волшебное платье премиум-класса с новогодними звездами, роскошные украшения, качественные материалы',
        'элегантное сказочное платье с новогодними элементами из дорогого шелка, магические детали, стильный дизайн',
        'красивое платье в стиле Снегурочки из премиум-материалов, новогодние мотивы, роскошные украшения',
        'роскошное волшебное платье с новогодними звездами, элегантный крой, качественные детали',
        'стильное сказочное платье премиум-класса, новогодние элементы, дорогие материалы',
        'элегантное платье в сказочном стиле с новогодними мотивами, роскошные детали, стильный покрой',
        'красивое платье как у Снегурочки из дорогого бархата, кристаллы, премиум-класс',
        'роскошное волшебное платье с новогодними элементами, элегантный дизайн, качественные материалы',
        'стильное сказочное платье премиум-класса, новогодние звезды, дорогие украшения'
      ],
      'elegant': [
        'роскошное элегантное новогоднее платье классического покроя из дорогого атласа, изысканные новогодние детали',
        'стильное нарядное платье премиум-класса с изысканными новогодними деталями, качественный крой, элегантные украшения',
        'элегантное роскошное платье для новогоднего праздника из дорогих материалов, стильный дизайн, премиум-класс',
        'красивое платье классического покроя с новогодними акцентами, роскошные детали, качественные материалы',
        'роскошное элегантное платье премиум-класса, новогодние элементы, элегантный покрой, дорогие украшения',
        'стильное платье для новогоднего праздника из дорогого шелка, изысканные детали, качественный дизайн',
        'элегантное платье классического покроя с новогодними мотивами, роскошные материалы, премиум-класс',
        'красивое нарядное платье премиум-класса, новогодние акценты, стильный крой, элегантные детали',
        'роскошное платье для новогоднего праздника, изысканные новогодние элементы, качественный дизайн',
        'стильное элегантное платье из дорогих материалов, новогодние мотивы, премиум-класс, роскошные украшения'
      ],
      'playful': [
        'роскошное веселое платье с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
        'стильное игривое платье премиум-класса с новогодними узорами, элегантные детали, дорогие украшения',
        'элегантное детское платье с новогодними элементами из качественного атласа, роскошные акценты, стильный покрой',
        'красивое платье с новогодними игрушками премиум-класса, праздничные мотивы, качественные материалы',
        'роскошное веселое платье для новогоднего праздника, новогодние элементы, элегантный дизайн',
        'стильное платье с новогодними узорами из дорогих материалов, игривые детали, премиум-класс',
        'элегантное детское платье премиум-класса, новогодние акценты, роскошные украшения, стильный крой',
        'красивое платье для детского праздника с новогодними мотивами, качественные материалы, элегантный дизайн',
        'роскошное игривое платье с новогодними элементами, дорогие детали, стильный покрой',
        'стильное платье премиум-класса для детского новогоднего праздника, новогодние узоры, качественный дизайн'
      ],
      'cozy': [
        'роскошное уютное платье с новогодними мотивами из дорогого кашемира, теплые качественные аксессуары, элегантный покрой',
        'стильное домашнее платье премиум-класса с новогодними узорами, комфортная обувь из качественных материалов, роскошные детали',
        'элегантное комфортное платье для новогоднего вечера из дорогих материалов, новогодние элементы, стильный дизайн',
        'красивое уютное платье с новогодними мотивами премиум-класса, теплые аксессуары, качественный крой',
        'роскошное домашнее платье для новогоднего вечера, новогодние узоры, элегантные детали, премиум-материалы',
        'стильное платье с новогодними элементами из дорогого бархата, комфортный покрой, качественные аксессуары',
        'элегантное уютное платье премиум-класса, новогодние мотивы, роскошные детали, стильный дизайн',
        'красивое платье для домашнего новогоднего вечера, новогодние акценты, качественные материалы, элегантный крой',
        'роскошное комфортное платье с новогодними элементами, дорогие материалы, стильный покрой',
        'стильное уютное платье премиум-класса для новогоднего вечера, новогодние узоры, качественный дизайн'
      ],
      'winter-tale': [
        'роскошное теплое зимнее платье с новогодними элементами из дорогих материалов, качественные варежки, элегантный покрой',
        'стильное зимнее платье премиум-класса с новогодними узорами, теплая обувь из качественных материалов, роскошные детали',
        'элегантное утепленное платье для зимней новогодней фотосессии из дорогого кашемира, новогодние мотивы, стильный дизайн',
        'красивое зимнее платье с новогодними элементами премиум-класса, теплые аксессуары, качественный крой',
        'роскошное платье для зимней фотосессии, новогодние узоры, элегантные детали, премиум-материалы',
        'стильное теплое платье с новогодними мотивами из дорогих материалов, качественные варежки, стильный покрой',
        'элегантное зимнее платье премиум-класса, новогодние акценты, роскошные детали, качественный дизайн',
        'красивое платье для зимней новогодней фотосессии, новогодние элементы, теплая обувь, элегантный крой',
        'роскошное утепленное платье с новогодними узорами, дорогие материалы, стильный покрой',
        'стильное зимнее платье премиум-класса для новогодней фотосессии, новогодние мотивы, качественный дизайн'
      ],
      'glamorous': [
        'роскошное гламурное платье с новогодними блестками из дорогих материалов, кристаллы Swarovski, элегантный покрой',
        'стильное роскошное платье премиум-класса для новогоднего праздника, дорогие украшения, качественный крой, изысканные детали',
        'элегантное шикарное платье с новогодними украшениями из дорогого бархата, роскошные аксессуары, стильный дизайн',
        'красивое гламурное платье с новогодними блестками премиум-класса, кристаллы, элегантные детали, качественные материалы',
        'роскошное платье для новогоднего праздника, новогодние украшения, дорогие материалы, стильный покрой',
        'стильное шикарное платье премиум-класса, новогодние блестки, роскошные детали, элегантный дизайн',
        'элегантное гламурное платье с новогодними элементами из дорогих материалов, кристаллы, качественный крой',
        'красивое роскошное платье для новогоднего праздника, новогодние акценты, премиум-класс, стильные украшения',
        'роскошное платье с новогодними блестками, дорогие материалы, элегантный покрой, изысканные детали',
        'стильное гламурное платье премиум-класса для новогоднего праздника, новогодние украшения, качественный дизайн'
      ],
      'retro': [
        'роскошное винтажное платье в новогоднем стиле 50-80х годов из дорогих материалов, ретро-детали, элегантный покрой',
        'стильное ретро платье премиум-класса с новогодними мотивами, качественный крой, роскошные украшения',
        'элегантное старинное платье для новогоднего праздника из дорогого бархата, новогодние элементы, стильный дизайн',
        'красивое винтажное платье с новогодними мотивами премиум-класса, ретро-акценты, качественные материалы',
        'роскошное платье в стиле 50-80х годов, новогодние узоры, элегантные детали, премиум-материалы',
        'стильное ретро платье премиум-класса, новогодние элементы, дорогие украшения, стильный покрой',
        'элегантное винтажное платье с новогодними мотивами, роскошные детали, качественный дизайн',
        'красивое платье в ретро-стиле для новогоднего праздника, новогодние акценты, элегантный крой',
        'роскошное старинное платье премиум-класса, новогодние узоры, дорогие материалы, стильный дизайн',
        'стильное ретро платье для новогоднего праздника, новогодние мотивы, качественный покрой, элегантные детали'
      ],
      'midnight': [
        'роскошное элегантное вечернее платье для встречи Нового года из дорогого атласа, изысканные детали, качественный крой',
        'стильное нарядное платье премиум-класса для новогодней ночи, роскошные украшения, элегантный покрой',
        'элегантное праздничное платье для полночи из дорогих материалов, новогодние элементы, стильный дизайн',
        'красивое вечернее платье для встречи Нового года премиум-класса, новогодние акценты, качественные материалы',
        'роскошное платье для новогодней ночи, элегантные детали, дорогие украшения, стильный покрой',
        'стильное вечернее платье премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
        'элегантное платье для полночи, новогодние элементы, премиум-класс, стильные детали',
        'красивое нарядное платье для встречи Нового года, новогодние узоры, элегантный крой, дорогие материалы',
        'роскошное праздничное платье премиум-класса, новогодние акценты, качественный покрой, стильные украшения',
        'стильное вечернее платье для новогодней ночи, новогодние мотивы, дорогие детали, элегантный дизайн'
      ],
      'children': [
        'роскошное детское платье с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
        'стильное веселое платье премиум-класса для детского новогоднего праздника, элегантные детали, роскошные украшения',
        'элегантное сказочное платье для детей с новогодними элементами из качественного атласа, праздничные акценты',
        'красивое детское платье с новогодними игрушками премиум-класса, новогодние мотивы, качественные материалы',
        'роскошное платье для детского новогоднего праздника, новогодние элементы, стильный покрой, элегантные детали',
        'стильное детское платье премиум-класса, новогодние узоры, дорогие украшения, качественный дизайн',
        'элегантное веселое платье для детей, новогодние акценты, роскошные материалы, стильный крой',
        'красивое платье для детского праздника с новогодними мотивами, премиум-класс, элегантный дизайн',
        'роскошное детское платье с новогодними элементами, дорогие детали, стильный покрой, качественные материалы',
        'стильное платье премиум-класса для детского новогоднего праздника, новогодние узоры, элегантный дизайн'
      ]
    },
    boy: {
      'family': [
        'роскошный новогодний костюм из дорогого бархата с вышитыми елочками и снежинками, красного или изумрудно-зеленого цвета, качественный крой',
        'элегантный нарядный костюм премиум-класса с новогодними узорами, праздничная рубашка из дорогих материалов, стильные детали',
        'стильный красивый костюм в новогодней тематике с галстуком премиум-класса, элегантный покрой, роскошные украшения',
        'роскошный праздничный костюм с новогодними мотивами из качественных материалов, элегантная обувь, дорогие аксессуары',
        'элегантный нарядный костюм с новогодними украшениями, праздничные аксессуары премиум-класса, качественный дизайн',
        'стильный костюм из дорогого бархата с новогодними вышивками, роскошные детали, элегантный покрой',
        'красивый костюм с новогодними мотивами из качественного сукна, праздничные украшения, стильный дизайн',
        'роскошный костюм с новогодними узорами из премиум-материалов, элегантные аксессуары, дорогие детали',
        'элегантный костюм с новогодними элементами, качественный крой, стильные украшения',
        'нарядный костюм премиум-класса с новогодними мотивами, роскошные детали, элегантный стиль'
      ],
      'romantic': [
        'роскошный элегантный новогодний костюм пастельных тонов из дорогого бархата, нежные новогодние акценты, качественный крой',
        'стильный нежный костюм премиум-класса с новогодними акцентами, элегантные детали, дорогие материалы',
        'элегантный романтический костюм с новогодними элементами из качественного сукна, роскошные украшения',
        'красивый костюм пастельных тонов с новогодними мотивами, стильный дизайн, премиум-материалы',
        'роскошный костюм для романтического новогоднего вечера, элегантный покрой, качественные детали',
        'стильный костюм с новогодними элементами из дорогого бархата, нежные акценты, стильный крой',
        'элегантный костюм премиум-класса с новогодними узорами, роскошные детали, элегантный дизайн',
        'красивый романтический костюм с новогодними мотивами, качественные материалы, дорогие украшения',
        'роскошный костюм пастельных тонов с новогодними акцентами, премиум-класс, стильный покрой',
        'стильный костюм для романтического вечера, новогодние элементы, качественный дизайн'
      ],
      'party': [
        'яркий роскошный новогодний костюм с блестками из дорогих материалов, праздничные детали',
        'стильный праздничный костюм премиум-класса с новогодними колпаками, качественный крой, элегантные аксессуары',
        'элегантный веселый костюм с новогодними узорами, роскошные украшения, стильный дизайн',
        'красивый костюм с новогодними блестками из дорогого бархата, праздничные элементы, премиум-материалы',
        'роскошный костюм для новогодней вечеринки, яркие новогодние акценты, качественный покрой',
        'стильный костюм с новогодними узорами премиум-класса, элегантные детали, дорогие материалы',
        'элегантный праздничный костюм с новогодними элементами, роскошные украшения, стильный дизайн',
        'красивый костюм для вечеринки с новогодними мотивами, качественные материалы, премиум-класс',
        'роскошный костюм с новогодними блестками, элегантный крой, дорогие детали',
        'стильный костюм премиум-класса для новогоднего праздника, яркие акценты, качественный дизайн'
      ],
      'fairy-tale': [
        'роскошный сказочный костюм как у Деда Мороза из дорогого красного или синего бархата, кристаллы, элегантный покрой',
        'стильный волшебный костюм премиум-класса с новогодними звездами, роскошные украшения, качественные материалы',
        'элегантный сказочный костюм с новогодними элементами из дорогого сукна, магические детали, стильный дизайн',
        'красивый костюм в стиле Деда Мороза из премиум-материалов, новогодние мотивы, роскошные украшения',
        'роскошный волшебный костюм с новогодними звездами, элегантный крой, качественные детали',
        'стильный сказочный костюм премиум-класса, новогодние элементы, дорогие материалы',
        'элегантный костюм в сказочном стиле с новогодними мотивами, роскошные детали, стильный покрой',
        'красивый костюм как у Деда Мороза из дорогого бархата, кристаллы, премиум-класс',
        'роскошный волшебный костюм с новогодними элементами, элегантный дизайн, качественные материалы',
        'стильный сказочный костюм премиум-класса, новогодние звезды, дорогие украшения'
      ],
      'elegant': [
        'роскошный элегантный новогодний костюм классического покроя из дорогого бархата, изысканные новогодние детали',
        'стильный нарядный костюм премиум-класса с изысканными новогодними деталями, качественный крой, элегантные украшения',
        'элегантный роскошный костюм для новогоднего праздника из дорогих материалов, стильный дизайн, премиум-класс',
        'красивый костюм классического покроя с новогодними акцентами, роскошные детали, качественные материалы',
        'роскошный элегантный костюм премиум-класса, новогодние элементы, элегантный покрой, дорогие украшения',
        'стильный костюм для новогоднего праздника из дорогого сукна, изысканные детали, качественный дизайн',
        'элегантный костюм классического покроя с новогодними мотивами, роскошные материалы, премиум-класс',
        'красивый нарядный костюм премиум-класса, новогодние акценты, стильный крой, элегантные детали',
        'роскошный костюм для новогоднего праздника, изысканные новогодние элементы, качественный дизайн',
        'стильный элегантный костюм из дорогих материалов, новогодние мотивы, премиум-класс, роскошные украшения'
      ],
      'playful': [
        'роскошный веселый костюм с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
        'стильный игривый костюм премиум-класса с новогодними узорами, элегантные детали, дорогие украшения',
        'элегантный детский костюм с новогодними элементами из качественного бархата, роскошные акценты, стильный покрой',
        'красивый костюм с новогодними игрушками премиум-класса, праздничные мотивы, качественные материалы',
        'роскошный веселый костюм для новогоднего праздника, новогодние элементы, элегантный дизайн',
        'стильный костюм с новогодними узорами из дорогих материалов, игривые детали, премиум-класс',
        'элегантный детский костюм премиум-класса, новогодние акценты, роскошные украшения, стильный крой',
        'красивый костюм для детского праздника с новогодними мотивами, качественные материалы, элегантный дизайн',
        'роскошный игривый костюм с новогодними элементами, дорогие детали, стильный покрой',
        'стильный костюм премиум-класса для детского новогоднего праздника, новогодние узоры, качественный дизайн'
      ],
      'cozy': [
        'роскошный уютный костюм с новогодними мотивами из дорогого кашемира, теплые качественные аксессуары, элегантный покрой',
        'стильный домашний костюм премиум-класса с новогодними узорами, комфортная обувь из качественных материалов, роскошные детали',
        'элегантный комфортный костюм для новогоднего вечера из дорогих материалов, новогодние элементы, стильный дизайн',
        'красивый уютный костюм с новогодними мотивами премиум-класса, теплые аксессуары, качественный крой',
        'роскошный домашний костюм для новогоднего вечера, новогодние узоры, элегантные детали, премиум-материалы',
        'стильный костюм с новогодними элементами из дорогого бархата, комфортный покрой, качественные аксессуары',
        'элегантный уютный костюм премиум-класса, новогодние мотивы, роскошные детали, стильный дизайн',
        'красивый костюм для домашнего новогоднего вечера, новогодние акценты, качественные материалы, элегантный крой',
        'роскошный комфортный костюм с новогодними элементами, дорогие материалы, стильный покрой',
        'стильный уютный костюм премиум-класса для новогоднего вечера, новогодние узоры, качественный дизайн'
      ],
      'winter-tale': [
        'роскошный теплый зимний костюм с новогодними элементами из дорогих материалов, качественные варежки, элегантный покрой',
        'стильный зимний костюм премиум-класса с новогодними узорами, теплая обувь из качественных материалов, роскошные детали',
        'элегантный утепленный костюм для зимней новогодней фотосессии из дорогого кашемира, новогодние мотивы, стильный дизайн',
        'красивый зимний костюм с новогодними элементами премиум-класса, теплые аксессуары, качественный крой',
        'роскошный костюм для зимней фотосессии, новогодние узоры, элегантные детали, премиум-материалы',
        'стильный теплый костюм с новогодними мотивами из дорогих материалов, качественные варежки, стильный покрой',
        'элегантный зимний костюм премиум-класса, новогодние акценты, роскошные детали, качественный дизайн',
        'красивый костюм для зимней новогодней фотосессии, новогодние элементы, теплая обувь, элегантный крой',
        'роскошный утепленный костюм с новогодними узорами, дорогие материалы, стильный покрой',
        'стильный зимний костюм премиум-класса для новогодней фотосессии, новогодние мотивы, качественный дизайн'
      ],
      'glamorous': [
        'роскошный гламурный костюм с новогодними блестками из дорогих материалов, кристаллы Swarovski, элегантный покрой',
        'стильный роскошный костюм премиум-класса для новогоднего праздника, дорогие украшения, качественный крой, изысканные детали',
        'элегантный шикарный костюм с новогодними украшениями из дорогого бархата, роскошные аксессуары, стильный дизайн',
        'красивый гламурный костюм с новогодними блестками премиум-класса, кристаллы, элегантные детали, качественные материалы',
        'роскошный костюм для новогоднего праздника, новогодние украшения, дорогие материалы, стильный покрой',
        'стильный шикарный костюм премиум-класса, новогодние блестки, роскошные детали, элегантный дизайн',
        'элегантный гламурный костюм с новогодними элементами из дорогих материалов, кристаллы, качественный крой',
        'красивый роскошный костюм для новогоднего праздника, новогодние акценты, премиум-класс, стильные украшения',
        'роскошный костюм с новогодними блестками, дорогие материалы, элегантный покрой, изысканные детали',
        'стильный гламурный костюм премиум-класса для новогоднего праздника, новогодние украшения, качественный дизайн'
      ],
      'retro': [
        'роскошный винтажный костюм в новогоднем стиле 50-80х годов из дорогих материалов, ретро-детали, элегантный покрой',
        'стильный ретро костюм премиум-класса с новогодними мотивами, качественный крой, роскошные украшения',
        'элегантный старинный костюм для новогоднего праздника из дорогого бархата, новогодние элементы, стильный дизайн',
        'красивый винтажный костюм с новогодними мотивами премиум-класса, ретро-акценты, качественные материалы',
        'роскошный костюм в стиле 50-80х годов, новогодние узоры, элегантные детали, премиум-материалы',
        'стильный ретро костюм премиум-класса, новогодние элементы, дорогие украшения, стильный покрой',
        'элегантный винтажный костюм с новогодними мотивами, роскошные детали, качественный дизайн',
        'красивый костюм в ретро-стиле для новогоднего праздника, новогодние акценты, элегантный крой',
        'роскошный старинный костюм премиум-класса, новогодние узоры, дорогие материалы, стильный дизайн',
        'стильный ретро костюм для новогоднего праздника, новогодние мотивы, качественный покрой, элегантные детали'
      ],
      'midnight': [
        'роскошный элегантный костюм для встречи Нового года из дорогого бархата, изысканные детали, качественный крой',
        'стильный нарядный костюм премиум-класса для новогодней ночи, роскошные украшения, элегантный покрой',
        'элегантный праздничный костюм для полночи из дорогих материалов, новогодние элементы, стильный дизайн',
        'красивый костюм для встречи Нового года премиум-класса, новогодние акценты, качественные материалы',
        'роскошный костюм для новогодней ночи, элегантные детали, дорогие украшения, стильный покрой',
        'стильный костюм премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
        'элегантный костюм для полночи, новогодние элементы, премиум-класс, стильные детали',
        'красивый нарядный костюм для встречи Нового года, новогодние узоры, элегантный крой, дорогие материалы',
        'роскошный праздничный костюм премиум-класса, новогодние акценты, качественный покрой, стильные украшения',
        'стильный костюм для новогодней ночи, новогодние мотивы, дорогие детали, элегантный дизайн'
      ],
      'children': [
        'роскошный детский костюм с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
        'стильный веселый костюм премиум-класса для детского новогоднего праздника, элегантные детали, роскошные украшения',
        'элегантный детский костюм с новогодними элементами из качественного бархата, праздничные акценты',
        'красивый детский костюм с новогодними игрушками премиум-класса, новогодние мотивы, качественные материалы',
        'роскошный костюм для детского новогоднего праздника, новогодние элементы, стильный покрой, элегантные детали',
        'стильный детский костюм премиум-класса, новогодние узоры, дорогие украшения, качественный дизайн',
        'элегантный веселый костюм для детей, новогодние акценты, роскошные материалы, стильный крой',
        'красивый костюм для детского праздника с новогодними мотивами, премиум-класс, элегантный дизайн',
        'роскошный детский костюм с новогодними элементами, дорогие детали, стильный покрой, качественные материалы',
        'стильный костюм премиум-класса для детского новогоднего праздника, новогодние узоры, элегантный дизайн'
      ]
    }
  },
  
  // Одежда для взрослых женщин
  adultWoman: {
    'family': [
      'роскошное элегантное новогоднее платье из дорогого атласа красного или изумрудно-зеленого цвета с вышитыми новогодними узорами, кристаллы, качественный крой',
      'стильное нарядное платье премиум-класса с новогодними мотивами, праздничные аксессуары из дорогих материалов, элегантные детали',
      'элегантное красивое платье в новогодней тематике из качественного шелка, украшенное блестками и пайетками, роскошные украшения',
      'роскошное праздничное платье с новогодними элементами из дорогого бархата, элегантная обувь премиум-класса, стильный дизайн',
      'элегантное нарядное платье с новогодними украшениями, праздничные украшения из дорогих материалов, качественный покрой',
      'стильное платье из дорогого атласа с новогодними вышивками, роскошные детали, элегантный покрой, премиум-класс',
      'красивое платье с новогодними мотивами из качественного шелка, праздничные украшения, стильный дизайн, дорогие материалы',
      'роскошное платье с новогодними узорами из премиум-материалов, элегантные аксессуары, дорогие детали, качественный крой',
      'элегантное платье с новогодними элементами, качественный крой, стильные украшения, премиум-класс',
      'нарядное платье премиум-класса с новогодними мотивами, роскошные детали, элегантный стиль, дорогие материалы'
    ],
    'romantic': [
      'роскошное романтическое платье пастельных тонов из дорогого шелка с новогодними акцентами, нежные детали, качественный крой',
      'стильное нежное платье премиум-класса с новогодними элементами, элегантные аксессуары из дорогих материалов, роскошные украшения',
      'элегантное платье для романтического новогоднего вечера из качественного атласа, новогодние мотивы, стильный дизайн',
      'красивое романтическое платье пастельных тонов с новогодними акцентами, премиум-материалы, элегантный покрой',
      'роскошное платье для романтического вечера, новогодние элементы, качественные детали, стильный дизайн',
      'стильное нежное платье премиум-класса, новогодние акценты, роскошные украшения, элегантный крой',
      'элегантное романтическое платье с новогодними мотивами, дорогие материалы, качественный покрой, стильные детали',
      'красивое платье для романтического новогоднего вечера, новогодние узоры, премиум-класс, элегантный дизайн',
      'роскошное платье пастельных тонов с новогодними элементами, элегантные аксессуары, качественный крой',
      'стильное романтическое платье премиум-класса, новогодние акценты, дорогие материалы, элегантный стиль'
    ],
    'party': [
      'яркое роскошное платье с новогодними блестками и конфетти из дорогих материалов, праздничные детали, стильный дизайн',
      'стильное праздничное платье премиум-класса с новогодними колпаками, качественный крой, элегантные аксессуары',
      'элегантное веселое платье с новогодними узорами, роскошные украшения, праздничные аксессуары из дорогих материалов',
      'красивое платье с новогодними блестками из дорогого атласа, праздничные элементы, премиум-материалы, стильный покрой',
      'роскошное платье для новогодней вечеринки, яркие новогодние акценты, качественный покрой, элегантные детали',
      'стильное платье с новогодними узорами премиум-класса, элегантные детали, дорогие материалы, праздничный дизайн',
      'элегантное праздничное платье с новогодними элементами, роскошные украшения, стильный дизайн, качественный крой',
      'красивое платье для вечеринки с новогодними мотивами, качественные материалы, премиум-класс, элегантный покрой',
      'роскошное платье с новогодними блестками, элегантный крой, дорогие детали, стильные украшения',
      'стильное платье премиум-класса для новогоднего праздника, яркие акценты, качественный дизайн, роскошные материалы'
    ],
    'fairy-tale': [
      'роскошное сказочное платье как у Снегурочки из дорогого белого или голубого бархата, кристаллы, элегантный покрой',
      'стильное волшебное платье премиум-класса с новогодними звездами, роскошные украшения, качественные материалы',
      'элегантное сказочное платье с новогодними элементами из дорогого шелка, магические детали, стильный дизайн',
      'красивое платье в стиле Снегурочки из премиум-материалов, новогодние мотивы, роскошные украшения, элегантный крой',
      'роскошное волшебное платье с новогодними звездами, элегантный покрой, качественные детали, стильные акценты',
      'стильное сказочное платье премиум-класса, новогодние элементы, дорогие материалы, элегантный дизайн',
      'элегантное платье в сказочном стиле с новогодними мотивами, роскошные детали, стильный покрой, качественные материалы',
      'красивое платье как у Снегурочки из дорогого бархата, кристаллы, премиум-класс, элегантный крой',
      'роскошное волшебное платье с новогодними элементами, элегантный дизайн, качественные материалы, стильные украшения',
      'стильное сказочное платье премиум-класса, новогодние звезды, дорогие украшения, элегантный покрой'
    ],
    'elegant': [
      'роскошное элегантное вечернее платье с изысканными новогодними деталями из дорогого атласа, кристаллы Swarovski, качественный крой',
      'стильное роскошное платье премиум-класса для новогоднего праздника, дорогие украшения, элегантный покрой, изысканные детали',
      'элегантное нарядное платье классического покроя с новогодними акцентами из дорогих материалов, роскошные украшения, стильный дизайн',
      'красивое вечернее платье с изысканными новогодними деталями премиум-класса, элегантные акценты, качественные материалы',
      'роскошное платье для новогоднего праздника, новогодние элементы, элегантный покрой, дорогие украшения, премиум-класс',
      'стильное платье из дорогого шелка, изысканные новогодние детали, качественный дизайн, роскошные материалы',
      'элегантное платье классического покроя с новогодними мотивами, роскошные материалы, премиум-класс, стильный покрой',
      'красивое нарядное платье премиум-класса, новогодние акценты, стильный крой, элегантные детали, дорогие украшения',
      'роскошное платье для новогоднего праздника, изысканные новогодние элементы, качественный дизайн, элегантный покрой',
      'стильное элегантное платье из дорогих материалов, новогодние мотивы, премиум-класс, роскошные украшения, качественный крой'
    ],
    'playful': [
      'роскошное веселое платье с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
      'стильное игривое платье премиум-класса с новогодними узорами, элегантные детали, дорогие украшения',
      'элегантное динамичное платье для новогоднего праздника из качественного атласа, роскошные акценты, стильный покрой',
      'красивое платье с новогодними игрушками премиум-класса, праздничные мотивы, качественные материалы',
      'роскошное веселое платье для новогоднего праздника, новогодние элементы, элегантный дизайн',
      'стильное платье с новогодними узорами из дорогих материалов, игривые детали, премиум-класс',
      'элегантное динамичное платье премиум-класса, новогодние акценты, роскошные украшения, стильный крой',
      'красивое платье для праздника с новогодними мотивами, качественные материалы, элегантный дизайн',
      'роскошное игривое платье с новогодними элементами, дорогие детали, стильный покрой',
      'стильное платье премиум-класса для новогоднего праздника, новогодние узоры, качественный дизайн'
    ],
    'cozy': [
      'роскошное уютное платье с новогодними мотивами из дорогого кашемира, теплые качественные аксессуары, элегантный покрой',
      'стильное домашнее платье премиум-класса с новогодними узорами, комфортная обувь из качественных материалов, роскошные детали',
      'элегантное комфортное платье для новогоднего вечера дома из дорогих материалов, новогодние элементы, стильный дизайн',
      'красивое уютное платье с новогодними мотивами премиум-класса, теплые аксессуары, качественный крой',
      'роскошное домашнее платье для новогоднего вечера, новогодние узоры, элегантные детали, премиум-материалы',
      'стильное платье с новогодними элементами из дорогого бархата, комфортный покрой, качественные аксессуары',
      'элегантное уютное платье премиум-класса, новогодние мотивы, роскошные детали, стильный дизайн',
      'красивое платье для домашнего новогоднего вечера, новогодние акценты, качественные материалы, элегантный крой',
      'роскошное комфортное платье с новогодними элементами, дорогие материалы, стильный покрой',
      'стильное уютное платье премиум-класса для новогоднего вечера, новогодние узоры, качественный дизайн'
    ],
    'winter-tale': [
      'роскошное теплое зимнее платье с новогодними элементами из дорогих материалов, качественные варежки, элегантный покрой',
      'стильное зимнее платье премиум-класса с новогодними узорами, теплая обувь из качественных материалов, роскошные детали',
      'элегантное утепленное платье для зимней новогодней фотосессии из дорогого кашемира, новогодние мотивы, стильный дизайн',
      'красивое зимнее платье с новогодними элементами премиум-класса, теплые аксессуары, качественный крой',
      'роскошное платье для зимней фотосессии, новогодние узоры, элегантные детали, премиум-материалы',
      'стильное теплое платье с новогодними мотивами из дорогих материалов, качественные варежки, стильный покрой',
      'элегантное зимнее платье премиум-класса, новогодние акценты, роскошные детали, качественный дизайн',
      'красивое платье для зимней новогодней фотосессии, новогодние элементы, теплая обувь, элегантный крой',
      'роскошное утепленное платье с новогодними узорами, дорогие материалы, стильный покрой',
      'стильное зимнее платье премиум-класса для новогодней фотосессии, новогодние мотивы, качественный дизайн'
    ],
    'glamorous': [
      'роскошное гламурное платье с новогодними блестками из дорогих материалов, кристаллы Swarovski, роскошные аксессуары, элегантный покрой',
      'стильное роскошное платье премиум-класса для новогоднего праздника, дорогие украшения, качественный крой, изысканные детали',
      'элегантное шикарное платье с новогодними украшениями из дорогого бархата, роскошные аксессуары, стильный дизайн',
      'красивое гламурное платье с новогодними блестками премиум-класса, кристаллы, элегантные детали, качественные материалы',
      'роскошное платье для новогоднего праздника, новогодние украшения, дорогие материалы, стильный покрой, премиум-класс',
      'стильное шикарное платье премиум-класса, новогодние блестки, роскошные детали, элегантный дизайн',
      'элегантное гламурное платье с новогодними элементами из дорогих материалов, кристаллы, качественный крой',
      'красивое роскошное платье для новогоднего праздника, новогодние акценты, премиум-класс, стильные украшения',
      'роскошное платье с новогодними блестками, дорогие материалы, элегантный покрой, изысканные детали',
      'стильное гламурное платье премиум-класса для новогоднего праздника, новогодние украшения, качественный дизайн'
    ],
    'retro': [
      'роскошное винтажное платье в новогоднем стиле 50-80х годов из дорогих материалов, ретро-детали, элегантный покрой',
      'стильное ретро платье премиум-класса с новогодними мотивами, качественный крой, роскошные украшения',
      'элегантное старинное платье для новогоднего праздника из дорогого бархата, новогодние элементы, стильный дизайн',
      'красивое винтажное платье с новогодними мотивами премиум-класса, ретро-акценты, качественные материалы',
      'роскошное платье в стиле 50-80х годов, новогодние узоры, элегантные детали, премиум-материалы',
      'стильное ретро платье премиум-класса, новогодние элементы, дорогие украшения, стильный покрой',
      'элегантное винтажное платье с новогодними мотивами, роскошные детали, качественный дизайн',
      'красивое платье в ретро-стиле для новогоднего праздника, новогодние акценты, элегантный крой',
      'роскошное старинное платье премиум-класса, новогодние узоры, дорогие материалы, стильный дизайн',
      'стильное ретро платье для новогоднего праздника, новогодние мотивы, качественный покрой, элегантные детали'
    ],
    'midnight': [
      'роскошное элегантное вечернее платье для встречи Нового года из дорогого атласа, изысканные детали, качественный крой',
      'стильное нарядное платье премиум-класса для новогодней ночи, роскошные украшения, элегантный покрой',
      'элегантное праздничное платье для полночи из дорогих материалов, новогодние элементы, стильный дизайн',
      'красивое вечернее платье для встречи Нового года премиум-класса, новогодние акценты, качественные материалы',
      'роскошное платье для новогодней ночи, элегантные детали, дорогие украшения, стильный покрой',
      'стильное вечернее платье премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
      'элегантное платье для полночи, новогодние элементы, премиум-класс, стильные детали',
      'красивое нарядное платье для встречи Нового года, новогодние узоры, элегантный крой, дорогие материалы',
      'роскошное праздничное платье премиум-класса, новогодние акценты, качественный покрой, стильные украшения',
      'стильное вечернее платье для новогодней ночи, новогодние мотивы, дорогие детали, элегантный дизайн'
    ],
    'children': [
      'роскошное детское платье с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
      'стильное веселое платье премиум-класса для детского новогоднего праздника, элегантные детали, роскошные украшения',
      'элегантное детское платье с новогодними элементами из качественного атласа, праздничные акценты',
      'красивое детское платье с новогодними игрушками премиум-класса, новогодние мотивы, качественные материалы',
      'роскошное платье для детского новогоднего праздника, новогодние элементы, стильный покрой, элегантные детали',
      'стильное детское платье премиум-класса, новогодние узоры, дорогие украшения, качественный дизайн',
      'элегантное веселое платье для детей, новогодние акценты, роскошные материалы, стильный крой',
      'красивое платье для детского праздника с новогодними мотивами, премиум-класс, элегантный дизайн',
      'роскошное детское платье с новогодними элементами, дорогие детали, стильный покрой, качественные материалы',
      'стильное платье премиум-класса для детского новогоднего праздника, новогодние узоры, элегантный дизайн'
    ]
  },
  
  // Одежда для взрослых мужчин
  adultMan: {
    'family': [
      'роскошный элегантный новогодний свитер из дорогого кашемира красного или изумрудно-зеленого цвета с вышитыми новогодними узорами, качественный крой',
      'стильный нарядный свитер премиум-класса с новогодними мотивами, праздничная рубашка из дорогих материалов, элегантные детали',
      'элегантный красивый свитер в новогодней тематике из качественного мериноса, классические брюки премиум-класса, стильный дизайн',
      'роскошный праздничный свитер с новогодними элементами из дорогого кашемира, элегантная обувь премиум-класса, роскошные аксессуары',
      'элегантный нарядный свитер с новогодними украшениями, праздничные аксессуары из дорогих материалов, качественный покрой',
      'стильный свитер из дорогого кашемира с новогодними вышивками, роскошные детали, элегантный покрой, премиум-класс',
      'красивый свитер с новогодними мотивами из качественного мериноса, праздничные украшения, стильный дизайн, дорогие материалы',
      'роскошный свитер с новогодними узорами из премиум-материалов, элегантные аксессуары, дорогие детали, качественный крой',
      'элегантный свитер с новогодними элементами, качественный крой, стильные украшения, премиум-класс',
      'нарядный свитер премиум-класса с новогодними мотивами, роскошные детали, элегантный стиль, дорогие материалы'
    ],
    'romantic': [
      'роскошный элегантный свитер пастельных тонов из дорогого кашемира с новогодними акцентами, нежные детали, качественный крой',
      'стильный нежный свитер премиум-класса с новогодними элементами, элегантные аксессуары из дорогих материалов, роскошные украшения',
      'элегантный романтический свитер для новогоднего вечера из качественного мериноса, новогодние мотивы, стильный дизайн',
      'красивый свитер пастельных тонов с новогодними акцентами, премиум-материалы, элегантный покрой',
      'роскошный свитер для романтического вечера, новогодние элементы, качественные детали, стильный дизайн',
      'стильный нежный свитер премиум-класса, новогодние акценты, роскошные украшения, элегантный крой',
      'элегантный романтический свитер с новогодними мотивами, дорогие материалы, качественный покрой, стильные детали',
      'красивый свитер для романтического новогоднего вечера, новогодние узоры, премиум-класс, элегантный дизайн',
      'роскошный свитер пастельных тонов с новогодними элементами, элегантные аксессуары, качественный крой',
      'стильный романтический свитер премиум-класса, новогодние акценты, дорогие материалы, элегантный стиль'
    ],
    'party': [
      'яркий роскошный свитер с новогодними блестками из дорогих материалов, праздничные детали, стильный дизайн',
      'стильный праздничный свитер премиум-класса с новогодними колпаками, качественный крой, элегантные аксессуары',
      'элегантный веселый свитер с новогодними узорами, роскошные украшения, стильный дизайн',
      'красивый свитер с новогодними блестками из дорогого кашемира, праздничные элементы, премиум-материалы',
      'роскошный свитер для новогодней вечеринки, яркие новогодние акценты, качественный покрой',
      'стильный свитер с новогодними узорами премиум-класса, элегантные детали, дорогие материалы',
      'элегантный праздничный свитер с новогодними элементами, роскошные украшения, стильный дизайн',
      'красивый свитер для вечеринки с новогодними мотивами, качественные материалы, премиум-класс',
      'роскошный свитер с новогодними блестками, элегантный крой, дорогие детали',
      'стильный свитер премиум-класса для новогоднего праздника, яркие акценты, качественный дизайн'
    ],
    'fairy-tale': [
      'роскошный сказочный костюм с новогодними элементами из дорогого бархата, кристаллы, элегантный покрой',
      'стильный волшебный свитер премиум-класса с новогодними звездами, роскошные украшения, качественные материалы',
      'элегантный сказочный наряд для новогоднего праздника из дорогих материалов, магические детали, стильный дизайн',
      'красивый костюм в сказочном стиле из премиум-материалов, новогодние мотивы, роскошные украшения',
      'роскошный волшебный наряд с новогодними звездами, элегантный покрой, качественные детали',
      'стильный сказочный костюм премиум-класса, новогодние элементы, дорогие материалы',
      'элегантный наряд в сказочном стиле с новогодними мотивами, роскошные детали, стильный покрой',
      'красивый сказочный костюм из дорогого бархата, кристаллы, премиум-класс',
      'роскошный волшебный наряд с новогодними элементами, элегантный дизайн, качественные материалы',
      'стильный сказочный костюм премиум-класса, новогодние звезды, дорогие украшения'
    ],
    'elegant': [
      'роскошный элегантный костюм с изысканными новогодними деталями из дорогого бархата, качественный крой',
      'стильный роскошный костюм премиум-класса для новогоднего праздника, дорогие украшения, элегантный покрой, изысканные детали',
      'элегантный нарядный костюм классического покроя с новогодними акцентами из дорогих материалов, роскошные украшения',
      'красивый костюм с изысканными новогодними деталями премиум-класса, элегантные акценты, качественные материалы',
      'роскошный костюм для новогоднего праздника, новогодние элементы, элегантный покрой, дорогие украшения',
      'стильный костюм из дорогого сукна, изысканные новогодние детали, качественный дизайн, роскошные материалы',
      'элегантный костюм классического покроя с новогодними мотивами, роскошные материалы, премиум-класс',
      'красивый нарядный костюм премиум-класса, новогодние акценты, стильный крой, элегантные детали',
      'роскошный костюм для новогоднего праздника, изысканные новогодние элементы, качественный дизайн',
      'стильный элегантный костюм из дорогих материалов, новогодние мотивы, премиум-класс, роскошные украшения'
    ],
    'playful': [
      'роскошный веселый свитер с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
      'стильный игривый свитер премиум-класса с новогодними узорами, элегантные детали, дорогие украшения',
      'элегантный динамичный наряд для новогоднего праздника из качественного кашемира, роскошные акценты',
      'красивый свитер с новогодними игрушками премиум-класса, праздничные мотивы, качественные материалы',
      'роскошный веселый наряд для новогоднего праздника, новогодние элементы, элегантный дизайн',
      'стильный свитер с новогодними узорами из дорогих материалов, игривые детали, премиум-класс',
      'элегантный динамичный наряд премиум-класса, новогодние акценты, роскошные украшения, стильный крой',
      'красивый наряд для праздника с новогодними мотивами, качественные материалы, элегантный дизайн',
      'роскошный игривый наряд с новогодними элементами, дорогие детали, стильный покрой',
      'стильный наряд премиум-класса для новогоднего праздника, новогодние узоры, качественный дизайн'
    ],
    'cozy': [
      'роскошный уютный свитер с новогодними мотивами из дорогого кашемира, теплые качественные аксессуары, элегантный покрой',
      'стильный домашний свитер премиум-класса с новогодними узорами, комфортная обувь из качественных материалов, роскошные детали',
      'элегантный комфортный наряд для новогоднего вечера дома из дорогих материалов, новогодние элементы, стильный дизайн',
      'красивый уютный свитер с новогодними мотивами премиум-класса, теплые аксессуары, качественный крой',
      'роскошный домашний наряд для новогоднего вечера, новогодние узоры, элегантные детали, премиум-материалы',
      'стильный свитер с новогодними элементами из дорогого кашемира, комфортный покрой, качественные аксессуары',
      'элегантный уютный наряд премиум-класса, новогодние мотивы, роскошные детали, стильный дизайн',
      'красивый наряд для домашнего новогоднего вечера, новогодние акценты, качественные материалы, элегантный крой',
      'роскошный комфортный наряд с новогодними элементами, дорогие материалы, стильный покрой',
      'стильный уютный наряд премиум-класса для новогоднего вечера, новогодние узоры, качественный дизайн'
    ],
    'winter-tale': [
      'роскошный теплый зимний свитер с новогодними элементами из дорогих материалов, качественные варежки, элегантный покрой',
      'стильный зимний свитер премиум-класса с новогодними узорами, теплая обувь из качественных материалов, роскошные детали',
      'элегантный утепленный наряд для зимней новогодней фотосессии из дорогого кашемира, новогодние мотивы, стильный дизайн',
      'красивый зимний наряд с новогодними элементами премиум-класса, теплые аксессуары, качественный крой',
      'роскошный наряд для зимней фотосессии, новогодние узоры, элегантные детали, премиум-материалы',
      'стильный теплый наряд с новогодними мотивами из дорогих материалов, качественные варежки, стильный покрой',
      'элегантный зимний наряд премиум-класса, новогодние акценты, роскошные детали, качественный дизайн',
      'красивый наряд для зимней новогодней фотосессии, новогодние элементы, теплая обувь, элегантный крой',
      'роскошный утепленный наряд с новогодними узорами, дорогие материалы, стильный покрой',
      'стильный зимний наряд премиум-класса для новогодней фотосессии, новогодние мотивы, качественный дизайн'
    ],
    'glamorous': [
      'роскошный гламурный костюм с новогодними блестками из дорогих материалов, кристаллы Swarovski, элегантный покрой',
      'стильный роскошный костюм премиум-класса для новогоднего праздника, дорогие украшения, качественный крой, изысканные детали',
      'элегантный шикарный наряд с новогодними украшениями из дорогого бархата, роскошные аксессуары, стильный дизайн',
      'красивый гламурный костюм с новогодними блестками премиум-класса, кристаллы, элегантные детали, качественные материалы',
      'роскошный костюм для новогоднего праздника, новогодние украшения, дорогие материалы, стильный покрой',
      'стильный шикарный костюм премиум-класса, новогодние блестки, роскошные детали, элегантный дизайн',
      'элегантный гламурный костюм с новогодними элементами из дорогих материалов, кристаллы, качественный крой',
      'красивый роскошный костюм для новогоднего праздника, новогодние акценты, премиум-класс, стильные украшения',
      'роскошный костюм с новогодними блестками, дорогие материалы, элегантный покрой, изысканные детали',
      'стильный гламурный костюм премиум-класса для новогоднего праздника, новогодние украшения, качественный дизайн'
    ],
    'retro': [
      'роскошный винтажный костюм в новогоднем стиле 50-80х годов из дорогих материалов, ретро-детали, элегантный покрой',
      'стильный ретро костюм премиум-класса с новогодними мотивами, качественный крой, роскошные украшения',
      'элегантный старинный наряд для новогоднего праздника из дорогого бархата, новогодние элементы, стильный дизайн',
      'красивый винтажный костюм с новогодними мотивами премиум-класса, ретро-акценты, качественные материалы',
      'роскошный костюм в стиле 50-80х годов, новогодние узоры, элегантные детали, премиум-материалы',
      'стильный ретро костюм премиум-класса, новогодние элементы, дорогие украшения, стильный покрой',
      'элегантный винтажный костюм с новогодними мотивами, роскошные детали, качественный дизайн',
      'красивый костюм в ретро-стиле для новогоднего праздника, новогодние акценты, элегантный крой',
      'роскошный старинный костюм премиум-класса, новогодние узоры, дорогие материалы, стильный дизайн',
      'стильный ретро костюм для новогоднего праздника, новогодние мотивы, качественный покрой, элегантные детали'
    ],
    'midnight': [
      'роскошный элегантный костюм для встречи Нового года из дорогого бархата, изысканные детали, качественный крой',
      'стильный нарядный костюм премиум-класса для новогодней ночи, роскошные украшения, элегантный покрой',
      'элегантный праздничный наряд для полночи из дорогих материалов, новогодние элементы, стильный дизайн',
      'красивый костюм для встречи Нового года премиум-класса, новогодние акценты, качественные материалы',
      'роскошный костюм для новогодней ночи, элегантные детали, дорогие украшения, стильный покрой',
      'стильный костюм премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
      'элегантный наряд для полночи, новогодние элементы, премиум-класс, стильные детали',
      'красивый нарядный костюм для встречи Нового года, новогодние узоры, элегантный крой, дорогие материалы',
      'роскошный праздничный костюм премиум-класса, новогодние акценты, качественный покрой, стильные украшения',
      'стильный костюм для новогодней ночи, новогодние мотивы, дорогие детали, элегантный дизайн'
    ],
    'children': [
      'роскошный детский свитер с новогодними игрушками из дорогих материалов, стильный дизайн, качественный крой',
      'стильный веселый наряд премиум-класса для детского новогоднего праздника, элегантные детали, роскошные украшения',
      'элегантный детский наряд с новогодними элементами из качественного кашемира, праздничные акценты',
      'красивый детский свитер с новогодними игрушками премиум-класса, новогодние мотивы, качественные материалы',
      'роскошный наряд для детского новогоднего праздника, новогодние элементы, стильный покрой, элегантные детали',
      'стильный детский наряд премиум-класса, новогодние узоры, дорогие украшения, качественный дизайн',
      'элегантный веселый наряд для детей, новогодние акценты, роскошные материалы, стильный крой',
      'красивый наряд для детского праздника с новогодними мотивами, премиум-класс, элегантный дизайн',
      'роскошный детский наряд с новогодними элементами, дорогие детали, стильный покрой, качественные материалы',
      'стильный наряд премиум-класса для детского новогоднего праздника, новогодние узоры, элегантный дизайн'
    ]
  },
  
  // Одежда для пожилых
  elderly: {
    woman: {
      'family': [
        'роскошное элегантное новогоднее платье классического покроя из дорогого бархата с вышитыми новогодними узорами, качественный крой',
        'стильное нарядное платье премиум-класса с новогодними мотивами, праздничные аксессуары из дорогих материалов, элегантные детали',
        'элегантное красивое платье в новогодней тематике из качественного шелка, элегантная обувь премиум-класса, роскошные украшения',
        'красивое платье классического покроя с новогодними узорами, роскошные детали, качественные материалы, стильный дизайн',
        'роскошное платье с новогодними мотивами премиум-класса, элегантные аксессуары, дорогие детали, качественный покрой',
        'стильное платье из дорогого бархата с новогодними вышивками, роскошные детали, элегантный покрой, премиум-класс',
        'элегантное платье с новогодними элементами, качественный крой, стильные украшения, дорогие материалы',
        'красивое нарядное платье премиум-класса, новогодние акценты, роскошные детали, элегантный стиль',
        'роскошное платье для новогоднего праздника, новогодние узоры, элегантные детали, премиум-материалы',
        'стильное элегантное платье классического покроя, новогодние мотивы, качественный дизайн, дорогие украшения'
      ],
      'romantic': [
        'роскошное романтическое платье пастельных тонов из дорогого шелка, новогодние акценты, элегантный покрой',
        'стильное нежное платье премиум-класса с новогодними элементами, элегантные детали, дорогие материалы',
        'элегантное платье пастельных тонов с новогодними мотивами, роскошные украшения, качественный крой',
        'красивое романтическое платье премиум-класса, новогодние акценты, стильный дизайн, элегантные детали',
        'роскошное платье для романтического вечера, новогодние элементы, качественные материалы, стильный покрой',
        'стильное нежное платье с новогодними узорами, дорогие украшения, элегантный крой, премиум-класс',
        'элегантное платье пастельных тонов, новогодние мотивы, роскошные детали, качественный дизайн',
        'красивое романтическое платье премиум-класса, новогодние акценты, элегантный стиль, дорогие материалы'
      ],
      'cozy': [
        'роскошное уютное платье с новогодними мотивами из дорогого кашемира, теплые аксессуары, элегантный покрой',
        'стильное домашнее платье премиум-класса с новогодними узорами, комфортная обувь, роскошные детали',
        'элегантное платье с новогодними элементами, качественные материалы, стильный дизайн, премиум-класс',
        'красивое уютное платье премиум-класса, новогодние мотивы, элегантные детали, качественный покрой',
        'роскошное домашнее платье для новогоднего вечера, новогодние узоры, стильные аксессуары, дорогие материалы',
        'стильное платье с новогодними элементами, комфортный покрой, элегантные детали, премиум-класс',
        'элегантное уютное платье премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
        'красивое платье для домашнего вечера, новогодние акценты, элегантный крой, дорогие детали'
      ],
      'elegant': [
        'роскошное элегантное платье с изысканными новогодними деталями из дорогого бархата, качественный крой',
        'стильное роскошное платье премиум-класса для новогоднего праздника, дорогие украшения, элегантный покрой',
        'элегантное платье с новогодними элементами, роскошные материалы, стильный дизайн, премиум-класс',
        'красивое платье премиум-класса, новогодние акценты, элегантные детали, качественный покрой',
        'роскошное платье для новогоднего праздника, изысканные новогодние элементы, дорогие материалы, стильный дизайн',
        'стильное элегантное платье премиум-класса, новогодние мотивы, роскошные украшения, качественный крой',
        'элегантное платье с новогодними узорами, дорогие материалы, стильный покрой, премиум-класс',
        'красивое роскошное платье для новогоднего праздника, новогодние акценты, элегантный дизайн, качественные детали'
      ]
    },
    man: {
      'family': [
        'роскошный элегантный новогодний костюм классического покроя из дорогого бархата с вышитыми новогодними узорами, качественный крой',
        'стильный нарядный костюм премиум-класса с новогодними мотивами, праздничная рубашка из дорогих материалов, элегантные детали',
        'элегантный красивый костюм в новогодней тематике из качественного сукна, роскошные украшения, стильный дизайн',
        'красивый костюм классического покроя с новогодними узорами, роскошные детали, качественные материалы, элегантный покрой',
        'роскошный костюм с новогодними мотивами премиум-класса, элегантные аксессуары, дорогие детали, качественный крой',
        'стильный костюм из дорогого бархата с новогодними вышивками, роскошные детали, элегантный покрой, премиум-класс',
        'элегантный костюм с новогодними элементами, качественный крой, стильные украшения, дорогие материалы',
        'красивый нарядный костюм премиум-класса, новогодние акценты, роскошные детали, элегантный стиль',
        'роскошный костюм для новогоднего праздника, новогодние узоры, элегантные детали, премиум-материалы',
        'стильный элегантный костюм классического покроя, новогодние мотивы, качественный дизайн, дорогие украшения'
      ],
      'romantic': [
        'роскошный элегантный костюм пастельных тонов из дорогого бархата, новогодние акценты, качественный покрой',
        'стильный нежный костюм премиум-класса с новогодними элементами, элегантные детали, дорогие материалы',
        'элегантный костюм пастельных тонов с новогодними мотивами, роскошные украшения, качественный крой',
        'красивый романтический костюм премиум-класса, новогодние акценты, стильный дизайн, элегантные детали',
        'роскошный костюм для романтического вечера, новогодние элементы, качественные материалы, стильный покрой',
        'стильный нежный костюм с новогодними узорами, дорогие украшения, элегантный крой, премиум-класс',
        'элегантный костюм пастельных тонов, новогодние мотивы, роскошные детали, качественный дизайн',
        'красивый романтический костюм премиум-класса, новогодние акценты, элегантный стиль, дорогие материалы'
      ],
      'cozy': [
        'роскошный уютный свитер с новогодними мотивами из дорогого кашемира, теплые аксессуары, элегантный покрой',
        'стильный домашний костюм премиум-класса с новогодними узорами, комфортная обувь, роскошные детали',
        'элегантный костюм с новогодними элементами, качественные материалы, стильный дизайн, премиум-класс',
        'красивый уютный костюм премиум-класса, новогодние мотивы, элегантные детали, качественный покрой',
        'роскошный домашний костюм для новогоднего вечера, новогодние узоры, стильные аксессуары, дорогие материалы',
        'стильный костюм с новогодними элементами, комфортный покрой, элегантные детали, премиум-класс',
        'элегантный уютный костюм премиум-класса, новогодние мотивы, роскошные материалы, качественный дизайн',
        'красивый костюм для домашнего вечера, новогодние акценты, элегантный крой, дорогие детали'
      ],
      'elegant': [
        'роскошный элегантный костюм с изысканными новогодними деталями из дорогого бархата, качественный крой',
        'стильный роскошный костюм премиум-класса для новогоднего праздника, дорогие украшения, элегантный покрой',
        'элегантный костюм с новогодними элементами, роскошные материалы, стильный дизайн, премиум-класс',
        'красивый костюм премиум-класса, новогодние акценты, элегантные детали, качественный покрой',
        'роскошный костюм для новогоднего праздника, изысканные новогодние элементы, дорогие материалы, стильный дизайн',
        'стильный элегантный костюм премиум-класса, новогодние мотивы, роскошные украшения, качественный крой',
        'элегантный костюм с новогодними узорами, дорогие материалы, стильный покрой, премиум-класс',
        'красивый роскошный костюм для новогоднего праздника, новогодние акценты, элегантный дизайн, качественные детали'
      ]
    }
  }
};

/**
 * Генерирует описание новогодней одежды для промпта
 * Добавляет головные уборы случайным образом на 0, 1 или 2 изображения из 6
 * Добавляет узоры на одежду случайным образом на 0, 1 или 2 изображения из 6
 */
function generateNewYearAttire(analysisResult, styleId, variationIndex, shouldAddHeadwear = false, shouldAddPatterns = false) {
  const { people } = analysisResult;
  
  if (!people || people.length === 0) {
    return 'новогодний наряд, соответствующий выбранному стилю';
  }
  
  const attireDescriptions = [];
  const headwearDescriptions = [];
  
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const age = person.age || 'adult';
    const gender = person.gender || 'unknown';
    
    let attirePool = [];
    let headwearPool = [];
    
    // Определяем пул одежды в зависимости от возраста и пола
    if (age === 'child') {
      if (gender === 'female' && NEW_YEAR_ATTIRE.child.girl[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.child.girl[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.child.girl || [];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.child.boy[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.child.boy[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.child.boy || [];
      } else {
        attirePool = NEW_YEAR_ATTIRE.child.girl[styleId] || NEW_YEAR_ATTIRE.child.boy[styleId] || ['новогодний наряд'];
        headwearPool = NEW_YEAR_HEADWEAR.child.girl || NEW_YEAR_HEADWEAR.child.boy || [];
      }
    } else if (age === 'elderly') {
      if (gender === 'female' && NEW_YEAR_ATTIRE.elderly.woman[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.elderly.woman[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.elderly.woman || [];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.elderly.man[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.elderly.man[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.elderly.man || [];
      } else {
        attirePool = NEW_YEAR_ATTIRE.elderly.woman[styleId] || NEW_YEAR_ATTIRE.elderly.man[styleId] || ['новогодний наряд'];
        headwearPool = NEW_YEAR_HEADWEAR.elderly.woman || NEW_YEAR_HEADWEAR.elderly.man || [];
      }
    } else {
      // Взрослые
      if (gender === 'female' && NEW_YEAR_ATTIRE.adultWoman[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.adultWoman[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.adultWoman || [];
      } else if (gender === 'male' && NEW_YEAR_ATTIRE.adultMan[styleId]) {
        attirePool = NEW_YEAR_ATTIRE.adultMan[styleId];
        headwearPool = NEW_YEAR_HEADWEAR.adultMan || [];
      } else {
        attirePool = NEW_YEAR_ATTIRE.adultWoman[styleId] || NEW_YEAR_ATTIRE.adultMan[styleId] || ['новогодний наряд'];
        headwearPool = NEW_YEAR_HEADWEAR.adultWoman || NEW_YEAR_HEADWEAR.adultMan || [];
      }
    }
    
    // Выбираем уникальную одежду для каждого человека
    // Используем variationIndex напрямую для гарантии разных одежд на каждом из 6 изображений
    // Для каждого человека используем комбинацию variationIndex и индекса человека
    const uniqueAttire = getUniqueItems(attirePool, 6);
    // Гарантируем разные индексы для каждого изображения (variationIndex 0-5) и каждого человека
    const selectedAttireIndex = (variationIndex + i * 6) % uniqueAttire.length;
    let selectedAttire = uniqueAttire[selectedAttireIndex];
    
    // Тщательно убираем все упоминания узоров из описания одежды по умолчанию
    selectedAttire = selectedAttire.replace(/с новогодними узорами/gi, '');
    selectedAttire = selectedAttire.replace(/новогодними узорами/gi, 'новогодними элементами');
    selectedAttire = selectedAttire.replace(/новогодние узоры/gi, 'новогодние элементы');
    selectedAttire = selectedAttire.replace(/вышитыми.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/декоративными.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/праздничными.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/элегантными.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/стильными.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/роскошными.*узорами/gi, '');
    selectedAttire = selectedAttire.replace(/\(елочки.*?\)/gi, '');
    selectedAttire = selectedAttire.replace(/\(снежинки.*?\)/gi, '');
    selectedAttire = selectedAttire.replace(/\(звезды.*?\)/gi, '');
    selectedAttire = selectedAttire.replace(/\(елочные ветки.*?\)/gi, '');
    selectedAttire = selectedAttire.replace(/  +/g, ' ').trim(); // Убираем двойные пробелы
    
    // Добавляем узоры ТОЛЬКО если shouldAddPatterns = true
    // Это должно быть только на 0, 1 или 2 фото из 6
    if (shouldAddPatterns === true) {
      // Добавляем описание узоров в зависимости от стиля
      const patternDescriptions = [
        'с вышитыми новогодними узорами (елочки, снежинки, звезды)',
        'с декоративными новогодними узорами (снежинки, елочные ветки)',
        'с праздничными новогодними узорами (звезды, снежинки)',
        'с элегантными новогодними узорами (елочки, снежинки)',
        'с стильными новогодними узорами (звезды, елочные ветки)',
        'с роскошными новогодними узорами (снежинки, елочки)'
      ];
      const patternIndex = (variationIndex + i * 6) % patternDescriptions.length;
      const patternText = patternDescriptions[patternIndex];
      
      // Добавляем узоры в описание одежды
      if (selectedAttire.includes('платье')) {
        selectedAttire = selectedAttire.replace(/платье/, `платье ${patternText}`);
      } else if (selectedAttire.includes('костюм')) {
        selectedAttire = selectedAttire.replace(/костюм/, `костюм ${patternText}`);
      } else if (selectedAttire.includes('свитер')) {
        selectedAttire = selectedAttire.replace(/свитер/, `свитер ${patternText}`);
      } else if (selectedAttire.includes('наряд')) {
        selectedAttire = selectedAttire.replace(/наряд/, `наряд ${patternText}`);
      } else {
        selectedAttire = `${selectedAttire}, ${patternText}`;
      }
    }
    
    attireDescriptions.push(selectedAttire);
    
    // Добавляем головные уборы на 1-2 изображениях из 6
    if (shouldAddHeadwear === true && headwearPool.length > 0) {
      const uniqueHeadwear = getUniqueItems(headwearPool, 6);
      const selectedHeadwearIndex = (variationIndex + i * 6) % uniqueHeadwear.length;
      const selectedHeadwear = uniqueHeadwear[selectedHeadwearIndex];
      headwearDescriptions.push(selectedHeadwear);
    }
  }
  
  // Формируем итоговое описание
  let result = '';
  
  // Если несколько человек, объединяем описания одежды
  if (attireDescriptions.length > 1) {
    result = `Одежда: ${attireDescriptions.join('; ')}. Каждый человек в уникальном новогоднем наряде премиум-класса, соответствующим выбранному стилю.`;
  } else {
    result = `Одежда: ${attireDescriptions[0] || 'новогодний наряд, соответствующий выбранному стилю'}.`;
  }
  
  // Добавляем описание головных уборов, если нужно
  if (shouldAddHeadwear && headwearDescriptions.length > 0) {
    if (headwearDescriptions.length > 1) {
      result += ` Головные уборы: ${headwearDescriptions.join('; ')}.`;
    } else {
      result += ` Головной убор: ${headwearDescriptions[0]}.`;
    }
  }
  
  return result;
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
  
  // 5. Случайно определяем, на каких изображениях будут головные уборы (0, 1 или 2 изображения)
  const headwearCount = randomChoice([0, 1, 2]); // Случайное количество: 0, 1 или 2
  const headwearIndices = [];
  if (headwearCount > 0) {
    // Создаем массив индексов от 0 до 5 и перемешиваем
    const allIndices = [0, 1, 2, 3, 4, 5];
    const shuffledIndices = shuffleArray([...allIndices]);
    // Выбираем первые headwearCount индексов
    headwearIndices.push(...shuffledIndices.slice(0, headwearCount));
  }
  
  // 5.1. Случайно определяем, на каких изображениях будут узоры на одежде (0, 1 или 2 изображения)
  const patternsCount = randomChoice([0, 1, 2]); // Случайное количество: 0, 1 или 2
  const patternsIndices = [];
  if (patternsCount > 0) {
    // Создаем массив индексов от 0 до 5 и перемешиваем
    const allIndices = [0, 1, 2, 3, 4, 5];
    const shuffledIndices = shuffleArray([...allIndices]);
    // Выбираем первые patternsCount индексов
    patternsIndices.push(...shuffledIndices.slice(0, patternsCount));
  }
  
  // 6. Генерируем 6 промптов с разными вариациями
  const prompts = [];
  
  for (let i = 0; i < 6; i++) {
    // Выбираем вариации для этого промпта
    const variations = selectVariations(categoryId, styleId, locationId, i, analysisResult);
    
    // Генерируем описание одежды для этого промпта (передаем информацию о головных уборах и узорах)
    // Важно: передаем variationIndex = i для гарантии разных одежд на каждом изображении
    const attireDescription = generateNewYearAttire(analysisResult, styleId, i, headwearIndices.includes(i), patternsIndices.includes(i));
    
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
    
    // Добавляем инструкцию о запрете других людей и животных
    prompt += ` КРИТИЧЕСКИ ВАЖНО: На фото должны быть ТОЛЬКО люди и животные из исходного изображения. НЕ добавлять других людей, НЕ добавлять других животных, НЕ добавлять посторонних персонажей. Только те, кто присутствует в исходном фото.`;
    
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
