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
                // Специальный стиль для "Классический" портрет для мужчин
                if (caption === 'Классический' && gender === 'male') {
                    return {
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        borderColor: '#93c5fd',
                        borderWidth: '2px',
                    };
                }
                return {
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderColor: '#fcd34d',
                    borderWidth: '2px',
                };
            case 'error':
                return {
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                    borderColor: '#fca5a5',
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
                    {(status === 'pending' || status === 'queued' || status === 'processing') && (
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
                                        {/* Специальная анимация для "Классический" портрет для мужчин */}
                                        {caption === 'Классический' && gender === 'male' ? (
                                            <div className="w-full h-full flex items-center justify-center relative">
                                                {/* Голубой фон */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-blue-200" />
                                                
                                                {/* Силуэт мужчины */}
                                                <motion.div
                                                    className="relative z-10"
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.5 }}
                                                >
                                                    {/* Голова и тело */}
                                                    <svg width="120" height="160" viewBox="0 0 120 160" className="text-blue-600">
                                                        {/* Голова (круг) */}
                                                        <circle cx="60" cy="30" r="20" fill="currentColor" opacity="0.3" />
                                                        {/* Тело (прямоугольник) */}
                                                        <rect x="40" y="50" width="40" height="80" fill="currentColor" opacity="0.3" />
                                                        {/* Ноги */}
                                                        <rect x="45" y="130" width="12" height="30" fill="currentColor" opacity="0.3" />
                                                        <rect x="63" y="130" width="12" height="30" fill="currentColor" opacity="0.3" />
                                                    </svg>
                                                    
                                                    {/* Анимация сборки: шляпа */}
                                                    <motion.div
                                                        className="absolute top-0 left-1/2 -translate-x-1/2"
                                                        initial={{ y: -30, opacity: 0, rotate: -15 }}
                                                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                                                        transition={{ 
                                                            delay: 0.5,
                                                            duration: 0.6,
                                                            type: "spring",
                                                            stiffness: 200
                                                        }}
                                                    >
                                                        <svg width="50" height="30" viewBox="0 0 50 30" className="text-blue-700">
                                                            <path d="M10 25 Q25 5 40 25 L40 30 L10 30 Z" fill="currentColor" opacity="0.6" />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Анимация сборки: усы */}
                                                    <motion.div
                                                        className="absolute top-[45px] left-1/2 -translate-x-1/2"
                                                        initial={{ x: -20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ 
                                                            delay: 1.2,
                                                            duration: 0.5,
                                                            type: "spring"
                                                        }}
                                                    >
                                                        <svg width="40" height="8" viewBox="0 0 40 8" className="text-blue-800">
                                                            <path d="M5 4 Q15 2 20 4 Q25 6 35 4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Анимация сборки: галстук */}
                                                    <motion.div
                                                        className="absolute top-[70px] left-1/2 -translate-x-1/2"
                                                        initial={{ y: -20, opacity: 0, scale: 0.5 }}
                                                        animate={{ y: 0, opacity: 1, scale: 1 }}
                                                        transition={{ 
                                                            delay: 1.8,
                                                            duration: 0.6,
                                                            type: "spring"
                                                        }}
                                                    >
                                                        <svg width="12" height="40" viewBox="0 0 12 40" className="text-blue-700">
                                                            <path d="M6 0 L8 15 L6 40 L4 15 Z" fill="currentColor" opacity="0.6" />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Анимация сборки: пиджак (плечи) */}
                                                    <motion.div
                                                        className="absolute top-[55px] left-1/2 -translate-x-1/2"
                                                        initial={{ scaleX: 0 }}
                                                        animate={{ scaleX: 1 }}
                                                        transition={{ 
                                                            delay: 2.4,
                                                            duration: 0.5
                                                        }}
                                                    >
                                                        <svg width="60" height="20" viewBox="0 0 60 20" className="text-blue-600">
                                                            <rect x="0" y="0" width="60" height="20" rx="5" fill="currentColor" opacity="0.4" />
                                                        </svg>
                                                    </motion.div>
                                                </motion.div>
                                                
                                                {/* Текст "Генерация..." */}
                                                <motion.div
                                                    className="absolute bottom-8 left-0 right-0 text-center z-20"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.3 }}
                                                >
                                                    <p className="text-sm font-semibold text-blue-900 mb-1">
                                                        Генерация...
                                                    </p>
                                                    {estimatedWaitTime !== undefined && estimatedWaitTime > 0 && (
                                                        <p className="text-xs text-blue-700">
                                                            Осталось ~{formatWaitTime(estimatedWaitTime)}
                                                        </p>
                                                    )}
                                                </motion.div>
                                                
                                                {/* Пульсирующие точки */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                                                    {[0, 1, 2].map((i) => (
                                                        <motion.div
                                                            key={i}
                                                            className="w-2 h-2 bg-blue-500 rounded-full"
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
                                        ) : (
                                            /* Обычная анимация для остальных случаев */
                                            <>
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
                    {status === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center flex-col p-4 text-center"
                        >
                            {/* Не показываем ошибку пользователю - система сама повторит попытку */}
                            <div className="mb-3 p-3 rounded-full bg-gray-100">
                                <Icons.spinner className="w-10 h-10 text-gray-400 animate-spin" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">Повторная попытка...</p>
                            <p className="mt-1 text-xs text-gray-600">Система автоматически повторит генерацию</p>
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
                                status === 'processing' ? (caption === 'Классический' && gender === 'male' ? '#93c5fd' : '#fcd34d') :
                                status === 'error' ? '#fca5a5' :
                                '#e5e7eb',
                    background: status === 'queued' ? 'rgba(239, 246, 255, 0.8)' :
                               status === 'processing' ? (caption === 'Классический' && gender === 'male' ? 'rgba(219, 234, 254, 0.8)' : 'rgba(254, 243, 199, 0.8)') :
                               status === 'error' ? 'rgba(254, 226, 226, 0.8)' :
                               '#ffffff',
                }}
            >
                <p 
                    className="font-semibold text-center truncate text-sm"
                    style={{
                        color: status === 'queued' ? '#1e3a8a' :
                               status === 'processing' ? (caption === 'Классический' && gender === 'male' ? '#1e40af' : '#78350f') :
                               status === 'error' ? '#991b1b' :
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
