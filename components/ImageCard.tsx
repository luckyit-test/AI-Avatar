/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

type ImageStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error';

interface ImageCardProps {
    imageUrl?: string;
    caption: string;
    status: ImageStatus;
    error?: string;
    queuePosition?: number;
    estimatedWaitTime?: number; // в миллисекундах
    gender?: 'male' | 'female' | null; // Пол для специальной анимации
    onRegenerate: () => void;
    onDownload: () => void;
    onOpen?: (imageUrl: string) => void;
}

function formatWaitTime(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
        return `${seconds} сек`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
        return `${minutes} мин`;
    }
    return `${minutes} мин ${remainingSeconds} сек`;
}

const STYLE_VIDEO_MAP_MALE: Record<string, string> = {
    'Классический': '/videos/001.mp4',
    'Современный': '/videos/002.mp4',
    'Креативный': '/videos/003.mp4',
    'Технологичный': '/videos/004.mp4',
    'Дружелюбный': '/videos/005.mp4',
    'Уверенный': '/videos/006.mp4',
};

const STYLE_VIDEO_MAP_FEMALE: Record<string, string> = {
    'Классический': '/videos/w001.mp4',
    'Современный': '/videos/w002.mp4',
    'Креативный': '/videos/w003.mp4',
    'Технологичный': '/videos/w004.mp4',
    'Дружелюбный': '/videos/w005.mp4',
    'Уверенный': '/videos/w006.mp4',
};

