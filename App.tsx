/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage, evaluateImage, type DetectedGender, type QueueStatus, type ImageEvaluationResult } from './services/geminiService';
import { createAlbumPage } from './lib/albumUtils';
import Footer from './components/Footer';
import Uploader from './components/Uploader';
import ImageCard from './components/ImageCard';
import { Icons } from './components/Icons';
import { CustomSelect } from './components/CustomSelect';
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
        : 'Preserve facial hair exactly as shown in the original photo. If there is no facial hair (no beard, no mustache) in the original photo, do not add any facial hair. Do not remove facial hair if it exists in the original. Grooming should be neat and professional, maintaining the original facial hair pattern.';
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
        
        return `Create a professional, high-resolution ${gender === 'female' ? 'female ' : gender === 'male' ? 'male ' : ''}business portrait of the person in the photo, suitable for a LinkedIn profile. ${genderInstruction} The style should be ${tone}. ${constraints} Attire: ${attire}. Lighting: ${v.lighting}. Lens & crop: ${v.lens}. Background: ${v.background}. Color grade: ${v.grade}. Pose: ${v.pose}. ${naturality} ${skinDetail} Each image in this batch must show a distinct outfit and feel; avoid repeating garments across images. Context: ${roleDesc}; ${companyDesc}.`;
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
    const fileInputRef = React.useRef<HTMLInputElement>(null);
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
    // Fixed settings per request: always High variability and maximum naturalness
    const variability: VariabilityLevel = 'high';
    const naturalLook: boolean = true;

    const getEffectiveGender = (): DetectedGender | null => {
        // Возвращаем выбранный пол (автоматически или вручную)
        // Если null - пол не выбран, генерация недоступна
        return genderOverride;
    };

    // Таймер для оценки изображения
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (isValidatingImage) {
            setValidationTimer(0);
            intervalId = setInterval(() => {
                setValidationTimer(prev => prev + 1);
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

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            
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
                        // Обновляем таймер на основе remainingTime
                        if (status.remainingTime !== undefined) {
                            const remainingSeconds = Math.ceil(status.remainingTime / 1000);
                            setValidationTimer(remainingSeconds);
                        }
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
                    console.error('Error evaluating image:', error);
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
        reader.readAsDataURL(file);
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;
        
        // Проверяем, что пол выбран
        const effectiveGender = getEffectiveGender();
        if (!effectiveGender || (effectiveGender !== 'male' && effectiveGender !== 'female')) {
            alert('Пожалуйста, выберите пол перед генерацией портретов.');
            return;
        }

        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        STYLES.forEach(style => {
            initialImages[style] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        // Генерируем все 6 стилей параллельно
        const prompts = buildPromptsByContext(getEffectiveGender(), selectedRole, selectedCompany, variability, naturalLook);
        
        const processStyle = async (style: string) => {
            try {
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
                
                const resultUrl = await generateImage(uploadedImage, prompt, onStatusUpdate);
                setGeneratedImages(prev => ({
                    ...prev,
                    [style]: { status: 'done', url: resultUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
                setGeneratedImages(prev => ({
                    ...prev,
                    [style]: { status: 'error', error: errorMessage },
                }));
                console.error(`Не удалось создать изображение для стиля ${style}:`, err);
            }
        };

        // Запускаем все 6 генераций одновременно
        await Promise.all(STYLES.map(style => processStyle(style)));
        setAppState('results-shown');
    };

    const handleRegenerateStyle = async (style: string) => {
        if (!uploadedImage || generatedImages[style]?.status === 'pending' || generatedImages[style]?.status === 'queued' || generatedImages[style]?.status === 'processing') return;
        
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
            
            const resultUrl = await generateImage(uploadedImage, prompt, onStatusUpdate);
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
                alert("Нет сгенерированных изображений для скачивания.");
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
            alert("К сожалению, произошла ошибка при создании вашего альбома. Пожалуйста, попробуйте еще раз.");
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
                                    Твое идеальное фото для новой карьеры
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
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Загрузите ваше фото</h2>
                            <p className="text-sm text-gray-500 mb-4">Выберите четкое изображение лица анфас.</p>
                            
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
                                        {validationTimer > 0 && (
                                            <p className="text-xs text-gray-500">Осталось: ~{validationTimer} сек</p>
                                        )}
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
                                        <p className="text-xs text-red-700 leading-relaxed">{imageValidationError}</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Открываем файловый диалог сразу, без задержек
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = ''; // Сбрасываем предыдущий выбор
                                                    fileInputRef.current.click();
                                                }
                                            }}
                                            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
                                        >
                                            Выбрать другое изображение
                                        </button>
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
                                    <div className="mb-6">
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
                                    <CustomSelect
                                        label="Должность в ИТ"
                                        options={IT_ROLES}
                                        value={selectedRole}
                                        onChange={(value) => setSelectedRole(value as typeof IT_ROLES[number])}
                                        placeholder="Выберите должность"
                                    />
                                    <CustomSelect
                                        label="Тип компании"
                                        options={COMPANY_TYPES}
                                        value={selectedCompany}
                                        onChange={(value) => setSelectedCompany(value as typeof COMPANY_TYPES[number])}
                                        placeholder="Выберите тип компании"
                                    />
                                    {/* Вариативность и естественность зафиксированы в коде (Высокая, включено) */}
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Сгенерируйте портреты</h2>
                                <p className="text-sm text-gray-500 mb-4">Мы создадим 6 профессиональных портретов в разных стилях.</p>
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
                                    <button 
                                        disabled 
                                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium w-full h-10 py-2 px-4 text-white opacity-70 cursor-not-allowed"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                                        }}
                                    >
                                        <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                        Генерация...
                                    </button>
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
                                {STYLES.map((style, index) => (
                                    <motion.div
                                        key={style}
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <ImageCard
                                            caption={style}
                                            status={generatedImages[style]?.status || 'pending'}
                                            queuePosition={generatedImages[style]?.queuePosition}
                                            estimatedWaitTime={generatedImages[style]?.estimatedWaitTime}
                                            imageUrl={generatedImages[style]?.url}
                                            error={generatedImages[style]?.error}
                                            onRegenerate={() => handleRegenerateStyle(style)}
                                            onDownload={() => handleDownloadIndividualImage(style)}
                                            onOpen={(url) => setLightboxUrl(url)}
                                        />
                                    </motion.div>
                                ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <Footer />

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
