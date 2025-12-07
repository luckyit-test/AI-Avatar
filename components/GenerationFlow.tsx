/**
 * GenerationFlow component
 * Shows the generation process with 6 portrait cards in processing state
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCard from './ImageCard';
// УДАЛЕНО: STYLES - используется только для бизнес-портретов
// Для новогодних фотосессий используем динамические ключи image_0, image_1, ..., image_5

export interface GeneratedImage {
    status: 'pending' | 'queued' | 'processing' | 'done' | 'error';
    url?: string;
    error?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
}

export interface GenerationFlowProps {
    generatedImages: Record<string, GeneratedImage>;
    onRegenerate: (style: string) => void;
    onDownload: (style: string) => void;
    onOpen: (url: string) => void;
}

export function GenerationFlow({
    generatedImages,
    onRegenerate,
    onDownload,
    onOpen,
}: GenerationFlowProps) {

    // Для новогодних фотосессий используем динамические ключи image_0, image_1, ..., image_5
    const imageKeys = Array.from({ length: 6 }, (_, i) => `image_${i}`);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence>
                {imageKeys.map((style, index) => {
                    const imageState = generatedImages[style];
                    const status = imageState?.status || 'processing';
                    
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
                                gender={null}
                                onRegenerate={() => onRegenerate(style)}
                                onDownload={() => onDownload(style)}
                                onOpen={(url) => onOpen(url)}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

