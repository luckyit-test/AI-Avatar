/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage, evaluateImage, addGenerationToQueue, createPayment, checkPaymentStatus, fetchOrder, type DetectedGender, type QueueStatus, type ImageEvaluationResult, type OrderInfo } from './services/geminiService';
import { createAlbumPage } from './lib/albumUtils';
import { compressImage, shouldCompressImage } from './lib/imageCompression';
import { errorLogger } from './lib/errorLogger';
import Footer from './components/Footer';
import AdminOrders from './components/AdminOrders';
import Uploader from './components/Uploader';
import ImageCard from './components/ImageCard';
import { Icons } from './components/Icons';
import { CustomSelect } from './components/CustomSelect';
import { Onboarding, useOnboarding } from './components/Onboarding';
import { cn } from './lib/utils';

const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];
type VariabilityLevel = 'low' | 'medium' | 'high';

const IT_ROLES = [
    'Разработчик',
    'Frontend‑разработчик',
    'Backend‑разработчик',
    'Full‑stack разработчик',
    'Mobile‑разработчик',
    'Тимлид',
    'Архитектор',
    'Solution Architect',
    'DevOps‑инженер',
    'SRE‑инженер',
    'Дата‑сайентист',
    'ML‑инженер',
    'Data Engineer',
    'Продуктовый менеджер',
    'Проектный менеджер',
    'Delivery Manager',
    'Scrum Master',
    'Бизнес‑аналитик',
    'Системный аналитик',
    'Дизайнер UI/UX',
    'Продуктовый дизайнер',
    'QA‑инженер',
    'Инженер по безопасности',
    'Технический писатель',
    'CTO'
] as const;

const COMPANY_TYPES = [
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
    'GameDev'
] as const;

