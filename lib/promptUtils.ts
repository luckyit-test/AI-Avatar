/**
 * Утилиты для построения промптов
 */
import type { DetectedGender } from '../services/geminiService';

export function describeRole(role: string): string {
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

export function describeCompany(company: string): string {
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

export function attireByContext(gender: DetectedGender, role: string, company: string): string {
    const baseFemale = 'No facial hair. No beard. No mustache.';
    const baseMale = 'Preserve facial hair exactly as in original. If no facial hair in original, do not add any. Do not remove facial hair if present. Grooming neat and professional.';

    const isFormalCompany = company === 'Enterprise' || company === 'Госкомпания' || company === 'Аутсорс/консалтинг';
    const isModernCompany = company === 'Стартап' || company === 'Продуктовая компания' || company === 'Финтех';

    // Role-centric attire defaults
    const roleSmartCasual = 'smart-casual, solid neutral colors, no large logos';
    const roleBusinessCasual = 'business-casual blazer or knit, shirt or blouse, no tie';
    const roleFormal = 'business formal suit or tailored blazer, crisp shirt/blouse';

    // Wardrobe pools for extra variability (picked later according to context)
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

    let attireCore: string;
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

    // Company flavor
    let companyFlavor = '';
    if (company === 'Финтех') companyFlavor = 'sleek monochrome palette';
    if (company === 'Стартап') companyFlavor = 'fresh, dynamic, contemporary casual';
    if (company === 'Продуктовая компания') companyFlavor = 'approachable and modern';
    if (company === 'Госкомпания') companyFlavor = 'conservative and respectful styling';
    if (company === 'Аутсорс/консалтинг') companyFlavor = 'polished and versatile';

    const noSuitModern = (isModernCompany && role !== 'CTO') ? 'No suit. No tie. No tuxedo. Avoid formal blazer.' : '';
    const femaleNoSuit = (gender === 'female' && isModernCompany && role !== 'CTO') ? 'Avoid suit jacket; prefer blouse/knit.' : '';

    // Pick a concrete garment for higher outfit variety
    let garment = '';
    if (gender === 'female') {
        garment = isFormalCompany ? randomChoice(femaleFormalPool) : randomChoice(femaleModernPool);
    } else if (gender === 'male') {
        garment = isFormalCompany ? randomChoice(maleFormalPool) : randomChoice(maleModernPool);
    }

    const grooming = gender === 'female' ? baseFemale : baseMale;
    return `${attireCore}. ${companyFlavor}. Specific garment: ${garment}. ${noSuitModern} ${femaleNoSuit} ${grooming}`.trim();
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export type VariabilityLevel = 'low' | 'medium' | 'high';

export function buildVariations(variability: VariabilityLevel) {
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
        'facing camera, subtle smile or neutral confident expression',
        'three-quarter angle, relaxed shoulders',
    ];
    const poseExtra = [
        'slightly off-camera gaze, natural candid feel',
    ];

    const pick = (neutral: string[], extra: string[]) => {
        if (variability === 'low') return neutral[0];
        if (variability === 'medium') return randomChoice(neutral);
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

export function buildPromptsByContext(
    gender: DetectedGender | null,
    role: string,
    company: string,
    variability: VariabilityLevel,
    naturalLook: boolean,
): Record<string, string> {
    // Если пол не указан, выбрасываем ошибку
    if (!gender || (gender !== 'male' && gender !== 'female')) {
        throw new Error('Пол должен быть выбран перед генерацией');
    }
    
    const constraints = gender === 'female'
        ? 'No facial hair. No beard. No mustache.'
        : 'CRITICAL FACIAL HAIR PRESERVATION: You MUST preserve the facial hair EXACTLY as shown in the original photo - including style, length, thickness, density, and visibility. If the person is clean-shaven (no beard, no mustache) in the original photo, the generated portrait MUST also be clean-shaven with NO facial hair. If the person has a short, subtle, barely visible beard in the original, the generated portrait MUST have the EXACT SAME short, subtle, barely visible beard - do NOT make it longer, thicker, denser, or more prominent. If the person has short, barely visible mustache in the original, preserve it as EXACTLY short and barely visible - do NOT make it longer, thicker, or more noticeable. The facial hair length, thickness, density, style, visibility, and grooming must match the original photo EXACTLY. Do NOT enhance, lengthen, thicken, densify, or make facial hair more prominent than in the original. Do NOT add facial hair if there is none in the original. Do NOT remove facial hair if it exists in the original. The beard and mustache must look IDENTICAL to the original in every aspect - length, fullness, thickness, and visibility.';
    const roleDesc = describeRole(role);
    const companyDesc = describeCompany(company);
    const attire = attireByContext(gender, role, company);
    const naturality = naturalLook
        ? 'Photorealistic and authentic. Preserve identity and facial features EXACTLY as in the original photo. The person must look like themselves - maintain the same face shape, bone structure, eye shape, nose, mouth, and all distinctive features. Natural skin texture with visible pores, fine lines, wrinkles, freckles, moles, and all natural skin variations. No plastic skin, no airbrushing, no over-smoothing, no AI artifacts. The skin must look completely real and natural, as if photographed with a professional camera. Preserve ALL natural skin imperfections, texture variations, and facial details. Avoid any digital smoothing, retouching, or artificial enhancement that makes skin look plastic, fake, or changes the person\'s appearance. The generated portrait must be recognizable as the same person from the original photo.'
        : '';
    const base = (tone: string) => {
        const v = buildVariations(variability); // new random per style call
        const skinDetail = gender === 'female' 
            ? 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, freckles, moles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing, no plastic or doll-like appearance. Natural skin imperfections MUST be preserved. Do not alter the person\'s natural appearance or skin texture.'
            : 'Preserve realistic skin texture EXACTLY as shown in the original - natural pores, fine lines, wrinkles, and all skin variations. The skin must look like real human skin photographed naturally - no smoothing, no airbrushing. Natural skin imperfections MUST be preserved.';
        // Явно указываем пол в промпте для избежания ошибок
        const genderInstruction = gender === 'male' 
            ? 'CRITICAL: This is a MALE person. Generate a MALE portrait. The person must be clearly male with masculine features. Do NOT generate a female portrait.'
            : gender === 'female'
            ? 'CRITICAL: This is a FEMALE person. Generate a FEMALE portrait. The person must be clearly female with feminine features. Do NOT generate a male portrait.'
            : '';
        
        // Дополнительная инструкция о сохранении растительности на лице для мужчин
        const facialHairPreservation = gender === 'male'
            ? 'CRITICAL FACIAL HAIR RULE: Maintain the EXACT same facial hair style, length, thickness, density, and visibility as in the original photo. If the original shows a short, subtle, barely visible beard - keep it EXACTLY short, subtle, and barely visible. If the original shows barely visible mustache - keep it EXACTLY barely visible. If clean-shaven in original, generate clean-shaven. Do NOT lengthen, thicken, densify, or enhance facial hair beyond what is visible in the original photo. Do NOT make the beard or mustache more prominent, longer, or thicker than in the original. The facial hair must look IDENTICAL to the original in terms of length, fullness, thickness, density, and prominence. This is a CRITICAL requirement - any deviation will result in an incorrect portrait.'
            : '';
        
        const fullPrompt = `Create a professional, high-resolution ${gender === 'female' ? 'female ' : gender === 'male' ? 'male ' : ''}business portrait of the person in the photo, suitable for a LinkedIn profile. ${genderInstruction} ${facialHairPreservation} The style should be ${tone}. ${constraints} Attire: ${attire}. Lighting: ${v.lighting}. Lens & crop: ${v.lens}. Background: ${v.background}. Color grade: ${v.grade}. Pose: ${v.pose}. ${naturality} ${skinDetail} Each image in this batch must show a distinct outfit and feel; avoid repeating garments across images. Context: ${roleDesc}; ${companyDesc}.`;
        
        return fullPrompt;
    };
    return {
        'Классический': base('classic and formal, with traditional corporate lighting and attire against a simple, neutral background'),
        'Современный': base('modern and approachable, with natural lighting and a slightly blurred, contemporary office or neutral background'),
        'Креативный': base('expressive and creative lighting, allowing for subtle artistic choices while remaining professional'),
        'Технологичный': base('clean and minimalist, with bright, even lighting and a simple, light gray or white background; attire smart-casual'),
        'Дружелюбный': base('warm and friendly, with soft lighting and a genuine smile'),
        'Уверенный': base('confident and powerful, strong pose, sharp business formal attire, determined expression'),
    };
}

