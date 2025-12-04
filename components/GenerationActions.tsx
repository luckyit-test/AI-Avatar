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

    return (
        <>
            {/* Блок промокода - скрываем после применения */}
            {!currentOrder && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                            <Icons.sparkles className="w-4 h-4 text-emerald-500" />
                            <span>Промокод</span>
                        </span>
                    </div>
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
                            placeholder="Введите промокод"
                            className="flex-1 h-10 px-3 rounded-lg border border-gray-300 text-sm tracking-[0.15em] sm:tracking-[0.24em] uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            type="button"
                            disabled={promoLoading || !promoCodeInput || promoCodeInput.length !== 6 || !canUsePromo}
                            onClick={onPromoCodeApply}
                            className="inline-flex items-center justify-center h-10 px-3 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed touch-manipulation active:scale-[0.98]"
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 6px 14px rgba(16,185,129,0.35)',
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
            
            {!currentOrder && (
                <div data-onboarding="generate" className="mt-4">
                    <div className="flex items-start gap-3 mb-3">
                        <span
                            className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold text-white flex-shrink-0 mt-0.5"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 20px rgba(79,70,229,0.35)',
                            }}
                        >
                            2
                        </span>
                        <div className="flex-1">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-0.5">
                                Сгенерируйте портреты
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-500">
                                Мы создадим 6 портретов.
                            </p>
                        </div>
                    </div>
                    <div className="mb-4 w-full rounded-lg border border-gray-200 bg-slate-50 px-3 h-16 flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-500">
                            Стоимость генерации
                        </span>
                        <span className="text-sm sm:text-lg font-semibold text-gray-900">
                            100 ₽
                        </span>
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
                        type="button"
                        onClick={onGenerateClick} 
                        disabled={!canGenerate}
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 flex-1 h-10 py-2 px-4 text-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed touch-manipulation active:scale-[0.98]"
                        style={{
                            background: canGenerate
                                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                            boxShadow: canGenerate
                                ? '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)'
                                : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                            if (canGenerate && window.matchMedia('(hover: hover)').matches) {
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.4), 0 10px 10px -5px rgba(99, 102, 241, 0.4)';
                                e.currentTarget.style.transform = 'scale(1.02)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (canGenerate && window.matchMedia('(hover: hover)').matches) {
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }
                        }}
                        onTouchStart={(e) => {
                            if (canGenerate) {
                                e.currentTarget.style.opacity = '0.9';
                            }
                        }}
                        onTouchEnd={(e) => {
                            if (canGenerate) {
                                e.currentTarget.style.opacity = '1';
                            }
                        }}
                    >
                        <Icons.sparkles className="w-4 h-4 mr-2" />
                        {canGenerate ? 'Сгенерировать' : 'Выберите пол'}
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