const ProcessingVideoBackground: React.FC<{
    styleName: string;
    estimatedWaitTime?: number;
    gender?: 'male' | 'female' | null;
}> = ({ styleName, estimatedWaitTime, gender }) => {
    const videoSrc =
        gender === 'male'
            ? STYLE_VIDEO_MAP_MALE[styleName]
            : gender === 'female'
            ? STYLE_VIDEO_MAP_FEMALE[styleName]
            : undefined;
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            // как только подходим к концу фрагмента, мягко перескакиваем в начало,
            // чтобы избежать чёрного кадра на стыке
            if (video.currentTime >= 3.95) {
                video.currentTime = 0.01;
                if (video.paused) {
                    void video.play().catch(() => {
                        // игнорируем возможные ошибки автоплея
                    });
                }
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [videoSrc]);

    if (!videoSrc) {
        return null;
    }

    const remainingSeconds =
        estimatedWaitTime && estimatedWaitTime > 0
            ? Math.max(1, Math.ceil(estimatedWaitTime / 1000))
            : null;

    return (
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                src={videoSrc}
                muted
                playsInline
                autoPlay
                preload="auto"
            />

            {/* затемняющий оверлей для читаемости текста */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />

            <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-sm font-semibold text-white mb-1">
                    Генерируем портрет в стиле «{styleName}»
                </p>
                {remainingSeconds !== null && (
                    <p className="text-xs text-slate-100 mb-3">
                        Примерно осталось ~{remainingSeconds} сек
                    </p>
                )}

                {/* Три анимированных круга */}
                <div className="flex gap-2 mt-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2.5 h-2.5 rounded-full bg-sky-400"
                            animate={{
                                scale: [1, 1.25, 1],
                                opacity: [0.5, 1, 0.5],
                                y: [0, -3, 0],
                            }}
                            transition={{
                                duration: 1.1,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: 'easeInOut',
                            }}
                            style={{
                                boxShadow: '0 0 10px rgba(56, 189, 248, 0.9)',
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ImageCard: React.FC<ImageCardProps> = ({ 
    imageUrl, 
    caption, 
    status, 
    error,
    queuePosition, 
    estimatedWaitTime,
    gender,
    onRegenerate, 
    onDownload, 
    onOpen 
}) => {
    // Определяем классы и стили для карточки в зависимости от статуса
    const getCardStyles = () => {
        switch (status) {
            case 'queued':
                return {
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderColor: '#bae6fd',
                    borderWidth: '2px',
                };
            case 'processing':
            case 'error':
                // Специальный стиль для всех портретов во время генерации/ошибок,
                // для пользователя ошибка выглядит как продолжение процесса
                if (gender === 'male') {
                    return {
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        borderColor: '#93c5fd',
                        borderWidth: '2px',
                    };
                }
                if (gender === 'female') {
                    return {
                        background: 'linear-gradient(135deg, #ffe4eb 0%, #f3adb7 100%)',
                        borderColor: '#f3adb7',
                        borderWidth: '2px',
                    };
                }
                return {
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderColor: '#fcd34d',
                    borderWidth: '2px',
                };
            default:
                return {};
        }
    };

    const getCardClasses = () => {
        const baseClasses = "rounded-lg border overflow-hidden flex flex-col group transition-all duration-300";
        switch (status) {
            case 'queued':
            case 'processing':
            case 'error':
                return `${baseClasses} border-2`;
            case 'done':
                return `${baseClasses} bg-white border-gray-200`;
            default:
                return `${baseClasses} bg-white border-gray-200`;
        }
    };

    const hasVideoForGender =
        gender === 'male'
            ? !!STYLE_VIDEO_MAP_MALE[caption]
            : gender === 'female'
            ? !!STYLE_VIDEO_MAP_FEMALE[caption]
            : false;

    const isVideoPhase = (status === 'processing' || status === 'error') && hasVideoForGender;

    return (
        <div 
            className={getCardClasses()}
            style={{
                ...getCardStyles(),
                boxShadow: status === 'done' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
        >
            <div className="w-full aspect-square relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* Специальный режим: видеофон для портретов с привязанными видео (м/ж) */}
                    {isVideoPhase && (
                        <motion.div
                            key={`processing-video-${caption}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                        >
                            <ProcessingVideoBackground
                                styleName={caption}
                                estimatedWaitTime={estimatedWaitTime}
                                gender={gender}
                            />
                        </motion.div>
                    )}

                    {/* Общий скелетон/очередь/обычная генерация для случаев без видеофона */}
                    {(status === 'pending' ||
                        status === 'queued' ||
                        (status === 'processing' && !hasVideoForGender) ||
                        (status === 'error' && !hasVideoForGender)) && (
                        <motion.div
                            key={status}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center flex-col p-4"
                        >
                            {/* Скелетон-загрузчик для фона */}
                            <div className="absolute inset-0 skeleton-loader opacity-30" />
                            
                            {/* Контент поверх скелетона */}
                            <div className="relative z-10 flex flex-col items-center">
                                {status === 'queued' && (
                                    <>
                                        <div className="mb-4 p-3 rounded-full bg-blue-100">
                                            <Icons.clock className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-blue-900 mb-1">
                                                В очереди
                                            </p>
                                            {queuePosition !== undefined && (
                                                <p className="text-xs text-blue-700 mb-2">
                                                    Позиция: {queuePosition}
                                                </p>
                                            )}
                                            {estimatedWaitTime !== undefined && estimatedWaitTime > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-xs text-blue-600 font-medium">
                                                        ~{formatWaitTime(estimatedWaitTime)}
                                                    </p>
                                                    {/* Мини прогресс-бар */}
                                                    <div className="mt-2 w-24 h-1 bg-blue-200 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            transition={{ duration: estimatedWaitTime / 1000, ease: 'linear' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                
                                {status === 'processing' && (
                                    <>
                                        {/* Обычная анимация для стилей без видеофона */}
                                        <div className="mb-4 p-3 rounded-full bg-amber-100">
                                            <Icons.lightning className="w-8 h-8 text-amber-600 animate-pulse" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-amber-900 mb-1">
                                                Генерация...
                                            </p>
                                            {estimatedWaitTime !== undefined && estimatedWaitTime > 0 && (
                                                <p className="text-xs text-amber-700">
                                                    Осталось ~{formatWaitTime(estimatedWaitTime)}
                                                </p>
                                            )}
                                            {/* Пульсирующий индикатор */}
                                            <div className="mt-3 flex gap-1 justify-center">
                                                {[0, 1, 2].map((i) => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-2 h-2 bg-amber-500 rounded-full"
                                                        animate={{
                                                            scale: [1, 1.2, 1],
                                                            opacity: [0.5, 1, 0.5],
                                                        }}
                                                        transition={{
                                                            duration: 1,
                                                            repeat: Infinity,
                                                            delay: i * 0.2,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                {status === 'pending' && (
                                    <>
                                        <Icons.spinner className="w-8 h-8 text-gray-400 animate-spin mb-3" />
                                        <p className="text-sm text-gray-600">
                                            Подготовка...
                                        </p>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                    {status === 'done' && imageUrl && (
                         <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                        >
                            <img
                                src={imageUrl}
                                alt={caption}
                                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
                                onClick={() => onOpen && onOpen(imageUrl)}
                            />
                            {/* Success badge */}
                            <div className="absolute top-2 left-2 z-10">
                                <div className="p-1.5 rounded-full bg-green-500/90 backdrop-blur-sm">
                                    <Icons.checkCircle className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            {/* Always-visible expand button (mobile + desktop) */}
                            <div className="absolute top-2 right-2 z-10">
                                <button
                                    onClick={() => onOpen && onOpen(imageUrl)}
                                    className="h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all duration-200 hover:scale-110"
                                    aria-label={`Открыть ${caption} на весь экран`}
                                >
                                    <Icons.expand className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center gap-3 pb-4">
                                <button
                                    onClick={onDownload}
                                    className="h-11 w-11 rounded-full bg-white/90 backdrop-blur-sm text-gray-800 flex items-center justify-center hover:bg-white transition-all duration-200 hover:scale-110 shadow-lg"
                                    aria-label={`Скачать ${caption}`}
                                >
                                    <Icons.download className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={onRegenerate}
                                    className="h-11 w-11 rounded-full bg-white/90 backdrop-blur-sm text-gray-800 flex items-center justify-center hover:bg-white transition-all duration-200 hover:scale-110 shadow-lg"
                                    aria-label={`Создать заново ${caption}`}
                                >
                                    <Icons.refresh className="h-5 w-5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div 
                className="p-4 border-t transition-colors duration-200"
                style={{
                    borderColor: status === 'queued' ? '#bae6fd' :
                                status === 'processing' || status === 'error'
                                    ? (gender === 'male'
                                        ? '#93c5fd'
                                        : gender === 'female'
                                        ? '#f3adb7'
                                        : '#fcd34d')
                                    :
                                '#e5e7eb',
                    background: status === 'queued' ? 'rgba(239, 246, 255, 0.8)' :
                               status === 'processing' || status === 'error'
                                   ? (gender === 'male'
                                        ? 'rgba(219, 234, 254, 0.8)'
                                        : gender === 'female'
                                        ? 'rgba(243, 173, 183, 0.15)'
                                        : 'rgba(254, 243, 199, 0.8)')
                                   :
                               '#ffffff',
                }}
            >
                <p 
                    className="font-semibold text-center truncate text-sm"
                    style={{
                        color: status === 'queued' ? '#1e3a8a' :
                               status === 'processing' || status === 'error'
                                   ? (gender === 'male'
                                        ? '#1e40af'
                                        : gender === 'female'
                                        ? '#9b1c40'
                                        : '#78350f')
                                   :
                               '#1f2937',
                    }}
                >
                    {caption}
                </p>
            </div>
        </div>
    );
};

export default ImageCard;
