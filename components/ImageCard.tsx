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
                                            <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                                                {/* Улучшенный градиентный фон с анимацией */}
                                                <motion.div 
                                                    className="absolute inset-0 bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100"
                                                    animate={{
                                                        background: [
                                                            'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
                                                            'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)',
                                                            'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
                                                        ],
                                                    }}
                                                    transition={{
                                                        duration: 4,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                                
                                                {/* Декоративные световые эффекты */}
                                                <motion.div
                                                    className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-30"
                                                    animate={{
                                                        scale: [1, 1.2, 1],
                                                        opacity: [0.2, 0.4, 0.2],
                                                    }}
                                                    transition={{
                                                        duration: 3,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                                <motion.div
                                                    className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-indigo-200 rounded-full blur-3xl opacity-20"
                                                    animate={{
                                                        scale: [1.2, 1, 1.2],
                                                        opacity: [0.15, 0.3, 0.15],
                                                    }}
                                                    transition={{
                                                        duration: 4,
                                                        repeat: Infinity,
                                                        ease: "easeInOut",
                                                        delay: 0.5
                                                    }}
                                                />
                                                
                                                {/* Основной контейнер портрета с эффектом дыхания */}
                                                <motion.div
                                                    className="relative z-10"
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ 
                                                        opacity: 1, 
                                                        scale: [1, 1.02, 1],
                                                    }}
                                                    transition={{ 
                                                        opacity: { duration: 0.6 },
                                                        scale: {
                                                            duration: 3,
                                                            repeat: Infinity,
                                                            ease: "easeInOut"
                                                        }
                                                    }}
                                                >
                                                    {/* Детализированный SVG портрет с эффектом рисования */}
                                                    <svg 
                                                        width="140" 
                                                        height="180" 
                                                        viewBox="0 0 140 180" 
                                                        className="text-blue-700"
                                                        style={{ filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3))' }}
                                                    >
                                                        <defs>
                                                            <linearGradient id="portraitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                                                                <stop offset="100%" stopColor="#1e40af" stopOpacity="0.6" />
                                                            </linearGradient>
                                                            <filter id="glow">
                                                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                                                <feMerge>
                                                                    <feMergeNode in="coloredBlur"/>
                                                                    <feMergeNode in="SourceGraphic"/>
                                                                </feMerge>
                                                            </filter>
                                                        </defs>
                                                        
                                                        {/* Голова - с анимацией появления */}
                                                        <motion.circle
                                                            cx="70"
                                                            cy="35"
                                                            r="22"
                                                            fill="url(#portraitGradient)"
                                                            filter="url(#glow)"
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ 
                                                                opacity: [0, 0.8, 0.8, 0.8],
                                                                scale: [0.8, 1, 1.02, 1]
                                                            }}
                                                            transition={{
                                                                opacity: { duration: 0.6, delay: 0.2 },
                                                                scale: { 
                                                                    duration: 0.8, 
                                                                    delay: 0.2,
                                                                    repeat: Infinity,
                                                                    repeatDelay: 2.5,
                                                                    ease: "easeOut"
                                                                }
                                                            }}
                                                        />
                                                        
                                                        {/* Плечи и верхняя часть костюма */}
                                                        <motion.path
                                                            d="M 45 60 Q 45 55 50 57 L 90 57 Q 95 55 95 60 L 95 75 L 45 75 Z"
                                                            fill="url(#portraitGradient)"
                                                            filter="url(#glow)"
                                                            initial={{ opacity: 0, scaleY: 0.7 }}
                                                            animate={{ 
                                                                opacity: [0, 0.7, 0.7, 0.7],
                                                                scaleY: [0.7, 1, 1.01, 1]
                                                            }}
                                                            transition={{
                                                                opacity: { duration: 0.5, delay: 0.9 },
                                                                scaleY: { 
                                                                    duration: 0.7, 
                                                                    delay: 0.9,
                                                                    repeat: Infinity,
                                                                    repeatDelay: 2.5,
                                                                    ease: "easeOut"
                                                                }
                                                            }}
                                                        />
                                                        
                                                        {/* Тело костюма */}
                                                        <motion.rect
                                                            x="50"
                                                            y="75"
                                                            width="40"
                                                            height="70"
                                                            rx="3"
                                                            fill="url(#portraitGradient)"
                                                            filter="url(#glow)"
                                                            initial={{ opacity: 0, scaleY: 0.6 }}
                                                            animate={{ 
                                                                opacity: [0, 0.6, 0.6, 0.6],
                                                                scaleY: [0.6, 1, 1.01, 1]
                                                            }}
                                                            transition={{
                                                                opacity: { duration: 0.6, delay: 1.4 },
                                                                scaleY: { 
                                                                    duration: 0.8, 
                                                                    delay: 1.4,
                                                                    repeat: Infinity,
                                                                    repeatDelay: 2.5,
                                                                    ease: "easeOut"
                                                                }
                                                            }}
                                                        />
                                                        
                                                        {/* Ноги */}
                                                        <motion.rect
                                                            x="55"
                                                            y="145"
                                                            width="14"
                                                            height="35"
                                                            rx="2"
                                                            fill="url(#portraitGradient)"
                                                            filter="url(#glow)"
                                                            initial={{ opacity: 0, scaleY: 0.5 }}
                                                            animate={{ 
                                                                opacity: [0, 0.5, 0.5, 0.5],
                                                                scaleY: [0.5, 1, 1.01, 1]
                                                            }}
                                                            transition={{
                                                                opacity: { duration: 0.5, delay: 2.0 },
                                                                scaleY: { 
                                                                    duration: 0.6, 
                                                                    delay: 2.0,
                                                                    repeat: Infinity,
                                                                    repeatDelay: 2.5,
                                                                    ease: "easeOut"
                                                                }
                                                            }}
                                                        />
                                                        <motion.rect
                                                            x="71"
                                                            y="145"
                                                            width="14"
                                                            height="35"
                                                            rx="2"
                                                            fill="url(#portraitGradient)"
                                                            filter="url(#glow)"
                                                            initial={{ opacity: 0, scaleY: 0.5 }}
                                                            animate={{ 
                                                                opacity: [0, 0.5, 0.5, 0.5],
                                                                scaleY: [0.5, 1, 1.01, 1]
                                                            }}
                                                            transition={{
                                                                opacity: { duration: 0.5, delay: 2.2 },
                                                                scaleY: { 
                                                                    duration: 0.6, 
                                                                    delay: 2.2,
                                                                    repeat: Infinity,
                                                                    repeatDelay: 2.5,
                                                                    ease: "easeOut"
                                                                }
                                                            }}
                                                        />
                                                    </svg>
                                                    
                                                    {/* Шляпа - с плавной анимацией появления */}
                                                    <motion.div
                                                        className="absolute top-[-8px] left-1/2 -translate-x-1/2"
                                                        initial={{ y: -25, opacity: 0, rotate: -12, scale: 0.8 }}
                                                        animate={{ 
                                                            y: [0, -3, 0],
                                                            opacity: [0, 1, 1],
                                                            rotate: [0, -2, 0],
                                                            scale: [1, 1.05, 1]
                                                        }}
                                                        transition={{ 
                                                            y: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                                            opacity: { duration: 0.8, delay: 0.5 },
                                                            rotate: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                                            scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                                            repeat: Infinity,
                                                            repeatDelay: 0.5
                                                        }}
                                                        style={{ filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.4))' }}
                                                    >
                                                        <svg width="56" height="34" viewBox="0 0 56 34" className="text-blue-800">
                                                            <defs>
                                                                <linearGradient id="hatGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                    <stop offset="0%" stopColor="#1e40af" stopOpacity="0.9" />
                                                                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.7" />
                                                                </linearGradient>
                                                            </defs>
                                                            <path 
                                                                d="M12 28 Q28 8 44 28 L44 34 L12 34 Z" 
                                                                fill="url(#hatGradient)"
                                                                style={{ filter: 'drop-shadow(0 2px 4px rgba(30, 64, 175, 0.3))' }}
                                                            />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Усы - с анимацией рисования */}
                                                    <motion.div
                                                        className="absolute top-[50px] left-1/2 -translate-x-1/2"
                                                        initial={{ x: -25, opacity: 0, scaleX: 0 }}
                                                        animate={{ 
                                                            x: [0, 2, 0],
                                                            opacity: [0, 1, 1],
                                                            scaleX: [0, 1, 1]
                                                        }}
                                                        transition={{ 
                                                            x: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
                                                            opacity: { duration: 0.6, delay: 1.2 },
                                                            scaleX: { duration: 0.5, delay: 1.2 },
                                                            repeat: Infinity,
                                                            repeatDelay: 1.8
                                                        }}
                                                    >
                                                        <svg width="44" height="10" viewBox="0 0 44 10" className="text-blue-900">
                                                            <motion.path 
                                                                d="M6 5 Q16 2.5 22 5 Q28 7.5 38 5" 
                                                                stroke="currentColor" 
                                                                strokeWidth="2.5" 
                                                                fill="none"
                                                                strokeLinecap="round"
                                                                initial={{ pathLength: 0, opacity: 0 }}
                                                                animate={{ 
                                                                    pathLength: [0, 1, 1],
                                                                    opacity: [0, 0.9, 0.9]
                                                                }}
                                                                transition={{
                                                                    pathLength: { duration: 0.6, delay: 1.2, repeat: Infinity, repeatDelay: 1.8 },
                                                                    opacity: { duration: 0.4, delay: 1.2 }
                                                                }}
                                                                style={{ filter: 'drop-shadow(0 1px 3px rgba(30, 58, 138, 0.4))' }}
                                                            />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Галстук - с плавной анимацией */}
                                                    <motion.div
                                                        className="absolute top-[78px] left-1/2 -translate-x-1/2"
                                                        initial={{ y: -18, opacity: 0, scale: 0.4 }}
                                                        animate={{ 
                                                            y: [0, -2, 0],
                                                            opacity: [0, 1, 1],
                                                            scale: [1, 1.05, 1]
                                                        }}
                                                        transition={{ 
                                                            y: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.8 },
                                                            opacity: { duration: 0.7, delay: 1.8 },
                                                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.8 },
                                                            repeat: Infinity,
                                                            repeatDelay: 1.2
                                                        }}
                                                        style={{ filter: 'drop-shadow(0 2px 6px rgba(59, 130, 246, 0.35))' }}
                                                    >
                                                        <svg width="14" height="45" viewBox="0 0 14 45" className="text-blue-700">
                                                            <defs>
                                                                <linearGradient id="tieGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                                                                    <stop offset="50%" stopColor="#2563eb" stopOpacity="0.7" />
                                                                    <stop offset="100%" stopColor="#1e40af" stopOpacity="0.6" />
                                                                </linearGradient>
                                                            </defs>
                                                            <path 
                                                                d="M7 0 L9 18 L7 45 L5 18 Z" 
                                                                fill="url(#tieGradient)"
                                                            />
                                                        </svg>
                                                    </motion.div>
                                                    
                                                    {/* Пиджак (плечи) - с эффектом расширения */}
                                                    <motion.div
                                                        className="absolute top-[62px] left-1/2 -translate-x-1/2"
                                                        initial={{ scaleX: 0, opacity: 0 }}
                                                        animate={{ 
                                                            scaleX: [0, 1, 1],
                                                            opacity: [0, 0.6, 0.6]
                                                        }}
                                                        transition={{ 
                                                            scaleX: { duration: 0.6, delay: 2.4, repeat: Infinity, repeatDelay: 1.6 },
                                                            opacity: { duration: 0.5, delay: 2.4 },
                                                            repeat: Infinity,
                                                            repeatDelay: 1.6
                                                        }}
                                                    >
                                                        <svg width="65" height="22" viewBox="0 0 65 22" className="text-blue-600">
                                                            <rect 
                                                                x="0" 
                                                                y="0" 
                                                                width="65" 
                                                                height="22" 
                                                                rx="6" 
                                                                fill="currentColor" 
                                                                opacity="0.5"
                                                                style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.25))' }}
                                                            />
                                                        </svg>
                                                    </motion.div>
                                                </motion.div>
                                                
                                                {/* Текст "Генерация..." с улучшенной анимацией */}
                                                <motion.div
                                                    className="absolute bottom-8 left-0 right-0 text-center z-20"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ 
                                                        opacity: [0, 1, 1],
                                                        y: [10, 0, 0]
                                                    }}
                                                    transition={{ 
                                                        opacity: { duration: 0.5, delay: 0.3 },
                                                        y: { duration: 0.5, delay: 0.3 }
                                                    }}
                                                >
                                                    <motion.p 
                                                        className="text-sm font-semibold text-blue-900 mb-1"
                                                        animate={{
                                                            opacity: [0.8, 1, 0.8]
                                                        }}
                                                        transition={{
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            ease: "easeInOut"
                                                        }}
                                                    >
                                                        Генерация...
                                                    </motion.p>
                                                    {estimatedWaitTime !== undefined && estimatedWaitTime > 0 && (
                                                        <p className="text-xs text-blue-700">
                                                            Осталось ~{formatWaitTime(estimatedWaitTime)}
                                                        </p>
                                                    )}
                                                </motion.div>
                                                
                                                {/* Улучшенные пульсирующие точки */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                                                    {[0, 1, 2].map((i) => (
                                                        <motion.div
                                                            key={i}
                                                            className="w-2.5 h-2.5 bg-blue-500 rounded-full"
                                                            animate={{
                                                                scale: [1, 1.3, 1],
                                                                opacity: [0.4, 1, 0.4],
                                                                y: [0, -3, 0]
                                                            }}
                                                            transition={{
                                                                duration: 1.2,
                                                                repeat: Infinity,
                                                                delay: i * 0.25,
                                                                ease: "easeInOut"
                                                            }}
                                                            style={{ 
                                                                boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)'
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
