/**
 * ImageUploadFlow component
 * Handles image upload UI and validation display
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { errorLogger } from '../lib/errorLogger';
import Uploader from './Uploader';
import { Icons } from './Icons';

export interface ImageUploadFlowProps {
    uploadedImage: string | null;
    isValidatingImage: boolean;
    validationStatusMessage: string;
    validationTimer: number;
    imageValidationError: string | null;
    onImageUpload: (file: File) => Promise<void>;
    onReset: () => void;
}

export function ImageUploadFlow({
    uploadedImage,
    isValidatingImage,
    validationStatusMessage,
    validationTimer,
    imageValidationError,
    onImageUpload,
    onReset,
}: ImageUploadFlowProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            <div data-onboarding="upload" className="mb-4">
                <div className="flex items-start gap-3">
                    <span
                        className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white flex-shrink-0 mt-0.5 shadow-md"
                        style={{
                            background: 'rgb(220, 38, 38)',
                        }}
                    >
                        1
                    </span>
                    <div>
                        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-0.5">
                            Загрузите ваше фото
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500">
                            Прикрепите фото анфас.
                        </p>
                    </div>
                </div>
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
                        onImageUpload(files[0]);
                    }
                }}
            />
            
            <AnimatePresence mode="wait">
                {!uploadedImage && !isValidatingImage && !imageValidationError && (
                    <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Uploader onImageUpload={onImageUpload} />
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
                        
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    let logs = errorLogger.getLogsAsText();
                                    if (!logs || logs.trim().length === 0) {
                                        const diagnosticInfo = {
                                            timestamp: new Date().toISOString(),
                                            userAgent: navigator.userAgent,
                                            url: window.location.href,
                                            errorMessage: imageValidationError,
                                        };
                                        logs = `=== ДИАГНОСТИЧЕСКАЯ ИНФОРМАЦИЯ ===\n\nВремя: ${diagnosticInfo.timestamp}\nОшибка: ${diagnosticInfo.errorMessage}\nURL: ${diagnosticInfo.url}\n\nUser-Agent: ${diagnosticInfo.userAgent}\n`;
                                    }
                                    
                                    try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            await navigator.clipboard.writeText(logs);
                                            alert('✅ Логи скопированы в буфер обмена!\n\nОтправьте их разработчику для диагностики.');
                                            return;
                                        }
                                    } catch (clipboardError) {
                                        console.warn('Clipboard API failed:', clipboardError);
                                    }
                                    
                                    try {
                                        const textarea = document.createElement('textarea');
                                        textarea.value = logs;
                                        textarea.style.position = 'fixed';
                                        textarea.style.left = '-999999px';
                                        document.body.appendChild(textarea);
                                        textarea.select();
                                        const successful = document.execCommand('copy');
                                        document.body.removeChild(textarea);
                                        if (successful) {
                                            alert('✅ Логи скопированы в буфер обмена!');
                                        }
                                    } catch (fallbackError) {
                                        console.error('All copy methods failed:', fallbackError);
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
                                    onReset();
                                }}
                                className="px-4 py-2 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                                Очистить и попробовать снова
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
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
            </AnimatePresence>
        </>
    );
}

