/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

type ImageStatus = 'pending' | 'done' | 'error';

interface ImageCardProps {
    imageUrl?: string;
    caption: string;
    status: ImageStatus;
    error?: string;
    onRegenerate: () => void;
    onDownload: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ imageUrl, caption, status, onRegenerate, onDownload }) => {
    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col group">
            <div className="w-full bg-gray-100 aspect-square relative">
                <AnimatePresence mode="wait">
                    {status === 'pending' && (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <Icons.spinner className="w-8 h-8 text-gray-400 animate-spin" />
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
                            <Icons.error className="w-10 h-10 text-red-500" />
                            <p className="mt-2 text-sm text-red-600">Ошибка генерации</p>
                        </motion.div>
                    )}
                    {status === 'done' && imageUrl && (
                         <motion.div
                            key="done"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                        >
                            <img
                                src={imageUrl}
                                alt={caption}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                                <button
                                    onClick={onDownload}
                                    className="h-10 w-10 rounded-full bg-white/20 text-white backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                                    aria-label={`Скачать ${caption}`}
                                >
                                    <Icons.download className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={onRegenerate}
                                    className="h-10 w-10 rounded-full bg-white/20 text-white backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                                    aria-label={`Создать заново ${caption}`}
                                >
                                    <Icons.refresh className="h-5 w-5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="p-4 border-t border-gray-200">
                <p className={cn(
                    "font-medium text-center truncate",
                    status === 'error' ? 'text-red-600' : 'text-gray-800'
                )}>
                    {caption}
                </p>
            </div>
        </div>
    );
};

export default ImageCard;
