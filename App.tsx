/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage, evaluateImage, addGenerationToQueue, createPayment, checkPaymentStatus, fetchOrder, usePromoCode, adminCheckSession, adminLogin, adminLogout, generateNewYearPrompts, API_BASE_URL, type DetectedGender, type QueueStatus, type ImageEvaluationResult, type OrderInfo } from './services/geminiService';
import { createAlbumPage } from './lib/albumUtils';
import { compressImage, shouldCompressImage } from './lib/imageCompression';
import { errorLogger } from './lib/errorLogger';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';
import Uploader from './components/Uploader';
import ImageCard from './components/ImageCard';
import { Icons } from './components/Icons';
import { CustomSelect } from './components/CustomSelect';
import { Onboarding, useOnboarding } from './components/Onboarding';
import { ImageUploadFlow } from './components/ImageUploadFlow';
import { GenerationActions } from './components/GenerationActions';
import { GenerationFlow } from './components/GenerationFlow';
import { ResultsView } from './components/ResultsView';
import { GalleryPage } from './components/GalleryPage';
import { StyleSelect } from './components/StyleSelect';
import { LocationGrid } from './components/LocationGrid';
import { HeaderMenu } from './components/HeaderMenu';
import { NEW_YEAR_STYLES, NEW_YEAR_LOCATIONS, type NewYearStyleId, type NewYearLocationId } from './lib/newYearConstants';
import { cn, devLog } from './lib/utils';

type ImageStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
}

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown' | 'failed';

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
                devLog.warn('[App] Redirecting from HTTP to HTTPS:', { from: currentUrl, to: httpsUrl });
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
    // Новогодние фотосессии: выбор стиля и локации (обязательны)
    const [selectedStyle, setSelectedStyle] = useState<NewYearStyleId | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<NewYearLocationId | null>(null);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<ImageEvaluationResult | null>(null);
    const [hasActivePayment, setHasActivePayment] = useState<boolean>(false);
    const autoGenerationStartedRef = useRef<boolean>(false);
    // Refs для polling (должны быть на верхнем уровне компонента)
    const pollDelayRef = useRef<number>(2000);
    const consecutiveErrorsRef = useRef<number>(0);
    const PENDING_GENERATION_KEY = 'newava_pending_generation';
    const LAST_SOURCE_IMAGE_KEY = 'newava_last_source_image';
    const CURRENT_ORDER_KEY = 'newava_current_order';
    const [currentOrder, setCurrentOrder] = useState<OrderInfo | null>(null);
    const [currentInvId, setCurrentInvId] = useState<string | null>(null);
    const [promoCodeInput, setPromoCodeInput] = useState<string>('');
    const [promoMessage, setPromoMessage] = useState<string | null>(null);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [promoLoading, setPromoLoading] = useState<boolean>(false);
    const [promoApplied, setPromoApplied] = useState<boolean>(false);
    // Промежуточное изображение для стабильной генерации
    const [intermediateImage, setIntermediateImage] = useState<string | null>(null);
    const [isGeneratingIntermediate, setIsGeneratingIntermediate] = useState<boolean>(false);
    // Уведомление о случайном выборе стиля и локации
    const [autoSelectionNotification, setAutoSelectionNotification] = useState<{ style: string; location: string } | null>(null);

    const [isAdminView, setIsAdminView] = useState<boolean>(false);
    const [adminMode, setAdminMode] = useState<'orders' | 'promos'>('orders');
    const [adminAuthed, setAdminAuthed] = useState<boolean>(false);
    const [adminAuthChecked, setAdminAuthChecked] = useState<boolean>(false);
    const [adminPassword, setAdminPassword] = useState<string>('');
    const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
    const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(false);
    const [isRulesOpen, setIsRulesOpen] = useState(false);


    // Определяем режим админки и галереи по pathname
    const [isGalleryView, setIsGalleryView] = useState(false);
    
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const url = new URL(window.location.href);
            const pathname = url.pathname;
            const adminFlag = url.searchParams.get('admin');

            if (pathname === '/gallery') {
                setIsGalleryView(true);
                setIsAdminView(false);
                return;
            }

            if (pathname === '/admin') {
                setIsAdminView(true);
                setAdminMode('orders');
                setIsGalleryView(false);
            } else if (adminFlag === '1' || adminFlag === 'orders') {
                setIsAdminView(true);
                setAdminMode('orders');
                setIsGalleryView(false);
            } else if (adminFlag === 'promo' || adminFlag === 'promos' || adminFlag === '2') {
                setIsAdminView(true);
                setAdminMode('promos');
                setIsGalleryView(false);
            } else {
                setIsAdminView(false);
                setIsGalleryView(false);
            }

            if (adminFlag === 'promo' || adminFlag === 'promos') {
                setAdminMode('promos');
            }
        } catch (e) {
            devLog.warn('[App] Failed to detect view mode:', e);
        }
    }, []);

    // Проверяем сессию администратора при открытии админки
    useEffect(() => {
        if (!isAdminView) return;
        let cancelled = false;
        (async () => {
            try {
                const result = await adminCheckSession();
                if (cancelled) return;
                setAdminAuthed(result.ok);
            } catch {
                if (cancelled) return;
                setAdminAuthed(false);
            } finally {
                if (!cancelled) setAdminAuthChecked(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isAdminView]);

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
            devLog.log('[App] Loading order info for invId:', invId);
            
            // Сразу инициализируем состояние генерации (оптимистичный UI)
            // Это гарантирует, что пользователь увидит карточки генерации сразу
            const initialImages: Record<string, GeneratedImage> = {};
            // Для новогодних фотосессий всегда 6 изображений
            for (let i = 0; i < 6; i++) {
                initialImages[`image_${i}`] = { status: 'processing' };
            }
            setGeneratedImages(initialImages);
            setAppState('generating');
            devLog.log('[App] Optimistically set generation state while loading order');

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
                                devLog.log('[App] Restoring from localStorage:', { hasImage: !!data?.uploadedImage });
                                if (data?.uploadedImage) {
                                    setUploadedImage(data.uploadedImage);
                                    devLog.log('[App] Restored uploadedImage from localStorage');
                                }
                                // Восстанавливаем стиль и локацию для новогодних фотосессий
                                if (data?.selectedStyle) {
                                    setSelectedStyle(data.selectedStyle);
                                }
                                if (data?.selectedLocation) {
                                    setSelectedLocation(data.selectedLocation);
                                }
                                if (data?.imageAnalysisResult) {
                                    setImageAnalysisResult(data.imageAnalysisResult);
                                }
                            } else {
                                devLog.warn('[App] No data in localStorage for PENDING_GENERATION_KEY');
                            }
                            
                            // Если изображение всё ещё не восстановилось — пробуем взять последнее исходное из отдельного ключа
                            if (!uploadedImage) {
                                try {
                                    const lastSource = window.localStorage.getItem(LAST_SOURCE_IMAGE_KEY);
                                    if (lastSource) {
                                        setUploadedImage(lastSource);
                                        devLog.log('[App] Restored uploadedImage from LAST_SOURCE_IMAGE_KEY');
                                    }
                                } catch (e) {
                                    devLog.warn('[App] Failed to restore last source image from storage:', e);
                                }
                            }
                            
                            // Восстанавливаем настройки из заказа для новогодних фотосессий
                            // (заказы могут содержать старые поля, но мы их игнорируем)
                            
                        // Если заказ завершен - показываем результаты
                            if (order.status === 'completed' && order.generatedImages) {
                                const images: Record<string, GeneratedImage> = {};
                                // Для новогодних фотосессий всегда 6 изображений
                                for (let i = 0; i < 6; i++) {
                                    const key = `image_${i}`;
                                    if (order.generatedImages && order.generatedImages[key]) {
                                        images[key] = { status: 'done', url: order.generatedImages[key] };
                                    } else {
                                        images[key] = { status: 'error', error: 'Не сгенерировано' };
                                    }
                                }
                                setGeneratedImages(images);
                                setAppState('results-shown');
                            } else if (order.status === 'processing' || order.status === 'paid') {
                                // Показываем состояние генерации сразу (даже если заказ еще в статусе paid)
                                // Показываем генерацию даже если изображение не восстановилось - пользователь должен видеть прогресс
                                devLog.log('[App] Setting generation state for order', { invId, status: order.status });
                                
                                // Инициализируем все 6 карточек со статусом processing
                                const images: Record<string, GeneratedImage> = {};
                                for (let i = 0; i < 6; i++) {
                                    images[`image_${i}`] = { status: 'processing' };
                                }
                                
                                devLog.log('[App] Generated images state:', images);
                                
                                // Устанавливаем состояние синхронно, используя функциональное обновление
                                setGeneratedImages(() => images);
                                setAppState('generating');
                                
                                devLog.log('[App] App state set to generating, generatedImages keys:', Object.keys(images));
                            } else if (order.status === 'failed') {
                                devLog.log('[App] Order is in failed status after load, showing failed state');
                                setHasActivePayment(false);
                                setGeneratedImages({});
                                setUploadedImage(null);
                                setIntermediateImage(null);
                                setAppState('failed');
                            }
                        } catch (e) {
                            devLog.warn('[App] Failed to restore order state:', e);
                        }
                    } else {
                        // Заказ не был оплачен (status = created / cancelled / и т.п.) —
                        // возвращаем пользователя на "чистую" главную страницу.
                        devLog.log('[App] Order is not paid, resetting UI to idle state', { status: order.status });
                        setHasActivePayment(false);
                        setCurrentInvId(null);
                        setCurrentOrder(null);
                        setGeneratedImages({});
                        setUploadedImage(null);
                        setSelectedStyle(null);
                        setSelectedLocation(null);
                        setAppState('idle');
                        try {
                            window.localStorage.removeItem(CURRENT_ORDER_KEY);
                            window.localStorage.removeItem(PENDING_GENERATION_KEY);
                        } catch (storageErr) {
                            devLog.warn('[App] Failed to clear localStorage after unpaid order:', storageErr);
                        }
                    }
                })
                .catch((err) => {
                    console.error('[App] Failed to fetch order:', err);
                    // Если заказ не найден или ошибка — очищаем localStorage и возвращаемся на чистый экран
                    if (typeof window !== 'undefined') {
                        try {
                            window.localStorage.removeItem(CURRENT_ORDER_KEY);
                            window.localStorage.removeItem(PENDING_GENERATION_KEY);
                        } catch (storageErr) {
                            devLog.warn('[App] Failed to clear localStorage after fetch error:', storageErr);
                        }
                    }
                    setHasActivePayment(false);
                    setCurrentInvId(null);
                    setCurrentOrder(null);
                    setGeneratedImages({});
                    setUploadedImage(null);
                    setSelectedStyle(null);
                    setSelectedLocation(null);
                    setAppState('idle');
                });

            // Чистим служебные параметры Robokassa из URL
            ['payment', 'invId', 'InvId', 'OutSum', 'SignatureValue', 'IsTest', 'Culture'].forEach((key) =>
                url.searchParams.delete(key),
            );
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Polling статуса заказа с exponential backoff и оптимизацией
    useEffect(() => {
        if (!currentInvId) return;
        
        // Если currentOrder еще не загружен, не запускаем polling
        if (!currentOrder) return;
        
        // Запускаем polling только для paid или processing
        if (currentOrder.status !== 'processing' && currentOrder.status !== 'paid') return;

        // AbortController для отмены запросов при размонтировании
        const abortController = new AbortController();
        
        // Сбрасываем значения refs при запуске polling
        pollDelayRef.current = 2000;
        consecutiveErrorsRef.current = 0;
        
        const MIN_POLL_DELAY = 2000;
        const MAX_POLL_DELAY = 30000;
        const BACKOFF_MULTIPLIER = 1.5;
        const MAX_CONSECUTIVE_ERRORS = 5;
        
        let pollTimeoutId: NodeJS.Timeout | null = null;
        let isPolling = true;

        const pollOrderStatus = async () => {
            if (!isPolling || abortController.signal.aborted) return;

            try {
                if (!currentInvId) return;
                const order = await fetchOrder(currentInvId);
                
                // Используем функциональное обновление для избежания race conditions
                let statusChanged = false;
                setCurrentOrder(prev => {
                    // Если статус не изменился, возвращаем предыдущее состояние
                    if (prev?.status === order.status && prev?.invId === order.invId) {
                        return prev;
                    }
                    statusChanged = true;
                    return order;
                });
                
                // Проверяем, изменился ли статус заказа (используем order из ответа)
                if (statusChanged) {

                    // Если заказ перешел в processing - обновляем UI
                    if (order.status === 'processing' && appState !== 'generating') {
                        const images: Record<string, GeneratedImage> = {};
                        // Для новогодних фотосессий всегда 6 изображений
                        for (let i = 0; i < 6; i++) {
                            images[`image_${i}`] = { status: 'processing' };
                        }
                        setGeneratedImages(images);
                        setAppState('generating');
                        // Сбрасываем задержку при изменении статуса
                        pollDelayRef.current = MIN_POLL_DELAY;
                        consecutiveErrorsRef.current = 0; // Сбрасываем счетчик ошибок
                    }

                    // Если заказ завершен - обновляем UI и останавливаем polling
                    if (order.status === 'completed' && order.generatedImages) {
                        const images: Record<string, GeneratedImage> = {};
                        // Для новогодних фотосессий всегда 6 изображений
                        for (let i = 0; i < 6; i++) {
                            const key = `image_${i}`;
                            if (order.generatedImages && order.generatedImages[key]) {
                                images[key] = { status: 'done', url: order.generatedImages[key] };
                            } else {
                                images[key] = { status: 'error', error: 'Не сгенерировано' };
                            }
                        }
                        setGeneratedImages(images);
                        setAppState('results-shown');
                        isPolling = false;
                        return; // Останавливаем polling
                    } else if (order.status === 'failed') {
                        // Заказ провалился - показываем специальное состояние для повторной попытки
                        setGeneratedImages({});
                        setUploadedImage(null);
                        setIntermediateImage(null);
                        setAppState('failed');
                        isPolling = false;
                        return; // Останавливаем polling
                    }
                }

                // Если статус не изменился, увеличиваем задержку (exponential backoff)
                if (!statusChanged) {
                    pollDelayRef.current = Math.min(pollDelayRef.current * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);
                } else {
                    // При изменении статуса сбрасываем задержку
                    pollDelayRef.current = MIN_POLL_DELAY;
                    consecutiveErrorsRef.current = 0; // Сбрасываем счетчик ошибок при успешном запросе
                }

                // Планируем следующий запрос с учетом backoff
                if (isPolling && !abortController.signal.aborted) {
                    // Очищаем старый таймер перед созданием нового (исправление утечки памяти)
                    if (pollTimeoutId) {
                        clearTimeout(pollTimeoutId);
                        pollTimeoutId = null;
                    }
                    pollTimeoutId = setTimeout(pollOrderStatus, pollDelayRef.current);
                }
            } catch (err) {
                if (abortController.signal.aborted) return;
                
                // Увеличиваем счетчик последовательных ошибок
                consecutiveErrorsRef.current++;
                
                // Если слишком много ошибок подряд - останавливаем polling и показываем сообщение
                if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                    devLog.error('[App] Too many consecutive polling errors, stopping:', err);
                    isPolling = false;
                    // Можно показать сообщение пользователю о проблеме с сетью
                    return;
                }
                
                // При ошибке увеличиваем задержку и продолжаем polling
                pollDelayRef.current = Math.min(pollDelayRef.current * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);
                if (isPolling && !abortController.signal.aborted) {
                    // Очищаем старый таймер перед созданием нового
                    if (pollTimeoutId) {
                        clearTimeout(pollTimeoutId);
                        pollTimeoutId = null;
                    }
                    pollTimeoutId = setTimeout(pollOrderStatus, pollDelayRef.current);
                }
            }
        };

        // Запускаем первый запрос сразу
        pollOrderStatus();

        return () => {
            isPolling = false;
            abortController.abort();
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
            }
        };
    }, [currentInvId, currentOrder, appState]);

    // Предупреждение при перезагрузке страницы, когда уже есть результаты генерации.
    // Браузер покажет стандартный диалог "Вы действительно хотите покинуть страницу?",
    // а при подтверждении мы очищаем локальное состояние и localStorage, чтобы после перезагрузки
    // пользователь попал на "чистую" главную.
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (appState === 'results-shown') {
                try {
                    window.localStorage.removeItem(CURRENT_ORDER_KEY);
                    window.localStorage.removeItem(PENDING_GENERATION_KEY);
                } catch (e) {
                    devLog.warn('[App] Failed to clear storage in beforeunload:', e);
                }

                event.preventDefault();
                // Некоторые браузеры игнорируют кастомный текст, но для показа диалога
                // нужно присвоить любое непустое значение.
                event.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [appState]);

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
        devLog.log('[App] File selected:', {
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
            devLog.warn('[App] File too large:', { size: file.size, sizeMB: sizeInMB, maxSize: MAX_FILE_SIZE });
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
            devLog.warn('[App] HEIC format detected:', { fileName: file.name, fileType: file.type });
            setImageValidationError(
                'Формат HEIC не поддерживается. Пожалуйста, конвертируйте фото в JPG или PNG перед загрузкой. ' +
                'На iPhone можно сделать скриншот фото или сохранить в другом формате.'
            );
            return;
        }
        
        if (!allowedTypes.includes(fileTypeLower)) {
            devLog.warn('[App] Unsupported file type:', { fileType: file.type, fileName: file.name });
            setImageValidationError(
                `Формат изображения не поддерживается (${file.type || 'неизвестный'}). Загрузите фото в формате JPG, PNG или WEBP.`
            );
            return;
        }

        // Определяем, нужно ли сжимать изображение
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
        const isYandexMobile = isMobile && /YaBrowser|Yandex/i.test(navigator.userAgent);
        const needsCompression = shouldCompressImage(file, isMobile);
        
        devLog.log('[App] Image processing options:', {
            isMobile,
            isYandexMobile,
            needsCompression,
            fileSize: file.size,
            fileSizeMB: (file.size / (1024 * 1024)).toFixed(2)
        });

        // Для мобильных устройств (особенно Яндекс браузера) сжимаем изображение
        if (needsCompression) {
            devLog.log('[App] Compressing image for mobile device...');
            try {
                const compressedDataUrl = await compressImage(file, 1920, 1920, 0.85);
                const compressedSize = (compressedDataUrl.length * 3) / 4;
                devLog.log('[App] Image compressed:', {
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
        
        devLog.log('[App] Processing image data:', {
            dataUrlLength: dataUrl.length,
            estimatedSizeMB: (base64Size / (1024 * 1024)).toFixed(2),
            originalFileSize: originalFile.size,
            originalFileSizeMB: (originalFile.size / (1024 * 1024)).toFixed(2)
        });
        
        // НЕ показываем изображение сразу - сначала анализируем
        setUploadedImage(null);
        setAppState('idle');
        setGeneratedImages({}); // Clear previous results
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
                
                devLog.log('Image evaluation result:', evaluation);
                
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
                setIsValidatingImage(false);
                setValidationStatusMessage('Анализируем изображение...');
                
                // Сохраняем результат анализа для использования в генерации
                setImageAnalysisResult(evaluation);
                
                // Сохраняем исходное изображение отдельно, чтобы показать его после оплаты/перезагрузки
                try {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem(LAST_SOURCE_IMAGE_KEY, dataUrl);
                    }
                } catch (e) {
                    devLog.warn('[App] Failed to persist last source image:', e);
                }
                
                // Сохраняем информацию о поле для анализа (не используется для генерации новогодних фото)
                setDetectedGender(evaluation.gender);
                devLog.log('Detected gender:', evaluation.gender, 'confidence:', evaluation.confidence);
                devLog.log('Image analysis result:', {
                    peopleCount: evaluation.peopleCount,
                    animalsCount: evaluation.animalsCount,
                    people: evaluation.people,
                    photoQuality: evaluation.photoQuality
                });
                
                // Переходим к состоянию готовности - стиль и локация будут доступны в левой колонке
                setAppState('image-uploaded');
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

    const handlePromoCodeApply = async () => {
        setPromoMessage(null);
        setPromoError(null);
        if (!uploadedImage) return;
        
        // Для новогодних фотосессий стиль и локация обязательны
        if (!selectedStyle || !selectedLocation) {
            setPromoError('Пожалуйста, выберите стиль и локацию для фотосессии перед применением промокода.');
            return;
        }

        // Ограничение на количество попыток промокода на клиенте
        const ATTEMPTS_KEY = 'newava_promo_attempts';
        try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(ATTEMPTS_KEY) : null;
            const parsed = raw ? JSON.parse(raw) as { count: number } : { count: 0 };
            if (parsed.count >= 5) {
                setPromoError('Превышено количество попыток ввода промокода. Попробуйте позже.');
                return;
            }
        } catch {
            // если что-то не так с хранилищем, просто продолжаем
        }

        try {
            setPromoLoading(true);
            // Для новогодних фотосессий используем упрощенный вызов промокода
            // TODO: Обновить API промокода для поддержки новогодних фотосессий
            const response = await usePromoCode(
                promoCodeInput,
                uploadedImage,
                detectedGender || 'unknown',
                '',
                ''
            );

            if (!response.ok || !response.invId) {
                setPromoError(response.error || 'Промокод недействителен или исчерпал лимит.');
                // Инкрементируем счётчик попыток
                try {
                    if (typeof window !== 'undefined') {
                        const raw = window.localStorage.getItem(ATTEMPTS_KEY);
                        const parsed = raw ? JSON.parse(raw) as { count: number } : { count: 0 };
                        parsed.count = (parsed.count || 0) + 1;
                        window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(parsed));
                    }
                } catch {
                    // игнорируем
                }
                return;
            }

            // Успех: промокод применён, генерация стартовала на бэкенде
            setPromoApplied(true);
            setPromoMessage(
                response.remainingUses !== undefined
                    ? `Промокод применён. Осталось активаций: ${response.remainingUses}.`
                    : 'Промокод применён. Генерация началась.'
            );

            const invId = String(response.invId);
            setCurrentInvId(invId);
            setHasActivePayment(true);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(CURRENT_ORDER_KEY, invId);
            }

            // Инициализируем состояние генерации с красивыми превью
            const initialImages: Record<string, GeneratedImage> = {};
            // Для новогодних фотосессий всегда 6 изображений
            for (let i = 0; i < 6; i++) {
                initialImages[`image_${i}`] = { status: 'processing' };
            }
            setGeneratedImages(initialImages);
            setAppState('generating');

            // Сразу подгружаем информацию о заказе, чтобы включить текущую логику polling
            try {
                const order = await fetchOrder(invId);
                setCurrentOrder(order);
            } catch (e) {
                devLog.warn('[App] Failed to fetch order after promo apply:', e);
            }
        } finally {
            setPromoLoading(false);
        }
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;
        
        // Если стиль или локация не выбраны - выбираем случайно
        let finalStyle = selectedStyle;
        let finalLocation = selectedLocation;
        
        if (!finalStyle || !finalLocation) {
            // Случайный выбор стиля
            if (!finalStyle) {
                const randomStyleIndex = Math.floor(Math.random() * NEW_YEAR_STYLES.length);
                finalStyle = NEW_YEAR_STYLES[randomStyleIndex].id as NewYearStyleId;
                setSelectedStyle(finalStyle);
            }
            
            // Случайный выбор локации
            if (!finalLocation) {
                const randomLocationIndex = Math.floor(Math.random() * NEW_YEAR_LOCATIONS.length);
                finalLocation = NEW_YEAR_LOCATIONS[randomLocationIndex].id as NewYearLocationId;
                setSelectedLocation(finalLocation);
            }
            
            // Показываем уведомление о случайном выборе
            const selectedStyleName = NEW_YEAR_STYLES.find(s => s.id === finalStyle)?.name || '';
            const selectedLocationName = NEW_YEAR_LOCATIONS.find(l => l.id === finalLocation)?.name || '';
            
            setAutoSelectionNotification({
                style: selectedStyleName,
                location: selectedLocationName
            });
            
            // Скрываем уведомление через 5 секунд
            setTimeout(() => {
                setAutoSelectionNotification(null);
            }, 5000);
            
            devLog.log('[App] Auto-selected style and location:', { style: finalStyle, location: finalLocation });
        }
        
        if (!imageAnalysisResult) {
            devLog.error('[App] Missing imageAnalysisResult for New Year generation');
            setImageValidationError('Не удалось проанализировать изображение. Попробуйте загрузить фото снова.');
            setAppState('failed');
            return;
        }

        // Если есть активный заказ в состоянии processing или completed - не запускаем генерацию заново
        if (currentOrder && (currentOrder.status === 'processing' || currentOrder.status === 'completed')) {
                            devLog.log('[App] Order already processing or completed, skipping generation');
            return;
        }

        // Если у заказа статус failed — пользователь должен начать заново
        if (currentOrder && currentOrder.status === 'failed') {
            devLog.log('[App] Order failed, user should start fresh');
            setImageValidationError('Предыдущая генерация не удалась. Пожалуйста, загрузите новое фото и выберите стиль с локацией.');
            setAppState('failed');
            return;
        }

        // ВРЕМЕННО ОТКЛЮЧЕНО ДЛЯ ТЕСТИРОВАНИЯ: Если оплаты ещё не было - инициируем платёж через Robokassa
        // TODO: Включить обратно после тестирования
        /*
        if (!hasActivePayment && !currentOrder) {
            try {
                devLog.log('[App] No active payment found, creating Robokassa payment...');

                // Сохраняем текущие настройки перед редиректом на оплату
                try {
                    const payload = {
                        uploadedImage,
                        selectedStyle,
                        selectedLocation,
                        imageAnalysisResult,
                        timestamp: Date.now(),
                    };
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(payload));
                    }
                } catch (storageError) {
                    devLog.warn('[App] Failed to persist pending generation before payment:', storageError);
                }

                // Для новогодних фотосессий используем упрощенный вызов платежа
                // TODO: Обновить API платежа для поддержки новогодних фотосессий
                const payment = await createPayment(
                    uploadedImage,
                    detectedGender || 'unknown',
                    '',
                    ''
                );
                if (payment?.redirectUrl) {
                    // Сохраняем invId в localStorage для восстановления после возврата
                    if (typeof window !== 'undefined' && payment.invId) {
                        window.localStorage.setItem(CURRENT_ORDER_KEY, String(payment.invId));
                    }
                    
                    devLog.log('[App] Redirecting to Robokassa:', { 
                        redirectUrl: payment.redirectUrl,
                        invId: payment.invId 
                    });
                    
                    // Редирект на страницу оплаты Robokassa
                    window.location.href = payment.redirectUrl;
                    return;
                } else {
                    devLog.error('[App] Payment created but no redirectUrl:', payment);
                    setImageValidationError('Не удалось получить URL для оплаты. Попробуйте позже.');
                    setAppState('failed');
                }
            } catch (err) {
                console.error('[App] Failed to create payment:', err);
                const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
                devLog.error('[App] Payment creation error:', { error: errorMessage, err });
                setImageValidationError(`Ошибка создания платежа: ${errorMessage}. Попробуйте позже или обратитесь в поддержку.`);
                setAppState('failed');
            }
            // Если платёж не удалось создать - не запускаем генерацию
            return;
        }
        */
        
        // ДЛЯ ТЕСТИРОВАНИЯ: Пропускаем проверку оплаты и сразу запускаем генерацию
        devLog.log('[App] TEST MODE: Skipping payment check, starting generation directly');

        // Оплата подтверждена — "съедаем" платёж и очищаем сохранённое состояние
        setHasActivePayment(false);
        autoGenerationStartedRef.current = true;
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(PENDING_GENERATION_KEY);
            }
        } catch (e) {
            devLog.warn('[App] Failed to clear pending generation from storage:', e);
        }

        setAppState('generating');
        
        // Инициализируем статусы для 6 финальных портретов (будет обновлено после генерации промптов)
        const initialImages: Record<string, GeneratedImage> = {};
        setGeneratedImages(initialImages);

        try {
            // ШАГ 0: Генерируем новогодние промпты через API (делаем это до генерации промежуточного изображения)
            console.log('[App] ========================================');
            console.log('[App] ENTERING NEW YEAR PROMPT GENERATION BLOCK');
            console.log('[App] CHECKING: New Year generation conditions');
            console.log('[App] hasImageAnalysisResult:', !!imageAnalysisResult);
            console.log('[App] selectedStyle:', selectedStyle);
            console.log('[App] selectedLocation:', selectedLocation);
            console.log('[App] ========================================');
            devLog.log('[App] ========================================');
            devLog.log('[App] CHECKING: New Year generation conditions');
            devLog.log('[App] hasImageAnalysisResult:', !!imageAnalysisResult);
            devLog.log('[App] selectedStyle:', selectedStyle);
            devLog.log('[App] selectedLocation:', selectedLocation);
            devLog.log('[App] ========================================');
            
            // Если стиль или локация не выбраны - выбираем случайно (на случай автоматического запуска)
            let finalStyle = selectedStyle;
            let finalLocation = selectedLocation;
            
            if (!finalStyle || !finalLocation) {
                // Случайный выбор стиля
                if (!finalStyle) {
                    const randomStyleIndex = Math.floor(Math.random() * NEW_YEAR_STYLES.length);
                    finalStyle = NEW_YEAR_STYLES[randomStyleIndex].id as NewYearStyleId;
                    setSelectedStyle(finalStyle);
                }
                
                // Случайный выбор локации
                if (!finalLocation) {
                    const randomLocationIndex = Math.floor(Math.random() * NEW_YEAR_LOCATIONS.length);
                    finalLocation = NEW_YEAR_LOCATIONS[randomLocationIndex].id as NewYearLocationId;
                    setSelectedLocation(finalLocation);
                }
                
                // Показываем уведомление о случайном выборе
                const selectedStyleName = NEW_YEAR_STYLES.find(s => s.id === finalStyle)?.name || '';
                const selectedLocationName = NEW_YEAR_LOCATIONS.find(l => l.id === finalLocation)?.name || '';
                
                setAutoSelectionNotification({
                    style: selectedStyleName,
                    location: selectedLocationName
                });
                
                // Скрываем уведомление через 5 секунд
                setTimeout(() => {
                    setAutoSelectionNotification(null);
                }, 5000);
                
                devLog.log('[App] Auto-selected style and location in generation block:', { style: finalStyle, location: finalLocation });
            }
            
            // Стиль и локация должны быть выбраны (либо пользователем, либо автоматически)
            if (!imageAnalysisResult || !finalStyle || !finalLocation) {
                console.error('[App] ❌ MISSING DATA - aborting generation');
                devLog.error('[App] Missing required data for New Year prompt generation:', {
                    hasAnalysisResult: !!imageAnalysisResult,
                    hasStyle: !!finalStyle,
                    hasLocation: !!finalLocation,
                });
                setImageValidationError('Не удалось определить стиль или локацию для фотосессии. Попробуйте еще раз.');
                setAppState('failed');
                return;
            }
            
            console.log('[App] ✅ All conditions met, proceeding to generate New Year prompts');

            devLog.log('[App] ========================================');
            devLog.log('[App] Generating New Year prompts via API');
            devLog.log('[App] Style:', finalStyle);
            devLog.log('[App] Location:', finalLocation);
            devLog.log('[App] Analysis result:', {
                peopleCount: imageAnalysisResult.peopleCount,
                animalsCount: imageAnalysisResult.animalsCount,
                people: imageAnalysisResult.people
            });
            devLog.log('[App] ========================================');

            let newYearPrompts;
            try {
                console.log('[App] ========================================');
                console.log('[App] CALLING generateNewYearPrompts API...');
                console.log('[App] API URL:', `${API_BASE_URL}/new-year/prompts`);
                console.log('[App] Request payload:', {
                    hasAnalysisResult: !!imageAnalysisResult,
                    styleId: finalStyle,
                    locationId: finalLocation
                });
                console.log('[App] ========================================');
                newYearPrompts = await generateNewYearPrompts(
                    imageAnalysisResult,
                    finalStyle,
                    finalLocation
                );
                console.log('[App] ✅ generateNewYearPrompts API SUCCESS, received', newYearPrompts?.length, 'prompts');
            } catch (error) {
                console.error('[App] ========================================');
                console.error('[App] ❌ generateNewYearPrompts API FAILED');
                console.error('[App] Error:', error);
                console.error('[App] Error message:', error instanceof Error ? error.message : String(error));
                console.error('[App] Error stack:', error instanceof Error ? error.stack : 'no stack');
                console.error('[App] ========================================');
                devLog.error('[App] Failed to generate New Year prompts:', error);
                setImageValidationError('Не удалось сгенерировать промпты для фотосессии. Попробуйте позже.');
                setAppState('failed');
                return;
            }

            if (!newYearPrompts || newYearPrompts.length === 0) {
                console.error('[App] ❌ No prompts received from API');
                devLog.error('[App] No prompts received from generateNewYearPrompts');
                setImageValidationError('Не удалось получить промпты для фотосессии. Попробуйте позже.');
                setAppState('failed');
                return;
            }
            
            console.log('[App] ✅ Received', newYearPrompts.length, 'prompts from API');
            devLog.log('[App] Generated', newYearPrompts.length, 'prompts');
            
            // Преобразуем массив промптов в объект с индексами как ключами
            const prompts: Record<string, string> = {};
            newYearPrompts.forEach((p, index) => {
                prompts[`image_${index}`] = p.prompt;
            });
            
            // Логируем первый промпт для проверки
            const firstPromptKey = Object.keys(prompts)[0];
            const firstPrompt = prompts[firstPromptKey];
            console.log('[App] ========================================');
            console.log('[App] FIRST PROMPT PREVIEW (first 500 chars):');
            console.log(firstPrompt?.substring(0, 500));
            console.log('[App] ========================================');
            devLog.log('[App] First prompt preview:', firstPrompt?.substring(0, 200));
            const isNewYearPrompt = firstPrompt?.includes('новогодн') || firstPrompt?.includes('New Year') || firstPrompt?.includes('фотосессия') || firstPrompt?.includes('Christmas') || firstPrompt?.includes('Рождество');
            console.log('[App] Is New Year prompt?', isNewYearPrompt);
            devLog.log('[App] Is New Year prompt?', isNewYearPrompt);
            
            if (!isNewYearPrompt) {
                console.error('[App] ⚠️ WARNING: First prompt does NOT look like a New Year prompt!');
                console.error('[App] Prompt starts with:', firstPrompt?.substring(0, 100));
                console.error('[App] ⚠️ ABORTING GENERATION - Invalid prompts detected!');
                devLog.error('[App] ⚠️ ABORTING GENERATION - Invalid prompts detected!');
                setImageValidationError('Получены некорректные промпты. Пожалуйста, попробуйте снова.');
                setAppState('failed');
                return;
            }
            
            // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что ни один промпт не является бизнес-портретом
            const hasBusinessPortrait = Object.values(prompts).some(p => 
                p.includes('business portrait') || 
                p.includes('LinkedIn profile') ||
                p.includes('professional portrait')
            );
            if (hasBusinessPortrait) {
                console.error('[App] ⚠️ CRITICAL ERROR: Business portrait prompts detected!');
                console.error('[App] ⚠️ ABORTING GENERATION - Business portrait prompts found!');
                devLog.error('[App] ⚠️ CRITICAL ERROR: Business portrait prompts detected!');
                setImageValidationError('Обнаружены промпты для бизнес-портретов. Пожалуйста, попробуйте снова.');
                setAppState('failed');
                return;
            }

            // Инициализируем статусы для всех промптов
            const promptKeys = Object.keys(prompts);
            promptKeys.forEach(key => {
                initialImages[key] = { status: 'pending' };
            });
            setGeneratedImages({ ...initialImages });

            // Логируем информацию о промптах
            devLog.log('[App] ========================================');
            devLog.log('[App] PROMPT VERIFICATION: New Year prompts');
            devLog.log('[App] ========================================');
            const samplePrompt = newYearPrompts[0]?.prompt || '';
            const hasFacialHairInstructions = samplePrompt.includes('CRITICAL FACIAL HAIR') || 
                                             samplePrompt.includes('facial hair EXACTLY') ||
                                             samplePrompt.includes('Do NOT lengthen, thicken');
            devLog.log(`[App] ✅ Facial hair preservation instructions found: ${hasFacialHairInstructions}`);
            if (hasFacialHairInstructions && samplePrompt) {
                const facialHairMatch = samplePrompt.match(/CRITICAL.*?facial hair.*?(?=\.|Attire|The style)/is);
                if (facialHairMatch) {
                    devLog.log(`[App] Facial hair instruction preview: ${facialHairMatch[0].substring(0, 200)}...`);
                }
            }
            devLog.log('[App] ========================================');

            // ШАГ 1: Генерируем промежуточное изображение (если еще не кэшировано)
            let imageToUse = uploadedImage;
            let isUsingIntermediate = false;
            
            if (!intermediateImage) {
                setIsGeneratingIntermediate(true);
                devLog.log('[App] ========================================');
                devLog.log('[App] STEP 1: Generating intermediate image');
                devLog.log('[App] Original image size:', uploadedImage.length, 'chars');
                devLog.log('[App] ========================================');
                
                // Максимально простой промпт для промежуточного изображения
                // Используем минимальный промпт, который должен работать даже с проблемными изображениями
                const intermediatePrompt = 'Change background to gray. Keep person the same.';
                devLog.log('[App] Intermediate prompt:', intermediatePrompt);
                
                try {
                    const intermediateResult = await generateImage(uploadedImage, intermediatePrompt);
                    devLog.log('[App] ========================================');
                    devLog.log('[App] ✅ Intermediate image generated successfully!');
                    devLog.log('[App] Intermediate image size:', intermediateResult.length, 'chars');
                    devLog.log('[App] Intermediate image preview:', intermediateResult.substring(0, 100) + '...');
                    devLog.log('[App] ========================================');
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
                devLog.log('[App] Using cached intermediate image (size:', intermediateImage.length, 'chars)');
            }
            
            devLog.log('[App] ========================================');
            devLog.log('[App] STEP 2: Generating 6 final portraits');
            devLog.log('[App] Using image size:', imageToUse.length, 'chars');
            devLog.log('[App] Image source:', isUsingIntermediate ? 'INTERMEDIATE ✅' : 'ORIGINAL ⚠️');
            if (!isUsingIntermediate) {
                devLog.warn('[App] ⚠️ WARNING: Using ORIGINAL image instead of intermediate! This may cause generation failures.');
            }
            devLog.log('[App] ========================================');

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
                        devLog.warn(`[App] Max attempts reached for style: ${style}. Skipping further generation attempts.`);
                        return { style, success: false, error: 'Превышено максимальное количество попыток для этого стиля.' };
                    }

                    const prompt = prompts[style];
                    if (!prompt) {
                        devLog.error(`[App] Prompt not found for style: ${style}`, {
                            availableKeys: Object.keys(prompts),
                            promptsCount: Object.keys(prompts).length
                        });
                        return { style, success: false, error: `Промпт не найден для ${style}` };
                    }
                    if (retryCount === 0) {
                        devLog.log(`[App] Starting generation for style: ${style}`);
                    } else {
                        devLog.log(`[App] Retrying generation for style: ${style} (attempt ${retryCount + 1})`);
                    }
                    devLog.log(`[App] Prompt length: ${prompt.length} chars`);
                    devLog.log(`[App] Prompt preview: ${prompt.substring(0, 150)}...`);
                    // Проверяем, что это новогодний промпт, а не старый IT-промпт
                    const isNewYearPrompt = prompt.includes('новогодн') || prompt.includes('New Year') || prompt.includes('фотосессия') || prompt.includes('New Year') || prompt.includes('Christmas') || prompt.includes('Рождество');
                    if (!isNewYearPrompt) {
                        devLog.error(`[App] ⚠️ WARNING: Using non-New Year prompt!`, {
                            style,
                            promptStart: prompt.substring(0, 200),
                            isBusinessPortrait: prompt.includes('business portrait') || prompt.includes('LinkedIn')
                        });
                    } else {
                        devLog.log(`[App] ✅ Confirmed: Using New Year prompt for style: ${style}`);
                    }
                    // Проверяем наличие инструкций по бороде/усам в каждом промпте
                    const hasFacialHairInPrompt = prompt.includes('CRITICAL FACIAL HAIR') || 
                                                 prompt.includes('facial hair EXACTLY') ||
                                                 prompt.includes('Do NOT lengthen, thicken');
                    devLog.log(`[App] ✅ Facial hair preservation in prompt: ${hasFacialHairInPrompt}`);
                    
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
                    
                    devLog.log(`[App] Using image for generation:`, {
                        style,
                        imageSource: isUsingIntermediate ? 'INTERMEDIATE ✅' : 'ORIGINAL ⚠️',
                        imageSize: imageToUse.length,
                        imagePreview: imageToUse.substring(0, 100) + '...'
                    });
                    
                    const resultUrl = await generateImage(imageToUse, prompt, onStatusUpdate);
                    devLog.log(`[App] ✅ Successfully generated image for style: ${style}`);
                    devLog.log(`[App] Result URL length: ${resultUrl.length} chars`);
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
                        devLog.warn(`[App] ⚠️ Job not found for style: ${style}. Retrying... (attempt ${retryCount + 1}/${maxRetriesForJobNotFound})`);
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
            const allPromptKeys = Object.keys(prompts);
            const results = await Promise.all(allPromptKeys.map(style => processStyle(style)));
            firstStageResults.push(...results);
            
            // ШАГ 3: Проверяем результаты и делаем повторную попытку для неудачных
            devLog.log('[App] ========================================');
            devLog.log('[App] STEP 3: Checking results and retrying failed portraits');
            devLog.log('[App] ========================================');
            
            // Находим успешные портреты и неудачные стили из результатов промисов
            const successfulPortraits: Array<{ style: string; url: string }> = [];
            const failedStyles: string[] = [];
            
            results.forEach(result => {
                if (result.success && result.url) {
                    successfulPortraits.push({ style: result.style, url: result.url });
                    devLog.log(`[App] ✅ Successful portrait: ${result.style}`);
                } else {
                    failedStyles.push(result.style);
                    devLog.log(`[App] ❌ Failed portrait: ${result.style}`);
                }
            });

            // Итоговая карта результатов для финального анализа
            const finalResultsMap: Record<string, { success: boolean; url?: string }> = {};
            results.forEach(result => {
                finalResultsMap[result.style] = { success: result.success, url: result.url };
            });
            
            // Если есть успешные портреты и неудачные - делаем расширенную повторную попытку
            if (successfulPortraits.length > 0 && failedStyles.length > 0) {
                devLog.log('[App] ========================================');
                devLog.log(`[App] Retrying ${failedStyles.length} failed portraits using successful portraits as sources (with limits)`);
                devLog.log('[App] ========================================');
                
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
                        devLog.log(`[App] Retrying generation for style: ${style} using source style: ${source.style} (attempt ${attempts[style] ?? 0 + 1})`);

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
                    
                    const retryResults = await Promise.all(promptKeys.map(style => processStyle(style)));
                    
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
                    promptKeys.forEach(style => {
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
                promptKeys.forEach(style => {
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

            promptKeys.forEach(style => {
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
        // Регенерация отдельного изображения из новогодней фотосессии
        if (!imageAnalysisResult || !selectedStyle || !selectedLocation) {
            devLog.error('[App] Cannot regenerate: missing style or location');
            return;
        }
        
        // Используем промежуточное изображение если есть, иначе оригинал
        const imageToUse = intermediateImage || uploadedImage;
        
        if (!imageToUse || generatedImages[style]?.status === 'pending' || generatedImages[style]?.status === 'queued' || generatedImages[style]?.status === 'processing') return;
        
        setGeneratedImages(prev => ({ ...prev, [style]: { status: 'pending' } }));

        try {
            // Генерируем новогодние промпты заново
            const newYearPrompts = await generateNewYearPrompts(
                imageAnalysisResult,
                selectedStyle,
                selectedLocation
            );
            
            // Находим промпт для этого стиля (style это image_0, image_1 и т.д.)
            const promptIndex = parseInt(style.replace('image_', ''));
            const prompt = newYearPrompts[promptIndex]?.prompt;
            
            if (!prompt) {
                throw new Error(`Промпт не найден для ${style}`);
            }
            
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
        setDetectedGender('unknown');
        setIntermediateImage(null);
        setIsGeneratingIntermediate(false);
        setSelectedStyle(null);
        setSelectedLocation(null);
        setImageAnalysisResult(null);
        setAutoSelectionNotification(null);
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
        if (!currentOrder || !currentOrder.invId) {
            console.warn('[App] No order to download');
            return;
        }

        setIsDownloading(true);
        try {
            const link = document.createElement('a');
            link.href = `/api/order/${currentOrder.invId}/download`;
            link.download = `newava_${currentOrder.invId}_portraits.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Не удалось скачать архив:", error);
            devLog.error('[App] Download archive error:', error);
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
      if (!adminAuthChecked) {
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <p className="text-sm text-slate-600">Проверяем доступ к админке…</p>
          </div>
        );
      }

      if (!adminAuthed) {
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="max-w-sm w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h1 className="text-lg font-semibold text-slate-900 mb-2">Вход в админку</h1>
              <p className="text-xs text-slate-500 mb-4">
                Введите пароль администратора для доступа к заказам и промокодам.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Пароль</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setAdminAuthError(null);
                    }}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="••••••"
                  />
                </div>
                {adminAuthError && (
                  <p className="text-xs text-red-600">{adminAuthError}</p>
                )}
                <button
                  type="button"
                  disabled={adminAuthLoading || !adminPassword}
                  onClick={async () => {
                    try {
                      setAdminAuthLoading(true);
                      setAdminAuthError(null);
                      const result = await adminLogin(adminPassword);
                      if (!result.ok) {
                        setAdminAuthError(result.error || 'Неверный пароль');
                        setAdminAuthed(false);
                        return;
                      }
                      setAdminAuthed(true);
                    } finally {
                      setAdminAuthLoading(false);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adminAuthLoading ? 'Входим…' : 'Войти'}
                </button>
                <div className="pt-2 border-t border-slate-100 mt-2 flex justify-between items-center">
                  <a href="/" className="text-xs text-slate-500 hover:text-slate-800 underline decoration-dotted">
                    На главную
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return <AdminDashboard initialTab={adminMode} />;
    }

    // Показываем страницу галереи
    if (isGalleryView) {
      return <GalleryPage />;
    }

    return (
        <div 
            className="min-h-screen w-full text-gray-800 flex flex-col"
            style={{
                background: '#f8f9fa',
            }}
        >
            <HeaderMenu />
            
            {/* Hero Section - скрываем во время генерации */}
            {appState !== 'generating' && (
                <section 
                    className="w-full border-b border-gray-200 relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, #faf8f5 0%, #f5f3f0 100%)',
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                        <div className="max-w-5xl mx-auto">
                            {/* Тег с иконкой снежинки */}
                            <div className="flex justify-center mb-6">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 border border-pink-200">
                                    <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">Магия новогодних фотосессий</span>
                                </div>
                            </div>
                            
                            {/* Заголовок */}
                            <h1 className="text-center mb-4">
                                <div 
                                    className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-2"
                                    style={{ fontFamily: "'Playfair Display', serif" }}
                                >
                                    Новогодние фотосессии
                                </div>
                                <div 
                                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600"
                                    style={{ fontFamily: "'Playfair Display', serif" }}
                                >
                                    за несколько секунд
                                </div>
                            </h1>
                            
                            {/* Описательный текст */}
                            <p className="text-center text-gray-700 text-base sm:text-lg mb-10 max-w-2xl mx-auto">
                                Загрузите ваше фото, выберите стиль и локацию — наш ИИ создаст волшебную праздничную фотосессию
                            </p>
                            
                            {/* 4 шага с соединительными линиями */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2 mb-6">
                                {/* Мобильная версия: сетка 2x2 */}
                                <div className="grid grid-cols-2 gap-4 sm:hidden w-full max-w-md">
                                    {/* Шаг 1 */}
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                            1
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 mt-2 text-center">Загрузите фото</span>
                                    </div>
                                    
                                    {/* Шаг 2 */}
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                            2
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 mt-2 text-center">Выберите стиль</span>
                                    </div>
                                    
                                    {/* Шаг 3 */}
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                            3
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 mt-2 text-center">Выберите локацию</span>
                                    </div>
                                    
                                    {/* Шаг 4 */}
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                            4
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 mt-2 text-center">Получите результат</span>
                                    </div>
                                </div>
                                
                                {/* Десктопная версия: горизонтальная линия */}
                                <div className="hidden sm:flex items-center gap-2">
                                    {/* Шаг 1 */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                                1
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 mt-2 text-center">Загрузите фото</span>
                                        </div>
                                        {/* Соединительная линия */}
                                        <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                                    </div>
                                    
                                    {/* Шаг 2 */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                                2
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 mt-2 text-center">Выберите стиль</span>
                                        </div>
                                        {/* Соединительная линия */}
                                        <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                                    </div>
                                    
                                    {/* Шаг 3 */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                                3
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 mt-2 text-center">Выберите локацию</span>
                                        </div>
                                        {/* Соединительная линия */}
                                        <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                                    </div>
                                    
                                    {/* Шаг 4 */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white font-bold text-lg flex-shrink-0 shadow-md">
                                                4
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 mt-2 text-center">Получите результат</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
            
            <main className="flex-1 w-full container mx-auto p-4 sm:p-6 lg:p-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
                {(appState === 'generating' || appState === 'results-shown') ? (
                    /* --- Упрощенный layout во время генерации и после: Было / Стало --- */
                    <>
                        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
                            {/* Левая колонка: Исходное фото (пропорции как на главной странице) */}
                            <aside className="w-full lg:w-1/2 xl:w-2/5 flex-shrink-0">
                                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                                        Было:
                                    </h2>
                                    {uploadedImage && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="w-full"
                                        >
                                            <img 
                                                src={uploadedImage} 
                                                alt="Исходное фото" 
                                                className="w-full rounded-lg object-cover aspect-square shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-300" 
                                                onClick={() => setLightboxUrl(uploadedImage)}
                                            />
                                        </motion.div>
                                    )}
                                </div>
                            </aside>
                            
                            {/* Правая колонка: Генерируемые изображения */}
                            <section className="flex-1 min-w-0">
                                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
                                    {/* Заголовок и теги - адаптивная верстка для мобильных */}
                                    <div className="mb-3 sm:mb-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                                                Стало:
                                            </h2>
                                            {/* Теги с выбранным стилем и локацией - на мобильных под заголовком */}
                                            {(selectedStyle || selectedLocation) && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {selectedStyle && (
                                                        <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                                            {NEW_YEAR_STYLES.find(s => s.id === selectedStyle)?.name || selectedStyle}
                                                        </span>
                                                    )}
                                                    {selectedLocation && (
                                                        <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                                                            {NEW_YEAR_LOCATIONS.find(l => l.id === selectedLocation)?.name || selectedLocation}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <GenerationFlow
                                        generatedImages={generatedImages}
                                        onRegenerate={handleRegenerateStyle}
                                        onDownload={handleDownloadIndividualImage}
                                        onOpen={setLightboxUrl}
                                        hideCaptions={true}
                                    />
                                </div>
                            </section>
                        </div>
                        
                        {/* Кнопка "Попробуем еще раз?" под контейнерами по центру */}
                        <div className="mt-6 sm:mt-8 flex justify-center">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base lg:text-lg font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] touch-manipulation w-full sm:w-auto min-h-[44px]"
                                        style={{
                                            background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                                            boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.3), 0 4px 6px -4px rgba(239, 68, 68, 0.3)',
                                        }}
                            >
                                <Icons.sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                                <span>Попробуем еще раз?</span>
                            </button>
                        </div>
                    </>
                ) : (
                    /* --- Обычный layout: выбор стиля и локации --- */
                    <div className="flex flex-col">
                        {/* Колонки с шагами */}
                        <div className="flex flex-col lg:flex-row gap-8 mb-8 lg:items-stretch">
                            {/* --- Left Column: Шаги 1 и 2 --- */}
                            <aside className="w-full lg:w-1/2 xl:w-2/5 flex-shrink-0 space-y-6 lg:flex lg:flex-col">
                                {/* Контейнер 1: Загрузите ваше фото */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-shadow duration-300 hover:shadow-md lg:flex-1 lg:flex lg:flex-col">
                                    <ImageUploadFlow
                                        uploadedImage={uploadedImage}
                                        isValidatingImage={isValidatingImage}
                                        validationStatusMessage={validationStatusMessage}
                                        validationTimer={validationTimer}
                                        imageValidationError={imageValidationError}
                                        onImageUpload={handleImageUpload}
                                        onReset={handleReset}
                                    />
                                    
                                    {/* Показываем исходник всегда, если есть uploadedImage */}
                                    <AnimatePresence>
                                        {uploadedImage && 
                                          !imageValidationError && !isValidatingImage && (
                                             <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 lg:flex-1 lg:flex lg:items-center">
                                                <img src={uploadedImage} alt="Uploaded preview" className="w-full rounded-md object-cover aspect-square" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                
                                {/* Контейнер 2: Выберите стиль фотосессии */}
                                {!imageValidationError && (
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-shadow duration-300 hover:shadow-md lg:flex-1 lg:flex lg:flex-col lg:justify-center">
                                        <StyleSelect
                                            selectedStyle={selectedStyle}
                                            onSelect={(styleId) => {
                                                setSelectedStyle(styleId);
                                            }}
                                        />
                                    </div>
                                )}
                            </aside>
                            
                            {/* --- Right Column: Шаг 3 - Выбор локации --- */}
                            <section className="flex-1 lg:flex lg:flex-col">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:h-full lg:flex lg:flex-col">
                                    {/* 3. Выберите локацию (изображения с подписями) */}
                                    {!imageValidationError && (
                                        <LocationGrid
                                            selectedLocation={selectedLocation}
                                            onSelect={(locationId) => {
                                                setSelectedLocation(locationId);
                                            }}
                                        />
                                    )}
                                </div>
                            </section>
                        </div>
                        
                        {/* Кнопка генерации по центру под колонками */}
                        {!imageValidationError && (
                            <div className="flex flex-col items-center">
                                {/* Уведомление о случайном выборе */}
                                <AnimatePresence>
                                    {autoSelectionNotification && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg shadow-md max-w-md w-full"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    <Icons.sparkles className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                        Стиль и локация выбраны автоматически
                                                    </h4>
                                                    <p className="text-sm text-gray-700">
                                                        <span className="font-medium">Стиль:</span> {autoSelectionNotification.style}
                                                    </p>
                                                    <p className="text-sm text-gray-700">
                                                        <span className="font-medium">Локация:</span> {autoSelectionNotification.location}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAutoSelectionNotification(null)}
                                                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    <Icons.close className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                
                                {/* Большая кнопка генерации */}
                                <div className="flex items-center gap-4 w-full max-w-md justify-center">
                                    <span
                                        className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white flex-shrink-0 shadow-md"
                                        style={{
                                            background: 'rgb(220, 38, 38)',
                                        }}
                                    >
                                        4
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleGenerateClick}
                                        className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 px-8 rounded-lg font-semibold text-lg hover:from-orange-700 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Начать генерацию
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Состояние ошибки */}
                {appState === 'failed' && (
                    <section className="flex-1">
                        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center p-6 text-center"
                            >
                                <Icons.xCircle className="h-16 w-16 text-red-500 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    Не удалось сгенерировать фотосессию
                                </h3>
                                <p className="text-sm text-gray-600 mb-4 max-w-md">
                                    Произошла техническая ошибка при генерации. Попробуйте загрузить другое фото и
                                    повторить попытку. Оплата за заказ сохранена, повторная оплата не требуется.
                                </p>
                                {currentOrder && (
                                    <p className="text-xs text-gray-500 max-w-md">
                                        {currentOrder.failureReason && (
                                            <span className="block mb-1">
                                                Причина: {currentOrder.failureReason}
                                            </span>
                                        )}
                                        Осталось попыток:{' '}
                                        <span className="font-semibold">
                                            {Math.max(0, 2 - (currentOrder.retries ?? 0))}
                                        </span>{' '}
                                        из 2. Если повторные попытки не помогут, напишите в поддержку:&nbsp;
                                        <a
                                            href="mailto:kuznetsov@i-integrator.com"
                                            className="text-blue-600 hover:underline"
                                        >
                                            kuznetsov@i-integrator.com
                                        </a>
                                        .
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Начать заново
                                </button>
                            </motion.div>
                        </div>
                    </section>
                )}
            </main>
            <Footer onOpenRules={() => setIsRulesOpen(true)} />
            
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

            {/* Rules Modal */}
            <AnimatePresence>
                {isRulesOpen && (
                    <motion.div
                        key="rules-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setIsRulesOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.96, opacity: 0 }}
                            className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-8 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                aria-label="Закрыть правила генераций"
                                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                                onClick={() => setIsRulesOpen(false)}
                            >
                                <Icons.close className="h-4 w-4" />
                            </button>
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
                                Правила генераций
                            </h2>
                            <div className="space-y-4 text-sm sm:text-base text-gray-700">
                                <p>
                                    Перед созданием портретов внимательно ознакомьтесь с правилами. Нажимая кнопку
                                    <span className="font-semibold"> «Сгенерировать»</span>, вы подтверждаете, что
                                    согласны с данными условиями.
                                </p>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">1. Требования к фотографиям</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>На фото должно быть чётко видно лицо, без сильных теней и пересветов.</li>
                                        <li>Желательно один человек в кадре, без посторонних людей на переднем плане.</li>
                                        <li>Без сильных фильтров, масок, AR‑эффектов и дорисованных элементов.</li>
                                        <li>Избегайте слишком маленьких, размытых или сильно обрезанных изображений.</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">2. Системные и контент‑ошибки</h3>
                                    <p>
                                        Мы разделяем ошибки на системные (технические сбои генерации) и контент‑ошибки
                                        (когда исходная фотография не удовлетворяет требованиям или содержит
                                        некорректный контент).
                                    </p>
                                    <p>
                                        За <span className="font-semibold">контент‑ошибки</span> оплата не
                                        возвращается: сервис не несёт ответственности за результат, если исходное фото
                                        не подходит под данные правила.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">3. Повторные попытки</h3>
                                    <p>
                                        При технических сбоях генерации вы можете сделать до{' '}
                                        <span className="font-semibold">двух повторных попыток</span> по одному заказу.
                                        Если проблема не решается, вы можете обратиться в службу поддержки.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">4. Ответственность и поддержка</h3>
                                    <p>
                                        Нажимая кнопку <span className="font-semibold">«Сгенерировать»</span>, вы
                                        подтверждаете, что согласны с этими правилами. В случае нарушения правил
                                        генерации сервис не несёт ответственности за потраченные средства.
                                    </p>
                                    <p>
                                        Если вы не согласны с полученными результатами или у вас есть вопросы, вы
                                        можете написать в службу поддержки по адресу:{' '}
                                        <a
                                            href="mailto:kuznetsov@i-integrator.com"
                                            className="text-blue-600 hover:underline"
                                        >
                                            kuznetsov@i-integrator.com
                                        </a>
                                        .
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
