/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage, detectGender, type DetectedGender, type GenderDetectionResult } from './services/geminiService';
import { createAlbumPage } from './lib/albumUtils';
import Footer from './components/Footer';
import Uploader from './components/Uploader';
import ImageCard from './components/ImageCard';
import { Icons } from './components/Icons';
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
    const femaleNote = 'Subtle natural makeup allowed.';
    const baseFemale = 'No facial hair. No beard. No mustache. ' + femaleNote;
    const baseMale = 'Grooming neat and professional.';

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
    gender: DetectedGender,
    role: string,
    company: string,
    variability: VariabilityLevel,
    naturalLook: boolean,
): Record<string, string> {
    const constraints = gender === 'female'
        ? 'No facial hair. No beard. No mustache. Feminine grooming and makeup allowed but subtle and natural.'
        : 'Grooming should be neat and professional.';
    const roleDesc = describeRole(role);
    const companyDesc = describeCompany(company);
    const attire = attireByContext(gender, role, company);
    const naturality = naturalLook
        ? 'Photorealistic and authentic. Preserve identity and facial features. Natural skin texture, no plastic skin, no over-smoothing, no AI artifacts.'
        : '';
    const base = (tone: string) => {
        const v = buildVariations(variability); // new random per style call
        return `Create a professional, high-resolution ${gender === 'female' ? 'female ' : gender === 'male' ? 'male ' : ''}business portrait of the person in the photo, suitable for a LinkedIn profile. The style should be ${tone}. ${constraints} Attire: ${attire}. Lighting: ${v.lighting}. Lens & crop: ${v.lens}. Background: ${v.background}. Color grade: ${v.grade}. Pose: ${v.pose}. ${naturality} Each image in this batch must show a distinct outfit and feel; avoid repeating garments across images. Context: ${roleDesc}; ${companyDesc}.`;
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

type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown';

function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppState>('idle');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [detectedGender, setDetectedGender] = useState<DetectedGender>('unknown');
    const [genderOverride, setGenderOverride] = useState<'male' | 'female'>('female');
    const [selectedRole, setSelectedRole] = useState<typeof IT_ROLES[number]>('Разработчик');
    const [selectedCompany, setSelectedCompany] = useState<typeof COMPANY_TYPES[number]>('Стартап');
    const [variability, setVariability] = useState<VariabilityLevel>('medium');
    const [naturalLook, setNaturalLook] = useState<boolean>(true);

    const getEffectiveGender = (): DetectedGender => genderOverride;

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedImage(reader.result as string);
            setAppState('image-uploaded');
            setGeneratedImages({}); // Clear previous results
            // Detect gender immediately after upload (best-effort)
            const dataUrl = reader.result as string;
            (async () => {
                try {
                    const detection: GenderDetectionResult = await detectGender(dataUrl);
                    setDetectedGender(detection.gender);
                    // Auto-apply only if high confidence >= 0.9 and only if user не переключал вручную после этого
                    if ((detection.gender === 'male' || detection.gender === 'female') && detection.confidence >= 0.9) {
                        setGenderOverride(detection.gender);
                    }
                } catch {
                    // ignore
                }
            })();
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;

        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        STYLES.forEach(style => {
            initialImages[style] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 1;
        const stylesQueue = [...STYLES];

        const processStyle = async (style: string) => {
            try {
                const prompts = buildPromptsByContext(getEffectiveGender(), selectedRole, selectedCompany, variability, naturalLook);
                const prompt = prompts[style];
                const resultUrl = await generateImage(uploadedImage, prompt);
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

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (stylesQueue.length > 0) {
                const style = stylesQueue.shift();
                if (style) {
                    await processStyle(style);
                }
            }
        });

        await Promise.all(workers);
        setAppState('results-shown');
    };

    const handleRegenerateStyle = async (style: string) => {
        if (!uploadedImage || generatedImages[style]?.status === 'pending') return;
        
        setGeneratedImages(prev => ({ ...prev, [style]: { status: 'pending' } }));

        try {
            const prompts = buildPromptsByContext(getEffectiveGender(), selectedRole, selectedCompany, variability, naturalLook);
            const prompt = prompts[style];
            const resultUrl = await generateImage(uploadedImage, prompt);
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'done', url: resultUrl } }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'error', error: errorMessage } }));
            console.error(`Не удалось повторно создать изображение для стиля ${style}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
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
        <div className="min-h-screen w-full bg-gray-50 text-gray-800 flex flex-col">
            <header className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center gap-2">
                           <Icons.logo className="h-8 w-8 text-blue-600" />
                            <h1 className="text-xl font-semibold text-gray-900">newava.pro</h1>
                        </div>
                        {/* Removed external attribution link */}
                    </div>
                </div>
            </header>
            
            <main className="flex-1 w-full container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* --- Left Column: Controls --- */}
                    <aside className="w-full lg:w-1/3 lg:max-w-sm flex-shrink-0">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm sticky top-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Загрузите ваше фото</h2>
                            <p className="text-sm text-gray-500 mb-4">Выберите четкое изображение лица анфас.</p>
                            
                            <AnimatePresence mode="wait">
                                {appState === 'idle' && (
                                    <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <Uploader onImageUpload={handleImageUpload} />
                                    </motion.div>
                                )}
                                {(appState !== 'idle') && uploadedImage && (
                                     <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <img src={uploadedImage} alt="Uploaded preview" className="w-full rounded-md object-cover aspect-square" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            
                            <div className="mt-6">
                                {uploadedImage && (
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Пол</h2>
                                        <p className="text-sm text-gray-500 mb-3">Выберите пол (автоопределение применяется только при высокой уверенности).</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                className={cn('px-3 py-2 text-sm rounded-md border', genderOverride === 'male' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700')}
                                                onClick={() => setGenderOverride('male')}
                                            >
                                                Мужской
                                            </button>
                                            <button
                                                className={cn('px-3 py-2 text-sm rounded-md border', genderOverride === 'female' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700')}
                                                onClick={() => setGenderOverride('female')}
                                            >
                                                Женский
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Role & Company selectors */}
                                <div className="mb-6 grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Должность в ИТ</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-800"
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value as typeof IT_ROLES[number])}
                                        >
                                            {IT_ROLES.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип компании</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-800"
                                            value={selectedCompany}
                                            onChange={(e) => setSelectedCompany(e.target.value as typeof COMPANY_TYPES[number])}
                                        >
                                            {COMPANY_TYPES.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Вариативность</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-800"
                                            value={variability}
                                            onChange={(e) => setVariability(e.target.value as VariabilityLevel)}
                                        >
                                            <option value="low">Низкая</option>
                                            <option value="medium">Средняя</option>
                                            <option value="high">Высокая</option>
                                        </select>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300"
                                            checked={naturalLook}
                                            onChange={(e) => setNaturalLook(e.target.checked)}
                                        />
                                        Максимальная естественность (минимум ИИ‑артефактов)
                                    </label>
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Сгенерируйте портреты</h2>
                                <p className="text-sm text-gray-500 mb-4">Мы создадим 6 профессиональных портретов в разных стилях.</p>
                                {appState === 'image-uploaded' && (
                                    <button onClick={handleGenerateClick} className="enterprise-button-primary w-full">
                                        <Icons.sparkles className="w-4 h-4 mr-2" />
                                        Сгенерировать
                                    </button>
                                )}
                                 {appState === 'generating' && (
                                    <button disabled className="enterprise-button-primary w-full opacity-70 cursor-not-allowed">
                                        <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                        Генерация...
                                    </button>
                                )}
                                {appState === 'results-shown' && (
                                     <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleReset} className="enterprise-button-secondary w-full">
                                            <Icons.reset className="w-4 h-4 mr-2" />
                                            Сбросить
                                        </button>
                                        <button onClick={handleDownloadAlbum} disabled={isDownloading} className="enterprise-button-primary w-full">
                                            {isDownloading ? (
                                                <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Icons.download className="w-4 h-4 mr-2" />
                                            )}
                                            Альбом
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
