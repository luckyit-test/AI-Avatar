/**
 * ResultsView component
 * Shows the generated portraits and download options
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';
import { GenerationFlow, type GeneratedImage } from './GenerationFlow';

export interface ResultsViewProps {
    generatedImages: Record<string, GeneratedImage>;
    isDownloading: boolean;
    onRegenerate: (style: string) => void;
    onDownload: (style: string) => void;
    onDownloadAll: () => Promise<void>;
    onOpen: (url: string) => void;
    onReset: () => void;
}

export function ResultsView({
    generatedImages,
    isDownloading,
    onRegenerate,
    onDownload,
    onDownloadAll,
    onOpen,
    onReset,
}: ResultsViewProps) {
    return (
        <>
            <GenerationFlow
                generatedImages={generatedImages}
                onRegenerate={onRegenerate}
                onDownload={onDownload}
                onOpen={onOpen}
            />
            
            <div className="flex items-center gap-3 mt-6">
                <button 
                    onClick={onReset} 
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 border bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm hover:shadow-md active:scale-[0.98]"
                    style={{ borderColor: 'rgb(245, 75, 75)' }}
                >
                    <Icons.reset className="w-4 h-4 mr-2" />
                    Создать новый
                </button>
                <button 
                    onClick={onDownloadAll}
                    disabled={isDownloading}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 text-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3), 0 4px 6px -4px rgba(16, 185, 129, 0.3)',
                    }}
                >
                    {isDownloading ? (
                        <>
                            <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                            Скачиваем...
                        </>
                    ) : (
                        <>
                            <Icons.download className="w-4 h-4 mr-2" />
                            Скачать все
                        </>
                    )}
                </button>
            </div>
        </>
    );
}

