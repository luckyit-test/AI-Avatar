/**
 * GenerationActions component
 * Handles promo code input and generate button
 */
import React from 'react';
import { Icons } from './Icons';
import { cn } from '../lib/utils';
import type { DetectedGender } from '../services/geminiService';

export interface GenerationActionsProps {
    promoCodeInput: string;
    promoMessage: string | null;
    promoError: string | null;
    promoLoading: boolean;
    promoApplied: boolean;
    currentOrder: any | null;
    uploadedImage: string | null;
    appState: 'idle' | 'image-uploaded' | 'generating' | 'results-shown' | 'failed';
    isGeneratingIntermediate: boolean;
    onPromoCodeChange: (code: string) => void;
    onPromoCodeApply: () => Promise<void>;
    onGenerateClick: () => Promise<void>;
    onReset: () => void;
    getEffectiveGender: () => DetectedGender | null;
}

export function GenerationActions({
    promoCodeInput,
    promoMessage,
    promoError,
    promoLoading,
    promoApplied,
    currentOrder,
    uploadedImage,
    appState,
    isGeneratingIntermediate,
    onPromoCodeChange,
    onPromoCodeApply,
    onGenerateClick,
    onReset,
    getEffectiveGender,
}: GenerationActionsProps) {
    const effectiveGender = getEffectiveGender();
    const canGenerate = effectiveGender && (effectiveGender === 'male' || effectiveGender === 'female');
    const canUsePromo = !currentOrder && uploadedImage && canGenerate;
    // Промокод можно использовать если есть загруженное фото (пол может быть не выбран еще)
    const canEnterPromo = !currentOrder && uploadedImage;
    
    // Состояние для отслеживания touch событий и предотвращения двойных нажатий
    const [isProcessing, setIsProcessing] = React.useState(false);
    const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    
    // Обработчик клика с защитой от двойных нажатий
    const handleGenerateClick = React.useCallback(async () => {
        if (isProcessing || !canGenerate) return;
        
        setIsProcessing(true);
        try {
            await onGenerateClick();
        } catch (error) {
            console.error('[GenerationActions] Error in handleGenerateClick:', error);
        } finally {
            // Небольшая задержка для предотвращения двойных нажатий
            setTimeout(() => setIsProcessing(false), 300);
        }
    }, [isProcessing, canGenerate, onGenerateClick]);

    return (
        <>
            {!currentOrder && (
                <div data-onboarding="generate" className="mt-4">
                    <div className="flex items-start gap-3 mb-3">
                        <div
                            className="flex h-14 w-14 items-center justify-center rounded-full flex-shrink-0 mt-0.5 relative"
                            style={{
                                background: 'linear-gradient(135deg, #60a5fa 0%, #6366f1 50%, #8b5cf6 100%)',
                                padding: '3px',
                                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                            }}
                        >
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                                <span
                                    className="text-xl font-bold"
                                    style={{
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    3
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg sm:text-xl font-bold mb-1" style={{ color: '#1e293b' }}>
                                Сгенерируйте портреты
                            </h2>
                            <p className="text-sm text-gray-500">
                                Мы создадим 6 портретов.
                            </p>
                        </div>
                    </div>
                    
                    {/* Блок промокода - перемещен под шаг 2 */}
                    {!currentOrder && (
                        <div className="mb-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    value={promoCodeInput}
                                    onChange={(e) => {
                                        onPromoCodeChange(e.target.value.toUpperCase().slice(0, 6));
                                    }}
                                    placeholder="ПРОМОКОД"
                                    className="flex-1 h-10 px-2 sm:px-3 rounded-lg border border-gray-300 text-sm tracking-[0.15em] sm:tracking-[0.24em] uppercase focus:outline-none max-w-[calc(100%-90px)] sm:max-w-none"
                                />
                                <button
                                    type="button"
                                    disabled={promoLoading || !promoCodeInput || promoCodeInput.length !== 6 || !canEnterPromo}
                                    onClick={onPromoCodeApply}
                                    className="inline-flex items-center justify-center h-10 px-2 sm:px-3 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed touch-manipulation active:scale-[0.98] flex-shrink-0"
                                    style={{
                                        background: 'linear-gradient(135deg, #60a5fa 0%, #6366f1 50%, #8b5cf6 100%)',
                                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                                    }}
                                >
                                    {promoLoading ? 'Проверяем…' : 'Применить'}
                                </button>
                            </div>
                            {promoMessage && (
                                <div className="mt-2 flex items-center text-[11px] text-emerald-600">
                                    <Icons.checkCircle className="w-3.5 h-3.5 mr-1.5" />
                                    <span>{promoMessage}</span>
                                </div>
                            )}
                            {!promoMessage && promoError && (
                                <p className="mt-2 text-[11px] text-red-600">
                                    {promoError}
                                </p>
                            )}
                        </div>
                    )}
                    
                    {/* Блок стоимости генерации - переверстан с градиентной границей */}
                    <div className="mb-4 w-full rounded-xl relative overflow-hidden" style={{ padding: '1px', background: 'linear-gradient(135deg, #60a5fa 0%, #6366f1 50%, #8b5cf6 100%)' }}>
                        <div className="w-full rounded-xl bg-white px-4 py-4 flex items-center justify-between">
                            <span className="text-sm font-medium" style={{ color: 'rgb(124 93 242)' }}>
                                Стоимость генерации
                            </span>
                            <span className="text-lg font-semibold" style={{ color: 'rgb(124 93 242)' }}>
                                100 ₽
                            </span>
                        </div>
                    </div>
                </div>
            )}
            
            {appState === 'image-uploaded' && (
                <div className="flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={onReset} 
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm hover:shadow-md active:scale-[0.98] touch-manipulation"
                    >
                        <Icons.reset className="w-4 h-4 mr-2" />
                        Сбросить
                    </button>
                    <button 
                        ref={buttonRef}
                        type="button"
                        onClick={(e) => {
                            // Для touch устройств onClick может не сработать, используем touch события
                            if ('ontouchstart' in window) {
                                return;
                            }
                            // Для desktop используем стандартный onClick
                            if (canGenerate && !isProcessing) {
                                handleGenerateClick();
                            }
                        }}
                        disabled={!canGenerate || isProcessing}
                        aria-disabled={!canGenerate || isProcessing}
                        tabIndex={canGenerate && !isProcessing ? 0 : -1}
                        className={cn(
                            "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 text-white touch-manipulation active:scale-[0.98]",
                            (!canGenerate || isProcessing) && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                            background: canGenerate && !isProcessing
                                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                            boxShadow: canGenerate && !isProcessing
                                ? '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)'
                                : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            WebkitTapHighlightColor: 'rgba(99, 102, 241, 0.3)',
                        }}
                        onMouseEnter={(e) => {
                            if (canGenerate && !isProcessing && window.matchMedia('(hover: hover)').matches) {
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.4), 0 10px 10px -5px rgba(99, 102, 241, 0.4)';
                                e.currentTarget.style.transform = 'scale(1.02)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (canGenerate && !isProcessing && window.matchMedia('(hover: hover)').matches) {
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }
                        }}
                        onTouchStart={(e) => {
                            if (!canGenerate || isProcessing) return;
                            
                            // Предотвращаем scroll и другие действия
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const touch = e.touches[0];
                            touchStartRef.current = {
                                x: touch.clientX,
                                y: touch.clientY,
                                time: Date.now(),
                            };
                            
                            // Визуальная обратная связь
                            const button = e.currentTarget;
                            button.style.opacity = '0.9';
                            button.style.transform = 'scale(0.98)';
                        }}
                        onTouchMove={(e) => {
                            if (!touchStartRef.current || !canGenerate || isProcessing) return;
                            
                            const touch = e.touches[0];
                            const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
                            const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
                            
                            // Если движение больше 10px - это swipe, не tap
                            if (deltaX > 10 || deltaY > 10) {
                                // Сбрасываем визуальное состояние
                                const button = e.currentTarget;
                                button.style.opacity = '1';
                                button.style.transform = 'scale(1)';
                                touchStartRef.current = null;
                            }
                        }}
                        onTouchEnd={(e) => {
                            if (!canGenerate || isProcessing || !touchStartRef.current) {
                                touchStartRef.current = null;
                                return;
                            }
                            
                            // Предотвращаем стандартное поведение
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const touch = e.changedTouches[0];
                            const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
                            const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
                            const deltaTime = Date.now() - touchStartRef.current.time;
                            
                            // Проверяем, что это был tap (не swipe и не долгое нажатие)
                            if (deltaX < 10 && deltaY < 10 && deltaTime < 500) {
                                // Вызываем обработчик
                                handleGenerateClick();
                            }
                            
                            // Сбрасываем состояние
                            touchStartRef.current = null;
                            const button = e.currentTarget;
                            button.style.opacity = '1';
                            button.style.transform = 'scale(1)';
                        }}
                        onTouchCancel={(e) => {
                            // Сбрасываем состояние при отмене touch события
                            touchStartRef.current = null;
                            const button = e.currentTarget;
                            button.style.opacity = '1';
                            button.style.transform = 'scale(1)';
                        }}
                    >
                        {isProcessing ? (
                            <>
                                <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                Обработка...
                            </>
                        ) : (
                            <>
                                <Icons.sparkles className="w-4 h-4 mr-2" />
                                {canGenerate ? 'Сгенерировать' : 'Выберите пол'}
                            </>
                        )}
                    </button>
                </div>
            )}
            
            {appState === 'generating' && (
                <div className="w-full">
                    {isGeneratingIntermediate ? (
                        <button 
                            disabled 
                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium w-full h-10 py-2 px-4 text-white opacity-70 cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                            }}
                        >
                            <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                            Подготавливаем изображение...
                        </button>
                    ) : (
                        <button 
                            disabled 
                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium w-full h-10 py-2 px-4 text-white opacity-70 cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                            }}
                        >
                            <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                            Генерируем портреты...
                        </button>
                    )}
                </div>
            )}
        </>
    );
}

