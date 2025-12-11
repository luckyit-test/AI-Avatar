/**
 * Prompt building service for portrait generation
 */
import { describeRole, describeCompany, attireByContext } from './promptUtils.js';

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildPortraitPrompts(gender, role, company) {
  const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];
  
  if (!gender || (gender !== 'male' && gender !== 'female')) {
    throw new Error('Пол должен быть выбран перед генерацией');
  }
  
  const constraints = gender === 'female'
    ? 'No facial hair. No beard. No mustache.'
    : 'CRITICAL FACIAL HAIR PRESERVATION: You MUST preserve the facial hair EXACTLY as shown in the original photo - including style, length, thickness, density, and visibility. If the person is clean-shaven (no beard, no mustache) in the original photo, the generated portrait MUST also be clean-shaven with NO facial hair. If the person has a short, subtle, barely visible beard in the original, the generated portrait MUST have the EXACT SAME short, subtle, barely visible beard - do NOT make it longer, thicker, denser, or more prominent.';
  
  const genderInstruction = gender === 'male' 
    ? 'CRITICAL: This is a MALE person. Generate a MALE portrait. The person must be clearly male with masculine features. Do NOT generate a female portrait.'
    : 'CRITICAL: This is a FEMALE person. Generate a FEMALE portrait. The person must be clearly female with feminine features. Do NOT generate a male portrait.';
  
  const facialHairPreservation = gender === 'male'
    ? 'CRITICAL FACIAL HAIR RULE: Maintain the EXACT same facial hair style, length, thickness, density, and visibility as in the original photo. If the original shows a short, subtle, barely visible beard - keep it EXACTLY short, subtle, and barely visible. If clean-shaven in original, generate clean-shaven. Do NOT lengthen, thicken, densify, or enhance facial hair beyond what is visible in the original photo.'
    : '';

  const variability = 'high';
  const naturalLook = true;

  // Генерируем 6 разных вариантов одежды с гарантией минимум 3 уникальных
  const attireVariants = generateAttireVariants(gender, role, company, 6);
  const roleDesc = describeRole(role);
  const companyDesc = describeCompany(company);

  function buildVariations(variabilityLevel) {
    const lightingNeutral = [
      'soft, even high-key lighting',
      'natural window light with soft shadows',
    ];
    const lightingExtra = [
      'dramatic low-key with subtle rim light',
      'golden-hour warm light (indoor simulation)',
      'overcast soft daylight look',
    ];
    const lensNeutral = [
      '85mm head-and-shoulders',
      '50mm three-quarters crop',
    ];
    const lensExtra = [
      '35mm environmental portrait',
    ];
    const backgroundNeutral = [
      'neutral gradient backdrop',
      'modern office, shallow depth of field',
      'textured light wall',
    ];
    const backgroundExtra = [
      'outdoor city bokeh',
      'glass office corridor, soft blur',
      'wooden texture wall, subtle',
    ];
    const gradeNeutral = [
      'clean editorial grade',
      'neutral corporate grade',
    ];
    const gradeExtra = [
      'warm cinematic grade',
      'cool corporate grade',
      'black and white, high micro-contrast',
    ];
    const poseNeutral = [
      'facing camera, subtle smile or neutral confident expression, shoulders square to camera',
      'three-quarter angle to the camera, relaxed shoulders, confident but approachable posture',
      'head slightly tilted, shoulders relaxed, direct gaze to camera',
    ];
    const poseExtra = [
      'slightly off-camera gaze, natural candid feel with the body turned about 30 degrees',
      'looking slightly past the camera with a gentle head tilt and relaxed posture',
      'subtle lean forward toward the camera, confident upright posture',
    ];

    const pick = (neutral, extra) => {
      if (variabilityLevel === 'low') return neutral[0];
      if (variabilityLevel === 'medium') return randomChoice(neutral);
      return randomChoice([...neutral, ...extra]);
    };

    return {
      lighting: pick(lightingNeutral, lightingExtra),
      lens: pick(lensNeutral, lensExtra),
      background: pick(backgroundNeutral, backgroundExtra),
      grade: pick(gradeNeutral, gradeExtra),
      pose: pick(poseNeutral, poseExtra),
    };
  }

  const naturality = naturalLook
    ? "Photorealistic and authentic. Preserve identity and facial features EXACTLY as in the original photo. The person must look like themselves - maintain the same face shape, bone structure, eye shape, nose, mouth, and all distinctive features. Natural skin texture with visible pores, fine lines, wrinkles, freckles, moles, and all natural skin variations. No plastic skin, no airbrushing, no over-smoothing, no AI artifacts. The skin must look completely real and natural, as if photographed with a professional camera. Preserve ALL natural skin imperfections, texture variations, and facial details. Avoid any digital smoothing, retouching, or artificial enhancement that makes skin look plastic, fake, or changes the person's appearance. The generated portrait must be recognizable as the same person from the original photo."
    : '';

  // Функция для генерации вариантов одежды с гарантией минимум 3 уникальных
  function generateAttireVariants(gender, role, company, count) {
    const variants = [];
    const usedGarments = new Set();
    
    // Определяем пул одежды в зависимости от типа компании
    const isFormalCompany = company === 'Enterprise' || company === 'Госкомпания' || company === 'Аутсорс/консалтинг';
    
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
    
    const pool = gender === 'female' 
      ? (isFormalCompany ? femaleFormalPool : femaleModernPool)
      : (isFormalCompany ? maleFormalPool : maleModernPool);
    
    // Гарантируем минимум 3 уникальных варианта
    // Сначала выбираем 3 уникальных
    const uniqueIndices = new Set();
    while (uniqueIndices.size < Math.min(3, pool.length)) {
      uniqueIndices.add(Math.floor(Math.random() * pool.length));
    }
    
    const uniqueGarments = Array.from(uniqueIndices).map(idx => pool[idx]);
    
    // Заполняем остальные позиции (может быть повторение, но минимум 3 уникальных гарантированы)
    for (let i = 0; i < count; i++) {
      if (i < 3) {
        variants.push(uniqueGarments[i]);
        usedGarments.add(uniqueGarments[i]);
      } else {
        // Для остальных позиций можем использовать повторения, но стараемся разнообразить
        const available = pool.filter(g => !usedGarments.has(g) || usedGarments.size >= pool.length);
        const garment = available.length > 0 
          ? randomChoice(available)
          : randomChoice(pool);
        variants.push(garment);
        usedGarments.add(garment);
      }
    }
    
    // Перемешиваем для случайного распределения
    for (let i = variants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [variants[i], variants[j]] = [variants[j], variants[i]];
    }
    
    return variants;
  }

  const base = (tone, attireIndex) => {
    const v = buildVariations(variability);
    const attire = attireVariants[attireIndex];
    const fullAttire = attireByContext(gender, role, company, attire);
    
    const skinDetail = gender === 'female'
      ? 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, freckles, moles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing, no plastic or doll-like appearance. Natural skin imperfections MUST be preserved. Do not alter the person\'s natural appearance or skin texture.'
      : 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing. Natural skin imperfections MUST be preserved.';

    const contextText = `The person works as a ${role || 'technology professional'} in a ${company || 'professional'} context. Convey this only through overall style, mood, clothing and atmosphere, not through any overlaid text.`;

    return `Create a professional, high-resolution ${
      gender === 'female' ? 'female ' : 'male '
    }business portrait of the person in the photo, suitable for a LinkedIn profile. ${genderInstruction} ${facialHairPreservation} The style should be ${tone}. ${constraints} Attire: ${fullAttire}. Lighting: ${v.lighting}. Lens & crop: ${v.lens}. Background: ${v.background}. Color grade: ${v.grade}. Pose: ${v.pose}. ${naturality} ${skinDetail} Each image in this batch must show a distinct outfit, pose, head angle and overall feel; avoid repeating garments, body position or camera framing across images. Context: ${roleDesc}; ${companyDesc}. ${contextText} CRITICAL: Do NOT add any text, titles, role names, company names, logos, watermarks, captions, UI elements, or typography inside the image. The image must look like a clean studio portrait photo without any overlaid writing.`;
  };
  
  return {
    'Классический': base(
      'classic and formal, with traditional corporate lighting and attire, set against a softly blurred corporate office or boardroom background that feels serious and executive, matching the role and company context',
      0
    ),
    'Современный': base(
      'modern and approachable, with natural lighting and a slightly blurred open-space tech office or coworking background; the environment should feel contemporary and dynamic, suitable for a modern professional in their role and company',
      1
    ),
    'Креативный': base(
      'expressive and creative, with more dramatic but still professional lighting, and a background suggesting a stylish studio, creative workspace, design office or loft environment related to the person\'s role',
      2
    ),
    'Технологичный': base(
      'clean, minimal and high-tech, with bright even lighting and a background that hints at a modern technology company: glass walls, abstract tech patterns, screens or a sleek office interior, softly blurred so it does not distract',
      3
    ),
    'Дружелюбный': base(
      'warm and friendly, with soft lighting and a welcoming background such as a bright office lounge, meeting area or softly lit workspace that feels human and approachable rather than strictly formal',
      4
    ),
    'Уверенный': base(
      'confident and powerful, with strong but flattering lighting, sharp business formal attire, and a background that evokes leadership: executive office, meeting room or skyline view, blurred enough to keep the focus on the face',
      5
    ),
  };
}