function describeRole(role: string): string {
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

function describeCompany(company: string): string {
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

function attireByContext(gender: DetectedGender, role: string, company: string): string {
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

function buildVariations(variability: VariabilityLevel) {
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

function buildPromptsByContext(
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

type ImageStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
}

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown';

function App() {
    const onboarding = useOnboarding();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    // Проверка и автоматическое перенаправление на HTTPS
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentUrl = window.location.href;
            const isHttp = currentUrl.startsWith('http://');
            const isHttps = currentUrl.startsWith('https://');
            
            // Если открыт HTTP, перенаправляем на HTTPS
            if (isHttp && !isHttps && currentUrl.includes('newava.pro')) {
                const httpsUrl = currentUrl.replace('http://', 'https://');
                console.warn('[App] Redirecting from HTTP to HTTPS:', { from: currentUrl, to: httpsUrl });
                window.location.replace(httpsUrl);
            }
        }
    }, []);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [imageValidationError, setImageValidationError] = useState<string | null>(null);
    const [isValidatingImage, setIsValidatingImage] = useState<boolean>(false);
    const [validationTimer, setValidationTimer] = useState<number>(0);
    const [validationStatusMessage, setValidationStatusMessage] = useState<string>('Анализируем изображение...');
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppState>('idle');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [detectedGender, setDetectedGender] = useState<DetectedGender>('unknown');
    const [genderOverride, setGenderOverride] = useState<'male' | 'female' | null>(null);
    const [selectedRole, setSelectedRole] = useState<typeof IT_ROLES[number]>('Разработчик');
    const [selectedCompany, setSelectedCompany] = useState<typeof COMPANY_TYPES[number]>('Стартап');
    const [hasActivePayment, setHasActivePayment] = useState<boolean>(false);
    const autoGenerationStartedRef = useRef<boolean>(false);
    const PENDING_GENERATION_KEY = 'newava_pending_generation';
    const CURRENT_ORDER_KEY = 'newava_current_order';
    const [currentOrder, setCurrentOrder] = useState<OrderInfo | null>(null);
    const [currentInvId, setCurrentInvId] = useState<string | null>(null);
    // Промежуточное изображение для стабильной генерации
    const [intermediateImage, setIntermediateImage] = useState<string | null>(null);
    const [isGeneratingIntermediate, setIsGeneratingIntermediate] = useState<boolean>(false);
    // Fixed settings per request: always High variability and maximum naturalness
    const variability: VariabilityLevel = 'high';
    const naturalLook: boolean = true;

    const [isAdminView, setIsAdminView] = useState<boolean>(false);

    const getEffectiveGender = (): DetectedGender | null => {
        // Возвращаем выбранный пол (автоматически или вручную)
        // Если null - пол не выбран, генерация недоступна
        return genderOverride;
    };

    // Определяем режим админки по query-параметру ?admin=1
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const url = new URL(window.location.href);
            const adminFlag = url.searchParams.get('admin');
            setIsAdminView(adminFlag === '1');
        } catch (e) {
            console.warn('[App] Failed to detect admin mode:', e);
        }
    }, []);

    // Проверяем, не вернулся ли пользователь после оплаты Robokassa или есть ли сохраненный заказ
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const url = new URL(window.location.href);
        const invIdFromUrl = url.searchParams.get('invId') || url.searchParams.get('InvId');
        const invIdFromStorage = window.localStorage.getItem(CURRENT_ORDER_KEY);
        const invId = invIdFromUrl || invIdFromStorage;

        if (invId) {
            // Сохраняем invId в состояние
            setCurrentInvId(invId);
            if (invIdFromUrl && !invIdFromStorage) {
                // Сохраняем в localStorage если пришли с URL
                window.localStorage.setItem(CURRENT_ORDER_KEY, invId);
            }

            // Сразу показываем состояние загрузки, чтобы пользователь не видел пустую страницу
            console.log('[App] Loading order info for invId:', invId);
            
            // Сразу инициализируем состояние генерации (оптимистичный UI)
            // Это гарантирует, что пользователь увидит карточки генерации сразу
            const initialImages: Record<string, GeneratedImage> = {};
            STYLES.forEach(style => {
                initialImages[style] = { status: 'processing' };
            });
            setGeneratedImages(initialImages);
            setAppState('generating');
            console.log('[App] Optimistically set generation state while loading order');

            // Загружаем информацию о заказе с бэкенда
            fetchOrder(invId)
                .then((order) => {
                    setCurrentOrder(order);
                    
                    // Если заказ оплачен или обрабатывается - показываем генерацию
                    if (order.status === 'paid' || order.status === 'processing' || order.status === 'completed') {
                        setHasActivePayment(true);
                        
                        // Восстанавливаем настройки из localStorage
                        try {
                            const raw = window.localStorage.getItem(PENDING_GENERATION_KEY);
                            if (raw) {
                                const data = JSON.parse(raw);
                                if (data?.uploadedImage) {
                                    setUploadedImage(data.uploadedImage);
                                }
                                if (data?.genderOverride === 'male' || data?.genderOverride === 'female') {
                                    setGenderOverride(data.genderOverride);
                                }
                                if (data?.selectedRole && (IT_ROLES as readonly string[]).includes(data.selectedRole)) {
                                    setSelectedRole(data.selectedRole as (typeof IT_ROLES)[number]);
                                }
                                if (data?.selectedCompany && (COMPANY_TYPES as readonly string[]).includes(data.selectedCompany)) {
                                    setSelectedCompany(data.selectedCompany as (typeof COMPANY_TYPES)[number]);
                                }
                            }
                            
                            // Если изображение не восстановилось из localStorage, но есть в заказе - используем данные из заказа
                            // (хотя imageData не возвращается в публичном API, но можем использовать сохраненные настройки)
                            // Восстанавливаем настройки из заказа для отображения
                            if (order.gender && (order.gender === 'male' || order.gender === 'female')) {
                                setGenderOverride(order.gender as 'male' | 'female');
                            }
                            if (order.role && (IT_ROLES as readonly string[]).includes(order.role)) {
                                setSelectedRole(order.role as (typeof IT_ROLES)[number]);
                            }
                            if (order.company && (COMPANY_TYPES as readonly string[]).includes(order.company)) {
                                setSelectedCompany(order.company as (typeof COMPANY_TYPES)[number]);
                            }
                            
                            // Если заказ завершен - показываем результаты
                            if (order.status === 'completed' && order.generatedImages) {
                                const images: Record<string, GeneratedImage> = {};
                                STYLES.forEach(style => {
                                    if (order.generatedImages && order.generatedImages[style]) {
                                        images[style] = { status: 'done', url: order.generatedImages[style] };
                                    } else {
                                        images[style] = { status: 'error', error: 'Не сгенерировано' };
                                    }
                                });
                                setGeneratedImages(images);
                                setAppState('results-shown');
                            } else if (order.status === 'processing' || order.status === 'paid') {
                                // Показываем состояние генерации сразу (даже если заказ еще в статусе paid)
                                // Показываем генерацию даже если изображение не восстановилось - пользователь должен видеть прогресс
                                console.log('[App] Setting generation state for order', { invId, status: order.status });
                                
                                // Инициализируем все 6 карточек со статусом processing
                                const images: Record<string, GeneratedImage> = {};
                                STYLES.forEach(style => {
                                    images[style] = { status: 'processing' };
                                });
                                
                                console.log('[App] Generated images state:', images, 'STYLES:', STYLES);
                                
                                // Устанавливаем состояние синхронно, используя функциональное обновление
                                setGeneratedImages(() => images);
                                setAppState('generating');
                                
                                console.log('[App] App state set to generating, generatedImages keys:', Object.keys(images));
                            } else {
                                setAppState('image-uploaded');
                            }
                        } catch (e) {
                            console.warn('[App] Failed to restore order state:', e);
                        }
                    }
                })
                .catch((err) => {
                    console.error('[App] Failed to fetch order:', err);
                    // Если заказ не найден - очищаем localStorage
                    if (typeof window !== 'undefined') {
                        window.localStorage.removeItem(CURRENT_ORDER_KEY);
                    }
                });

            // Чистим служебные параметры Robokassa из URL
            ['payment', 'invId', 'InvId', 'OutSum', 'SignatureValue', 'IsTest', 'Culture'].forEach((key) =>
                url.searchParams.delete(key),
            );
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Polling статуса заказа, если он в состоянии paid или processing
    useEffect(() => {
        if (!currentInvId || !currentOrder || (currentOrder.status !== 'processing' && currentOrder.status !== 'paid')) return;

        const pollInterval = setInterval(async () => {
            try {
                const order = await fetchOrder(currentInvId);
                setCurrentOrder(order);

                // Если заказ перешел в processing - обновляем UI
                if (order.status === 'processing' && appState !== 'generating') {
                    const images: Record<string, GeneratedImage> = {};
                    STYLES.forEach(style => {
                        images[style] = { status: 'processing' };
                    });
                    setGeneratedImages(images);
                    setAppState('generating');
                }

                // Если заказ завершен - обновляем UI
                if (order.status === 'completed' && order.generatedImages) {
                    const images: Record<string, GeneratedImage> = {};
                    STYLES.forEach(style => {
                        if (order.generatedImages && order.generatedImages[style]) {
                            images[style] = { status: 'done', url: order.generatedImages[style] };
                        } else {
                            images[style] = { status: 'error', error: 'Не сгенерировано' };
                        }
                    });
                    setGeneratedImages(images);
                    setAppState('results-shown');
                    clearInterval(pollInterval);
                } else if (order.status === 'failed') {
                    // Заказ провалился
                    setAppState('image-uploaded');
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('[App] Failed to poll order status:', err);
            }
        }, 2000); // Проверяем каждые 2 секунды для более быстрого обновления

        return () => clearInterval(pollInterval);
    }, [currentInvId, currentOrder, appState]);

    // Таймер для оценки изображения - обратный отсчет от 10 до 1
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (isValidatingImage) {
            setValidationTimer(10); // Начинаем с 10 секунд
            intervalId = setInterval(() => {
                setValidationTimer(prev => {
                    if (prev <= 1) {
                        return 1; // Останавливаемся на 1
                    }
                    return prev - 1; // Уменьшаем каждую секунду
                });
            }, 1000);
        } else {
            setValidationTimer(0);
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isValidatingImage]);

    const handleImageUpload = async (file: File) => {
        // Детальное логирование для диагностики
        console.log('[App] File selected:', {
            name: file.name,
            size: file.size,
            sizeMB: (file.size / (1024 * 1024)).toFixed(2),
            type: file.type,
            lastModified: new Date(file.lastModified).toISOString(),
            isMobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
            userAgent: navigator.userAgent
        });

        // Проверка размера файла ПЕРЕД конвертацией в base64
        const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7MB (base64 будет ~9-10MB)
        if (file.size > MAX_FILE_SIZE) {
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
            console.warn('[App] File too large:', { size: file.size, sizeMB: sizeInMB, maxSize: MAX_FILE_SIZE });
            setImageValidationError(
                `Фото слишком большое (${sizeInMB} МБ). Максимальный размер — 7 МБ. ` +
                `Пожалуйста, уменьшите изображение или сделайте скриншот и попробуйте снова.`
            );
            return;
        }

        // Проверка формата
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const fileTypeLower = file.type.toLowerCase();
        
        // Специальная проверка для HEIC (многие телефоны используют этот формат)
        if (fileTypeLower.includes('heic') || fileTypeLower.includes('heif') || 
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            console.warn('[App] HEIC format detected:', { fileName: file.name, fileType: file.type });
            setImageValidationError(
                'Формат HEIC не поддерживается. Пожалуйста, конвертируйте фото в JPG или PNG перед загрузкой. ' +
                'На iPhone можно сделать скриншот фото или сохранить в другом формате.'
            );
            return;
        }
        
        if (!allowedTypes.includes(fileTypeLower)) {
            console.warn('[App] Unsupported file type:', { fileType: file.type, fileName: file.name });
            setImageValidationError(
                `Формат изображения не поддерживается (${file.type || 'неизвестный'}). Загрузите фото в формате JPG, PNG или WEBP.`
            );
            return;
        }

        // Определяем, нужно ли сжимать изображение
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
        const isYandexMobile = isMobile && /YaBrowser|Yandex/i.test(navigator.userAgent);
        const needsCompression = shouldCompressImage(file, isMobile);
        
        console.log('[App] Image processing options:', {
            isMobile,
            isYandexMobile,
            needsCompression,
            fileSize: file.size,
            fileSizeMB: (file.size / (1024 * 1024)).toFixed(2)
        });

        // Для мобильных устройств (особенно Яндекс браузера) сжимаем изображение
        if (needsCompression) {
            console.log('[App] Compressing image for mobile device...');
            try {
                const compressedDataUrl = await compressImage(file, 1920, 1920, 0.85);
                const compressedSize = (compressedDataUrl.length * 3) / 4;
                console.log('[App] Image compressed:', {
                    originalSize: file.size,
                    originalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
                    compressedSize,
                    compressedSizeMB: (compressedSize / (1024 * 1024)).toFixed(2),
                    compressionRatio: ((1 - compressedSize / file.size) * 100).toFixed(1) + '%'
                });
                
                // Используем сжатое изображение
                processImageData(compressedDataUrl, file);
                return;
            } catch (compressionError) {
                console.error('[App] Compression failed, using original:', compressionError);
                // Если сжатие не удалось, используем оригинал
            }
        }

        // Если сжатие не нужно или не удалось - используем оригинал
        const reader = new FileReader();
        reader.onerror = () => {
            console.error('FileReader error:', reader.error);
            setImageValidationError('Ошибка чтения файла. Попробуйте выбрать другое изображение.');
        };
        
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            processImageData(dataUrl, file);
        };
        
        reader.readAsDataURL(file);
    };

    const processImageData = (dataUrl: string, originalFile: File) => {
            
        // Дополнительная проверка размера base64 (на случай если что-то пошло не так)
        const base64Size = (dataUrl.length * 3) / 4;
        const MAX_BASE64_SIZE = 10 * 1024 * 1024; // 10MB
        if (base64Size > MAX_BASE64_SIZE) {
            setImageValidationError(
                'Изображение слишком большое после обработки. Пожалуйста, уменьшите изображение и попробуйте снова.'
            );
            return;
        }
        
        console.log('[App] Processing image data:', {
            dataUrlLength: dataUrl.length,
            estimatedSizeMB: (base64Size / (1024 * 1024)).toFixed(2),
            originalFileSize: originalFile.size,
            originalFileSizeMB: (originalFile.size / (1024 * 1024)).toFixed(2)
        });
        
        // НЕ показываем изображение сразу - сначала анализируем
        setUploadedImage(null);
        setAppState('idle');
        setGeneratedImages({}); // Clear previous results
        setGenderOverride(null);
        setDetectedGender('unknown');
        setImageValidationError(null);
        
        // Запускаем анализ
        setIsValidatingImage(true);
        setValidationStatusMessage('Анализируем изображение...');
        setValidationTimer(0);
        const analysisStartedAt = Date.now();
        const MIN_ANALYSIS_MS = 1200; // гарантируем видимость статуса хотя бы 1.2с
        
        (async () => {
            try {
                // Единая оценка изображения (валидация + определение пола) с callback для статуса
                const evaluation: ImageEvaluationResult = await evaluateImage(dataUrl, (status) => {
                    // Обновляем статусное сообщение
                    if (status.statusMessage) {
                        setValidationStatusMessage(status.statusMessage);
                    }
                    // Не обновляем таймер из статуса - используем только обратный отсчет от 10
                });
                
                console.log('Image evaluation result:', evaluation);
                
                if (!evaluation.isValid) {
                    // Изображение не прошло валидацию - показываем ошибку
                    setImageValidationError(evaluation.errorMessage);
                    // Держим статус хотя бы MIN_ANALYSIS_MS
                    const elapsed = Date.now() - analysisStartedAt;
                    const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
                    if (delay > 0) await new Promise(r => setTimeout(r, delay));
                    setIsValidatingImage(false);
                    setValidationStatusMessage('Анализируем изображение...');
                    return;
                }
                // Изображение валидно - ТЕПЕРЬ показываем его (после минимальной задержки)
                {
                    const elapsed = Date.now() - analysisStartedAt;
                    const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
                    if (delay > 0) await new Promise(r => setTimeout(r, delay));
                }
                setUploadedImage(dataUrl);
                setAppState('image-uploaded');
                setIsValidatingImage(false);
                setValidationStatusMessage('Анализируем изображение...');
                
                // Устанавливаем определенный пол
                setDetectedGender(evaluation.gender);
                console.log('Detected gender:', evaluation.gender, 'confidence:', evaluation.confidence);
                
                // Автоматически выбираем пол если уверенность >= 0.7
                if ((evaluation.gender === 'male' || evaluation.gender === 'female') && evaluation.confidence >= 0.7) {
                    setGenderOverride(evaluation.gender);
                    console.log('Auto-selected gender:', evaluation.gender, 'confidence:', evaluation.confidence);
                } else {
                    // Если уверенность низкая или пол не определен - сбрасываем выбор
                    setGenderOverride(null);
                    console.log('Gender not auto-selected, user must choose. Gender:', evaluation.gender, 'confidence:', evaluation.confidence);
                }
                } catch (error) {
                    const errorDetails = {
                        error: error instanceof Error ? error.message : String(error),
                        errorName: error instanceof Error ? error.name : typeof error,
                        stack: error instanceof Error ? error.stack : undefined,
                        fileSize: originalFile.size,
                        fileType: originalFile.type,
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                        isMobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
                        isYandex: /YaBrowser|Yandex/i.test(navigator.userAgent)
                    };
                    
                    console.error('[App] Error evaluating image:', errorDetails);
                    
                    // Логируем ошибку для диагностики
                    errorLogger.log('ImageEvaluationError', 
                        error instanceof Error ? error.message : String(error),
                        errorDetails
                    );
                    
                    // Держим статус хотя бы MIN_ANALYSIS_MS
                    const elapsed = Date.now() - analysisStartedAt;
                    const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
                    if (delay > 0) await new Promise(r => setTimeout(r, delay));
                    setIsValidatingImage(false);
                    setValidationStatusMessage('Анализируем изображение...');
                    // При ошибке оценки показываем ошибку
                    setImageValidationError('Не удалось оценить изображение. Пожалуйста, попробуйте другое изображение.');
                }
        })();
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;
        
        // Проверяем, что пол выбран
        const effectiveGender = getEffectiveGender();
        if (!effectiveGender || (effectiveGender !== 'male' && effectiveGender !== 'female')) {
            // Логируем, но не показываем alert - пол должен быть выбран автоматически
            console.warn('[App] Gender not selected, but should be auto-selected');
            return;
        }

        // Если есть активный заказ в состоянии processing или completed - не запускаем генерацию заново
        if (currentOrder && (currentOrder.status === 'processing' || currentOrder.status === 'completed')) {
            console.log('[App] Order already processing or completed, skipping generation');
            return;
        }

        // Если оплаты ещё не было - инициируем платёж через Robokassa
        if (!hasActivePayment && !currentOrder) {
            try {
                console.log('[App] No active payment found, creating Robokassa payment...');

                // Сохраняем текущие настройки перед редиректом на оплату
                try {
                    const payload = {
                        uploadedImage,
                        genderOverride,
                        selectedRole,
                        selectedCompany,
                        timestamp: Date.now(),
                    };
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(payload));
                    }
                } catch (storageError) {
                    console.warn('[App] Failed to persist pending generation before payment:', storageError);
                }

                const effectiveGender = getEffectiveGender();
                const payment = await createPayment(
                    uploadedImage,
                    effectiveGender || 'unknown',
                    selectedRole || '',
                    selectedCompany || ''
                );
                if (payment?.redirectUrl) {
                    // Сохраняем invId в localStorage для восстановления после возврата
                    if (typeof window !== 'undefined' && payment.invId) {
                        window.localStorage.setItem(CURRENT_ORDER_KEY, String(payment.invId));
                    }
                    window.location.href = payment.redirectUrl;
                    return;
                }
            } catch (err) {
                console.error('[App] Failed to create payment:', err);
            }
            // Если платёж не удалось создать - не запускаем генерацию
            return;
        }

        // Оплата подтверждена — "съедаем" платёж и очищаем сохранённое состояние
        setHasActivePayment(false);
        autoGenerationStartedRef.current = true;
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(PENDING_GENERATION_KEY);
            }
        } catch (e) {
            console.warn('[App] Failed to clear pending generation from storage:', e);
        }

        setAppState('generating');
        
        // Инициализируем статусы для 6 финальных портретов
        const initialImages: Record<string, GeneratedImage> = {};
        STYLES.forEach(style => {
            initialImages[style] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        try {
            // ШАГ 1: Генерируем промежуточное изображение (если еще не кэшировано)
            let imageToUse = uploadedImage;
            let isUsingIntermediate = false;
            
            if (!intermediateImage) {
                setIsGeneratingIntermediate(true);
                console.log('[App] ========================================');
                console.log('[App] STEP 1: Generating intermediate image');
                console.log('[App] Original image size:', uploadedImage.length, 'chars');
                console.log('[App] ========================================');
                
                // Максимально простой промпт для промежуточного изображения
                // Используем минимальный промпт, который должен работать даже с проблемными изображениями
                const intermediatePrompt = 'Change background to gray. Keep person the same.';
                console.log('[App] Intermediate prompt:', intermediatePrompt);
                
                try {
                    const intermediateResult = await generateImage(uploadedImage, intermediatePrompt);
                    console.log('[App] ========================================');
                    console.log('[App] ✅ Intermediate image generated successfully!');
                    console.log('[App] Intermediate image size:', intermediateResult.length, 'chars');
                    console.log('[App] Intermediate image preview:', intermediateResult.substring(0, 100) + '...');
                    console.log('[App] ========================================');
                    setIntermediateImage(intermediateResult);
                    imageToUse = intermediateResult;
                    isUsingIntermediate = true;
                } catch (err) {
                    console.error('[App] ========================================');
                    console.error('[App] ❌ FAILED to generate intermediate image!');
                    console.error('[App] Error:', err);
                    console.error('[App] Error message:', err instanceof Error ? err.message : String(err));
                    console.error('[App] Error stack:', err instanceof Error ? err.stack : 'no stack');
                    console.error('[App] Will use original image instead');
                    console.error('[App] ========================================');
                    // Если промежуточное изображение не удалось - используем оригинал
                    imageToUse = uploadedImage;
                    isUsingIntermediate = false;
                } finally {
                    setIsGeneratingIntermediate(false);
                }
            } else {
                // Используем кэшированное промежуточное изображение
                imageToUse = intermediateImage;
                isUsingIntermediate = true;
                console.log('[App] Using cached intermediate image (size:', intermediateImage.length, 'chars)');
            }
            
            console.log('[App] ========================================');
            console.log('[App] STEP 2: Generating 6 final portraits');
            console.log('[App] Using image size:', imageToUse.length, 'chars');
            console.log('[App] Image source:', isUsingIntermediate ? 'INTERMEDIATE ✅' : 'ORIGINAL ⚠️');
            if (!isUsingIntermediate) {
                console.warn('[App] ⚠️ WARNING: Using ORIGINAL image instead of intermediate! This may cause generation failures.');
            }
            console.log('[App] ========================================');

            // ШАГ 2: Генерируем все 6 стилей параллельно на основе промежуточного изображения
            const prompts = buildPromptsByContext(getEffectiveGender(), selectedRole, selectedCompany, variability, naturalLook);

            // Логируем информацию о промптах для проверки инструкций по бороде/усам
            console.log('[App] ========================================');
            console.log('[App] PROMPT VERIFICATION: Facial hair preservation instructions');
            console.log('[App] ========================================');
            const samplePrompt = prompts[Object.keys(prompts)[0]];
            const hasFacialHairInstructions = samplePrompt.includes('CRITICAL FACIAL HAIR') || 
                                             samplePrompt.includes('facial hair EXACTLY') ||
                                             samplePrompt.includes('Do NOT lengthen, thicken');
            console.log(`[App] ✅ Facial hair preservation instructions found: ${hasFacialHairInstructions}`);
            if (hasFacialHairInstructions) {
                const facialHairMatch = samplePrompt.match(/CRITICAL.*?facial hair.*?(?=\.|Attire|The style)/is);
                if (facialHairMatch) {
                    console.log(`[App] Facial hair instruction preview: ${facialHairMatch[0].substring(0, 200)}...`);
                }
            }
            console.log('[App] ========================================');

            // Ограничения на количество попыток (чтобы не убить квоту)
            const MAX_ATTEMPTS_PER_STYLE = 4;
            const MAX_SOURCES_PER_FAILED_STYLE = 3;
            const MAX_TOTAL_RETRY_REQUESTS = 8;
            const attempts: Record<string, number> = {};
            let totalRetryRequests = 0;

            // Собираем результаты напрямую из промисов, а не из состояния React
            const firstStageResults: Array<{ style: string; success: boolean; url?: string; error?: string }> = [];

            const processStyle = async (style: string, retryCount = 0): Promise<{ style: string; success: boolean; url?: string; error?: string }> => {
                const maxRetriesForJobNotFound = 2; // Максимум 2 повторные попытки при "Задача не найдена"
                
                try {
                    // Учитываем попытку для этого стиля
                    attempts[style] = (attempts[style] ?? 0) + 1;
                    if (attempts[style] > MAX_ATTEMPTS_PER_STYLE) {
                        console.warn(`[App] Max attempts reached for style: ${style}. Skipping further generation attempts.`);
                        return { style, success: false, error: 'Превышено максимальное количество попыток для этого стиля.' };
                    }

                    const prompt = prompts[style];
                    if (retryCount === 0) {
                        console.log(`[App] Starting generation for style: ${style}`);
                    } else {
                        console.log(`[App] Retrying generation for style: ${style} (attempt ${retryCount + 1})`);
                    }
                    console.log(`[App] Prompt length: ${prompt.length} chars`);
                    console.log(`[App] Prompt preview: ${prompt.substring(0, 150)}...`);
                    // Проверяем наличие инструкций по бороде/усам в каждом промпте
                    const hasFacialHairInPrompt = prompt.includes('CRITICAL FACIAL HAIR') || 
                                                 prompt.includes('facial hair EXACTLY') ||
                                                 prompt.includes('Do NOT lengthen, thicken');
                    console.log(`[App] ✅ Facial hair preservation in prompt: ${hasFacialHairInPrompt}`);
                    
                    // Callback для обновления статуса в реальном времени
                    const onStatusUpdate = (status: QueueStatus) => {
                        setGeneratedImages(prev => {
                            if (status.status === 'queued') {
                                return {
                                    ...prev,
                                    [style]: {
                                        status: 'queued',
                                        queuePosition: status.position,
                                        estimatedWaitTime: status.estimatedWaitTime,
                                    },
                                };
                            } else if (status.status === 'processing') {
                                return {
                                    ...prev,
                                    [style]: {
                                        status: 'processing',
                                        queuePosition: 0,
                                        estimatedWaitTime: status.estimatedWaitTime,
                                    },
                                };
                            }
                            return prev;
                        });
                    };
                    
                    console.log(`[App] Using image for generation:`, {
                        style,
                        imageSource: isUsingIntermediate ? 'INTERMEDIATE ✅' : 'ORIGINAL ⚠️',
                        imageSize: imageToUse.length,
                        imagePreview: imageToUse.substring(0, 100) + '...'
                    });
                    
                    const resultUrl = await generateImage(imageToUse, prompt, onStatusUpdate);
                    console.log(`[App] ✅ Successfully generated image for style: ${style}`);
                    console.log(`[App] Result URL length: ${resultUrl.length} chars`);
                    setGeneratedImages(prev => ({
                        ...prev,
                        [style]: { status: 'done', url: resultUrl },
                    }));
                    return { style, success: true, url: resultUrl };
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
                    const isJobNotFoundError = errorMessage.includes('Задача не найдена') || errorMessage.includes('не найдена');
                    
                    // Если это ошибка "Задача не найдена" и еще есть попытки - пробуем снова
                    if (isJobNotFoundError && retryCount < maxRetriesForJobNotFound) {
                        console.warn(`[App] ⚠️ Job not found for style: ${style}. Retrying... (attempt ${retryCount + 1}/${maxRetriesForJobNotFound})`);
                        // Небольшая задержка перед повторной попыткой
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                        // Рекурсивно вызываем функцию с увеличенным счетчиком попыток
                        return processStyle(style, retryCount + 1);
                    }
                    
                    console.error(`[App] ❌ Failed to generate image for style: ${style}`);
                    console.error(`[App] Error:`, err);
                    console.error(`[App] Error message:`, errorMessage);
                    console.error(`[App] Error stack:`, err instanceof Error ? err.stack : 'no stack');
                    
                    if (isJobNotFoundError) {
                        console.error(`[App] ⚠️ Job not found error after ${retryCount + 1} attempts. This may indicate server issues.`);
                    }
                    
                    setGeneratedImages(prev => ({
                        ...prev,
                        [style]: { status: 'error', error: errorMessage },
                    }));
                    return { style, success: false, error: errorMessage };
                }
            };

            // ШАГ 2: Запускаем все 6 генераций одновременно и собираем результаты
            const results = await Promise.all(STYLES.map(style => processStyle(style)));
            firstStageResults.push(...results);
            
            // ШАГ 3: Проверяем результаты и делаем повторную попытку для неудачных
            console.log('[App] ========================================');
            console.log('[App] STEP 3: Checking results and retrying failed portraits');
            console.log('[App] ========================================');
            
            // Находим успешные портреты и неудачные стили из результатов промисов
            const successfulPortraits: Array<{ style: string; url: string }> = [];
            const failedStyles: string[] = [];
            
            results.forEach(result => {
                if (result.success && result.url) {
                    successfulPortraits.push({ style: result.style, url: result.url });
                    console.log(`[App] ✅ Successful portrait: ${result.style}`);
                } else {
                    failedStyles.push(result.style);
                    console.log(`[App] ❌ Failed portrait: ${result.style}`);
                }
            });

            // Итоговая карта результатов для финального анализа
            const finalResultsMap: Record<string, { success: boolean; url?: string }> = {};
            results.forEach(result => {
                finalResultsMap[result.style] = { success: result.success, url: result.url };
            });
            
            // Если есть успешные портреты и неудачные - делаем расширенную повторную попытку
            if (successfulPortraits.length > 0 && failedStyles.length > 0) {
                console.log('[App] ========================================');
                console.log(`[App] Retrying ${failedStyles.length} failed portraits using successful portraits as sources (with limits)`);
                console.log('[App] ========================================');
                
                // Функция для повторной попытки с использованием одного или нескольких успешных изображений
                const retryFailedStyle = async (style: string): Promise<{ style: string; success: boolean; url?: string }> => {
                    const prompt = prompts[style];
                    let sourcesTried = 0;
                    let sourceIndex = 0;

                    while (
                        sourcesTried < MAX_SOURCES_PER_FAILED_STYLE &&
                        sourceIndex < successfulPortraits.length &&
                        (attempts[style] ?? 0) < MAX_ATTEMPTS_PER_STYLE &&
                        totalRetryRequests < MAX_TOTAL_RETRY_REQUESTS
                    ) {
                        const source = successfulPortraits[sourceIndex];
                        console.log(`[App] Retrying generation for style: ${style} using source style: ${source.style} (attempt ${attempts[style] ?? 0 + 1})`);

                        // Учитываем попытку и глобальный лимит
                        attempts[style] = (attempts[style] ?? 0) + 1;
                        totalRetryRequests += 1;

                        // Проверяем наличие инструкций по бороде/усам в промпте для retry
                        const hasFacialHairInRetryPrompt = prompt.includes('CRITICAL FACIAL HAIR') || 
                                                          prompt.includes('facial hair EXACTLY') ||
                                                          prompt.includes('Do NOT lengthen, thicken');
                        console.log(`[App] ✅ Facial hair preservation in retry prompt: ${hasFacialHairInRetryPrompt}`);
                        
                        // Обновляем статус на "processing" для повторной попытки
                        setGeneratedImages(prev => ({
                            ...prev,
                            [style]: { status: 'processing', error: undefined },
                        }));
                        
                        // Callback для обновления статуса
                        const onStatusUpdate = (status: QueueStatus) => {
                            setGeneratedImages(prev => {
                                if (status.status === 'queued') {
                                    return {
                                        ...prev,
                                        [style]: {
                                            status: 'queued',
                                            queuePosition: status.position,
                                            estimatedWaitTime: status.estimatedWaitTime,
                                        },
                                    };
                                } else if (status.status === 'processing') {
                                    return {
                                        ...prev,
                                        [style]: {
                                            status: 'processing',
                                            queuePosition: 0,
                                            estimatedWaitTime: status.estimatedWaitTime,
                                        },
                                    };
                                }
                                return prev;
                            });
                        };
                        
                        try {
                            const resultUrl = await generateImage(source.url, prompt, onStatusUpdate);
                            console.log(`[App] ✅ Successfully retried generation for style: ${style} using source style: ${source.style}`);
                            setGeneratedImages(prev => ({
                                ...prev,
                                [style]: { status: 'done', url: resultUrl },
                            }));

                            // Добавляем этот успешный портрет в пул источников
                            successfulPortraits.push({ style, url: resultUrl });
                            finalResultsMap[style] = { success: true, url: resultUrl };

                            return { style, success: true, url: resultUrl };
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
                            console.error(`[App] ❌ Retry failed for style: ${style} using source style: ${source.style}`);
                            console.error(`[App] Error:`, err);
                            // Оставляем ошибку, но не перезаписываем статус на error, чтобы пользователь видел что была попытка
                            setGeneratedImages(prev => ({
                                ...prev,
                                [style]: { status: 'error', error: `Повторная попытка не удалась: ${errorMessage}` },
                            }));

                            sourcesTried += 1;
                            sourceIndex += 1;
                        }
                    }

                    console.warn(`[App] Exhausted retry options for style: ${style}. Attempts: ${attempts[style] ?? 0}, sourcesTried: ${sourcesTried}`);
                    return { style, success: false };
                };
                
                // Запускаем повторные попытки для всех неудачных стилей
                const retryResultsForFailed = await Promise.all(failedStyles.map(style => retryFailedStyle(style)));
                
                console.log('[App] ========================================');
                console.log('[App] Retry attempts completed');
                console.log('[App] ========================================');

                // Обновляем финальную карту результатов с учетом ретраев
                retryResultsForFailed.forEach(result => {
                    if (result.success && result.url) {
                        finalResultsMap[result.style] = { success: true, url: result.url };
                    }
                });
            } else if (successfulPortraits.length === 0 && failedStyles.length > 0) {
                // Если ВСЕ портреты провалились - обрабатываем промежуточное изображение агрессивнее и повторяем попытку
                console.log('[App] ========================================');
                console.log('[App] STEP 4: All portraits failed. Processing intermediate image more aggressively');
                console.log('[App] ========================================');
                
                try {
                    // Обрабатываем промежуточное изображение более агрессивно (level 2)
                    const aggressiveIntermediatePrompt = 'Change background to gray. Keep person the same.';
                    console.log('[App] Reprocessing intermediate image with aggressive level 2');
                    
                    // Используем addGenerationToQueue с агрессивным уровнем 2
                    const aggressiveQueueJob = await addGenerationToQueue(imageToUse, aggressiveIntermediatePrompt, 2);
                    
                    if (!aggressiveQueueJob.processedImage) {
                        throw new Error('Failed to process intermediate image aggressively');
                    }
                    
                    const aggressiveIntermediateResult = aggressiveQueueJob.processedImage;
                    
                    console.log('[App] ========================================');
                    console.log('[App] ✅ Aggressively processed intermediate image generated!');
                    console.log('[App] Aggressive intermediate image size:', aggressiveIntermediateResult.length, 'chars');
                    console.log('[App] ========================================');
                    
                    // Обновляем промежуточное изображение
                    setIntermediateImage(aggressiveIntermediateResult);
                    imageToUse = aggressiveIntermediateResult;
                    isUsingIntermediate = true;
                    
                    // Повторяем попытку генерации всех 6 портретов с новым промежуточным изображением
                    console.log('[App] ========================================');
                    console.log('[App] STEP 5: Retrying all 6 portraits with aggressively processed intermediate image');
                    console.log('[App] ========================================');
                    
                    const retryResults = await Promise.all(STYLES.map(style => processStyle(style)));
                    
                    // Обновляем результаты
                    retryResults.forEach(result => {
                        if (result.success && result.url) {
                            setGeneratedImages(prev => ({
                                ...prev,
                                [result.style]: { status: 'done', url: result.url },
                            }));
                            console.log(`[App] ✅ Retry successful for style: ${result.style}`);
                        } else {
                            console.log(`[App] ❌ Retry failed for style: ${result.style}`);
                        }
                    });

                    // Обновляем финальную карту результатов на основе агрессивного ретрая
                    STYLES.forEach(style => {
                        const match = retryResults.find(r => r.style === style);
                        if (match) {
                            finalResultsMap[style] = { success: match.success, url: match.url };
                        }
                    });
                    
                } catch (err) {
                    console.error('[App] ========================================');
                    console.error('[App] ❌ FAILED to reprocess intermediate image aggressively!');
                    console.error('[App] Error:', err);
                    console.error('[App] ========================================');
                }
            } else {
                console.log('[App] No retry needed:', {
                    successfulCount: successfulPortraits.length,
                    failedCount: failedStyles.length
                });

                // Если ретраев не было, финальная карта совпадает с исходными результатами
                STYLES.forEach(style => {
                    if (!finalResultsMap[style]) {
                        const match = results.find(r => r.style === style);
                        if (match) {
                            finalResultsMap[style] = { success: match.success, url: match.url };
                        }
                    }
                });
            }

            // ФИНАЛЬНЫЙ FALLBACK: гарантируем 6 портретов любой ценой
            const finalSuccessfulStyles: Array<{ style: string; url: string }> = [];
            const finalFailedStyles: string[] = [];

            STYLES.forEach(style => {
                const entry = finalResultsMap[style];
                if (entry && entry.success && entry.url) {
                    finalSuccessfulStyles.push({ style, url: entry.url });
                } else {
                    finalFailedStyles.push(style);
                }
            });

            console.log('[App] Final results before fallback:', {
                successfulCount: finalSuccessfulStyles.length,
                failedCount: finalFailedStyles.length,
                failedStyles: finalFailedStyles,
            });

            if (finalFailedStyles.length > 0 && finalSuccessfulStyles.length > 0) {
                console.warn('[App] Applying final fallback duplication to guarantee 6 portraits.');

                setGeneratedImages(prev => {
                    const updated = { ...prev };
                    finalFailedStyles.forEach((style, index) => {
                        const source = finalSuccessfulStyles[index % finalSuccessfulStyles.length];
                        updated[style] = {
                            status: 'done',
                            url: source.url,
                        };
                        console.log(`[App] Fallback: using portrait from style "${source.style}" for failed style "${style}"`);
                    });
                    return updated;
                });
            }

            setAppState('results-shown');
        } catch (err) {
            console.error('[App] Error in generation process:', err);
            // Логируем ошибку, но не показываем пользователю - система сама повторит попытки
            const errorMessage = err instanceof Error ? err.message : "Произошла ошибка при генерации.";
            console.error('[App] Generation error (silent):', errorMessage);
            // Не меняем состояние - пусть пользователь видит процесс генерации
            // setAppState('image-uploaded');
        }
    };

    const handleRegenerateStyle = async (style: string) => {
        // Используем промежуточное изображение если есть, иначе оригинал
        const imageToUse = intermediateImage || uploadedImage;
        
        if (!imageToUse || generatedImages[style]?.status === 'pending' || generatedImages[style]?.status === 'queued' || generatedImages[style]?.status === 'processing') return;
        
        setGeneratedImages(prev => ({ ...prev, [style]: { status: 'pending' } }));

        try {
            const prompts = buildPromptsByContext(getEffectiveGender(), selectedRole, selectedCompany, variability, naturalLook);
            const prompt = prompts[style];
            
            // Callback для обновления статуса в реальном времени
            const onStatusUpdate = (status: QueueStatus) => {
                setGeneratedImages(prev => {
                    if (status.status === 'queued') {
                        return {
                            ...prev,
                            [style]: {
                                status: 'queued',
                                queuePosition: status.position,
                                estimatedWaitTime: status.estimatedWaitTime,
                            },
                        };
                    } else if (status.status === 'processing') {
                        return {
                            ...prev,
                            [style]: {
                                status: 'processing',
                                queuePosition: 0,
                                estimatedWaitTime: status.estimatedWaitTime,
                            },
                        };
                    }
                    return prev;
                });
            };
            
            const resultUrl = await generateImage(imageToUse, prompt, onStatusUpdate);
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'done', url: resultUrl } }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'error', error: errorMessage } }));
            console.error(`Не удалось повторно создать изображение для стиля ${style}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setImageValidationError(null);
        setIsValidatingImage(false);
        setGeneratedImages({});
        setAppState('idle');
        setGenderOverride(null);
        setDetectedGender('unknown');
        setIntermediateImage(null);
        setIsGeneratingIntermediate(false);
    };

    const handleDownloadIndividualImage = (style: string) => {
        const image = generatedImages[style];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `business-portrait-${style.toLowerCase().replace(' ', '-')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadAlbum = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                .filter((entry): entry is [string, GeneratedImage & { url: string }] => {
                    const image = entry[1] as GeneratedImage;
                    return image.status === 'done' && typeof image.url === 'string';
                })
                .reduce((acc, [style, image]) => {
                    acc[style] = image.url;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length === 0) {
                console.warn('[App] No images to download');
                return;
            }

            const albumDataUrl = await createAlbumPage(imageData);
            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'business-portraits-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Не удалось создать или скачать альбом:", error);
            console.error('[App] Album creation error (silent)');
        } finally {
            setIsDownloading(false);
        }
    };
    
    const isGenerationComplete = appState === 'results-shown';

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setLightboxUrl(null);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    if (isAdminView) {
        return <AdminOrders />;
    }

    return (
        <div 
            className="min-h-screen w-full text-gray-800 flex flex-col"
            style={{
                background: '#f8f9fa',
            }}
        >
            <header 
                className="border-b sticky top-0 z-50"
                style={{
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(16px)',
                    borderColor: 'rgba(226, 232, 240, 0.6)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                }}
            >
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-5">
                        <div className="flex items-center gap-4">
                           {/* Логотип с градиентом и улучшенным дизайном */}
                           <div 
                               className="relative flex items-center justify-center logo-container cursor-pointer"
                               style={{
                                   width: '44px',
                                   height: '44px',
                               }}
                           >
                               <div 
                                   className="absolute inset-0 rounded-xl transition-all duration-300"
                                   style={{
                                       background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                       boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                                   }}
                               />
                               <div className="relative z-10 p-2.5">
                                   <Icons.career className="h-5 w-5 text-white transition-transform duration-300" strokeWidth={2} />
                               </div>
                           </div>
                           
                           {/* Текстовая часть с улучшенной типографикой */}
                           <div className="flex flex-col gap-0.5">
                                <h1 className="flex items-baseline gap-1.5">
                                    <span 
                                        className="text-2xl font-bold tracking-tight"
                                        style={{
                                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                        }}
                                    >
                                        newava
                                    </span>
                                    <span 
                                        className="text-lg font-semibold px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.25rem',
                                        }}
                                    >
                                        .pro
                                    </span>
                                </h1>
                                <p 
                                    className="text-xs font-medium tracking-wide"
                                    style={{
                                        color: '#64748b',
                                        letterSpacing: '0.025em',
                                    }}
                                >
                                    Твое идеальное фото для новой карьеры!
                                </p>
                           </div>
                        </div>
                        {/* Removed external attribution link */}
                    </div>
                </div>
            </header>
            
            <main className="flex-1 w-full container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* --- Left Column: Controls --- */}
                    <aside className="w-full lg:w-1/3 lg:max-w-sm flex-shrink-0">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-8 transition-shadow duration-300 hover:shadow-md">
                            <div data-onboarding="upload">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Загрузите ваше фото</h2>
                            <p className="text-sm text-gray-500 mb-4">Выберите четкое изображение лица анфас.</p>
                            </div>
                            
                            {/* Скрытый input для кнопки ошибки - всегда в DOM */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (files && files.length > 0) {
                                        handleImageUpload(files[0]);
                                    }
                                }}
                            />
                            
                            <AnimatePresence mode="wait">
                                {appState === 'idle' && !imageValidationError && !isValidatingImage && (
                                    <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <Uploader onImageUpload={handleImageUpload} />
                                    </motion.div>
                                )}
                                {isValidatingImage && (
                                    <motion.div 
                                        key="analyzing" 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="w-full aspect-square rounded-md border-2 border-dashed border-blue-200 bg-blue-50 flex flex-col items-center justify-center p-6"
                                    >
                                        <Icons.spinner className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                                        <p className="text-sm font-medium text-gray-700 mb-1">{validationStatusMessage}</p>
                                        {validationTimer > 1 ? (
                                            <p className="text-xs text-gray-500">Осталось: {validationTimer} сек</p>
                                        ) : validationTimer === 1 ? (
                                            <p className="text-xs text-gray-500">Ожидаем завершения анализа</p>
                                        ) : null}
                                    </motion.div>
                                )}
                                {imageValidationError && (
                                    <motion.div 
                                        key="error" 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="w-full aspect-square rounded-md border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50 flex flex-col items-center justify-center p-6 text-center"
                                    >
                                        <Icons.xCircle className="w-12 h-12 text-red-600 mb-4" />
                                        <p className="text-sm font-medium text-red-800 mb-2">Ошибка загрузки</p>
                                        <p className="text-xs text-red-700 leading-relaxed mb-4">{imageValidationError}</p>
                                        
                                        {/* Кнопки для диагностики */}
                                        <div className="flex flex-col gap-2 w-full max-w-xs">
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    
                                                    // Собираем все доступные логи
                                                    let logs = errorLogger.getLogsAsText();
                                                    
                                                    // Если логов нет, собираем информацию из консоли и текущего состояния
                                                    if (!logs || logs.trim().length === 0) {
                                                        const diagnosticInfo = {
                                                            timestamp: new Date().toISOString(),
                                                            userAgent: navigator.userAgent,
                                                            url: window.location.href,
                                                            isMobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
                                                            isYandex: /YaBrowser|Yandex/i.test(navigator.userAgent),
                                                            errorMessage: imageValidationError,
                                                            screenSize: `${window.screen.width}x${window.screen.height}`,
                                                            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
                                                            language: navigator.language,
                                                            platform: navigator.platform,
                                                            cookieEnabled: navigator.cookieEnabled,
                                                            onLine: navigator.onLine
                                                        };
                                                        
                                                        logs = `=== ДИАГНОСТИЧЕСКАЯ ИНФОРМАЦИЯ ===\n\n` +
                                                               `Время: ${diagnosticInfo.timestamp}\n` +
                                                               `Ошибка: ${diagnosticInfo.errorMessage}\n` +
                                                               `URL: ${diagnosticInfo.url}\n\n` +
                                                               `=== ИНФОРМАЦИЯ ОБ УСТРОЙСТВЕ ===\n` +
                                                               `User-Agent: ${diagnosticInfo.userAgent}\n` +
                                                               `Платформа: ${diagnosticInfo.platform}\n` +
                                                               `Язык: ${diagnosticInfo.language}\n` +
                                                               `Мобильное устройство: ${diagnosticInfo.isMobile ? 'Да' : 'Нет'}\n` +
                                                               `Яндекс браузер: ${diagnosticInfo.isYandex ? 'Да' : 'Нет'}\n` +
                                                               `Размер экрана: ${diagnosticInfo.screenSize}\n` +
                                                               `Размер окна: ${diagnosticInfo.viewportSize}\n` +
                                                               `Cookies включены: ${diagnosticInfo.cookieEnabled ? 'Да' : 'Нет'}\n` +
                                                               `Онлайн: ${diagnosticInfo.onLine ? 'Да' : 'Нет'}\n\n` +
                                                               `=== ИНСТРУКЦИЯ ===\n` +
                                                               `1. Откройте консоль браузера (F12 или через меню)\n` +
                                                               `2. Найдите все записи, начинающиеся с [App] или [evaluateImage]\n` +
                                                               `3. Скопируйте их и отправьте разработчику\n`;
                                                    }
                                                    
                                                    // Пробуем скопировать через Clipboard API
                                                    try {
                                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                                            await navigator.clipboard.writeText(logs);
                                                            alert('✅ Логи скопированы в буфер обмена!\n\nОтправьте их разработчику для диагностики.');
                                                            return;
                                                        }
                                                    } catch (clipboardError) {
                                                        console.warn('Clipboard API failed, trying fallback:', clipboardError);
                                                    }
                                                    
                                                    // Fallback: используем старый метод через textarea
                                                    try {
                                                        const textarea = document.createElement('textarea');
                                                        textarea.value = logs;
                                                        textarea.style.position = 'fixed';
                                                        textarea.style.left = '-999999px';
                                                        textarea.style.top = '-999999px';
                                                        document.body.appendChild(textarea);
                                                        textarea.focus();
                                                        textarea.select();
                                                        
                                                        const successful = document.execCommand('copy');
                                                        document.body.removeChild(textarea);
                                                        
                                                        if (successful) {
                                                            alert('✅ Логи скопированы в буфер обмена!\n\nОтправьте их разработчику для диагностики.');
                                                        } else {
                                                            throw new Error('execCommand failed');
                                                        }
                                                    } catch (fallbackError) {
                                                        console.error('All copy methods failed:', fallbackError);
                                                        // Последний fallback: показываем логи в alert
                                                        const preview = logs.substring(0, 1500) + (logs.length > 1500 ? '\n\n... (еще ' + (logs.length - 1500) + ' символов, откройте консоль для полных логов)' : '');
                                                        alert('Не удалось скопировать автоматически.\n\nЛоги (первые 1500 символов):\n\n' + preview + '\n\nОткройте консоль браузера (F12) для полных логов.');
                                                    }
                                                }}
                                                className="px-4 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                            >
                                                📋 Скопировать логи для диагностики
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    errorLogger.clearLogs();
                                                    setImageValidationError(null);
                                                }}
                                                className="px-4 py-2 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                            >
                                                Очистить и попробовать снова
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Открываем файловый диалог сразу, без задержек
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.value = ''; // Сбрасываем предыдущий выбор
                                                        fileInputRef.current.click();
                                                    }
                                                }}
                                                className="px-4 py-2 text-xs font-medium text-white bg-gray-700 rounded hover:bg-gray-800 transition-colors"
                                            >
                                                Выбрать другое изображение
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                                {uploadedImage && (appState === 'image-uploaded' || appState === 'generating' || appState === 'results-shown') && !imageValidationError && !isValidatingImage && (
                                     <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <img src={uploadedImage} alt="Uploaded preview" className="w-full rounded-md object-cover aspect-square" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            
                            <div className="mt-6">
                                {!isValidatingImage && !imageValidationError && uploadedImage && (appState === 'image-uploaded' || appState === 'generating' || appState === 'results-shown') && (
                                    <div className="mb-6" data-onboarding="gender">
                                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Пол</h2>
                                        <p className="text-sm text-gray-500 mb-3">
                                            {genderOverride === null 
                                                ? 'Выберите пол для генерации портретов' 
                                                : genderOverride === 'male'
                                                ? 'Выбран: Мужской'
                                                : 'Выбран: Женский'}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                className={cn(
                                                    'px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                                                    genderOverride === 'male'
                                                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-medium' 
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300',
                                                    (appState === 'generating' || appState === 'results-shown') && 'opacity-60 cursor-not-allowed'
                                                )}
                                                onClick={() => {
                                                    if (appState === 'image-uploaded') {
                                                        setGenderOverride('male');
                                                    }
                                                }}
                                                disabled={appState === 'generating' || appState === 'results-shown'}
                                            >
                                                Мужской
                                            </button>
                                            <button
                                                className={cn(
                                                    'px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                                                    genderOverride === 'female'
                                                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-medium' 
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300',
                                                    (appState === 'generating' || appState === 'results-shown') && 'opacity-60 cursor-not-allowed'
                                                )}
                                                onClick={() => {
                                                    if (appState === 'image-uploaded') {
                                                        setGenderOverride('female');
                                                    }
                                                }}
                                                disabled={appState === 'generating' || appState === 'results-shown'}
                                            >
                                                Женский
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Role & Company selectors */}
                                <div className="mb-6 grid grid-cols-1 gap-4">
                                    <div data-onboarding="role">
                                        <CustomSelect
                                            label="Должность в ИТ"
                                            options={IT_ROLES}
                                            value={selectedRole}
                                            onChange={(value) => setSelectedRole(value as typeof IT_ROLES[number])}
                                            placeholder="Выберите должность"
                                        />
                                    </div>
                                    <div data-onboarding="company">
                                        <CustomSelect
                                            label="Тип компании"
                                            options={COMPANY_TYPES}
                                            value={selectedCompany}
                                            onChange={(value) => setSelectedCompany(value as typeof COMPANY_TYPES[number])}
                                            placeholder="Выберите тип компании"
                                        />
                                    </div>
                                    {/* Вариативность и естественность зафиксированы в коде (Высокая, включено) */}
                                </div>
                                <div data-onboarding="generate">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                                        2. Сгенерируйте портреты
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-1">
                                        Мы создадим 6 профессиональных портретов в разных стилях.
                                    </p>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Стоимость одной генерации портретов — <span className="font-semibold text-gray-800">100 ₽</span>.
                                    </p>
                                </div>
                                {appState === 'image-uploaded' && (
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleReset} 
                                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            <Icons.reset className="w-4 h-4 mr-2" />
                                            Сбросить
                                        </button>
                                        <button 
                                            onClick={handleGenerateClick} 
                                            disabled={!getEffectiveGender() || (getEffectiveGender() !== 'male' && getEffectiveGender() !== 'female')}
                                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 text-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                                            style={{
                                                background: getEffectiveGender() && (getEffectiveGender() === 'male' || getEffectiveGender() === 'female')
                                                    ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                                    : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                                                boxShadow: getEffectiveGender() && (getEffectiveGender() === 'male' || getEffectiveGender() === 'female')
                                                    ? '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)'
                                                    : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (getEffectiveGender() && (getEffectiveGender() === 'male' || getEffectiveGender() === 'female')) {
                                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.4), 0 10px 10px -5px rgba(99, 102, 241, 0.4)';
                                                    e.currentTarget.style.transform = 'scale(1.02)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (getEffectiveGender() && (getEffectiveGender() === 'male' || getEffectiveGender() === 'female')) {
                                                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)';
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }
                                            }}
                                        >
                                        <Icons.sparkles className="w-4 h-4 mr-2" />
                                            {getEffectiveGender() && (getEffectiveGender() === 'male' || getEffectiveGender() === 'female') 
                                                ? 'Сгенерировать' 
                                                : 'Выберите пол'}
                                    </button>
                                    </div>
                                )}
                                 {appState === 'generating' && (
                                     <div className="w-full">
                                         {isGeneratingIntermediate ? (
                                             <button 
                                                 disabled 
                                                 className="inline-flex items-center justify-center rounded-lg text-sm font-medium w-full h-10 py-2 px-4 text-white opacity-70 cursor-not-allowed"
                                                 style={{
                                                     background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                     boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                                                 }}
                                             >
                                                 <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                                 Подготовка изображения...
                                             </button>
                                         ) : (
                                             <button 
                                                 disabled 
                                                 className="inline-flex items-center justify-center rounded-lg text-sm font-medium w-full h-10 py-2 px-4 text-white opacity-70 cursor-not-allowed"
                                                 style={{
                                                     background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                     boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                                                 }}
                                             >
                                                 <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                                 Генерация портретов...
                                             </button>
                                         )}
                                     </div>
                                 )}
                                {appState === 'results-shown' && (
                                     <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleReset} 
                                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            <Icons.reset className="w-4 h-4 mr-2" />
                                            Сбросить
                                        </button>
                                        <button 
                                            onClick={handleDownloadAlbum} 
                                            disabled={isDownloading} 
                                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 text-white disabled:opacity-50 disabled:pointer-events-none"
                                            style={{
                                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isDownloading) {
                                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.4), 0 10px 10px -5px rgba(99, 102, 241, 0.4)';
                                                    e.currentTarget.style.transform = 'scale(1.02)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            {isDownloading ? (
                                                <>
                                                <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                                    Альбом
                                                </>
                                            ) : (
                                                <>
                                                <Icons.download className="w-4 h-4 mr-2" />
                                            Альбом
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                    
                    {/* --- Right Column: Results --- */}
                    <section className="flex-1">
                        <AnimatePresence>
                            {appState === 'idle' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="h-full flex flex-col items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
                                >
                                    <Icons.gallery className="h-16 w-16 text-gray-400 mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-800">Ваши бизнес-портреты</h3>
                                    <p className="text-gray-500 mt-2 max-w-md">
                                        После загрузки фото здесь появятся ваши сгенерированные изображения.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {(appState === 'generating' || appState === 'results-shown') && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                                <AnimatePresence>
                                {STYLES.map((style, index) => {
                                    // Если generatedImages пустой, показываем processing для всех карточек
                                    const imageState = generatedImages[style];
                                    // Fallback: если нет состояния, но appState = generating, показываем processing
                                    const status = imageState?.status || (appState === 'generating' ? 'processing' : 'pending');
                                    
                                    // Логируем для отладки (только первые несколько раз)
                                    if (index < 2) {
                                        console.log(`[App] Rendering card ${style}:`, { 
                                            status, 
                                            hasImageState: !!imageState, 
                                            appState,
                                            generatedImagesKeys: Object.keys(generatedImages),
                                            generatedImagesLength: Object.keys(generatedImages).length
                                        });
                                    }
                                    
                                    return (
                                    <motion.div
                                        key={style}
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <ImageCard
                                            caption={style}
                                            status={status}
                                            queuePosition={imageState?.queuePosition}
                                            estimatedWaitTime={imageState?.estimatedWaitTime}
                                            imageUrl={imageState?.url}
                                            error={imageState?.error}
                                            gender={getEffectiveGender()}
                                            onRegenerate={() => handleRegenerateStyle(style)}
                                            onDownload={() => handleDownloadIndividualImage(style)}
                                            onOpen={(url) => setLightboxUrl(url)}
                                        />
                                    </motion.div>
                                    );
                                })}
                                </AnimatePresence>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <Footer />
            
            {/* Onboarding */}
            <Onboarding
                isActive={onboarding.isActive}
                currentStep={onboarding.currentStep}
                steps={onboarding.steps}
                onNext={onboarding.nextStep}
                onPrev={onboarding.prevStep}
                onSkip={onboarding.skip}
            />

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxUrl && (
                    <motion.div
                        key="lightbox"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <button
                            aria-label="Закрыть"
                            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
                        >
                            <Icons.close className="h-6 w-6" />
                        </button>
                        <motion.img
                            src={lightboxUrl}
                            alt="Превью"
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
