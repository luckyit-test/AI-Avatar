/**
 * ImageConfiguration component
 * Handles gender, role (text input), and company size selection
 */
import React from 'react';
import { Icons } from './Icons';
import { CustomSelect } from './CustomSelect';
import { cn } from '../lib/utils';
import { COMPANY_SIZES } from '../lib/constants';
import type { DetectedGender } from '../services/geminiService';

export interface ImageConfigurationProps {
    genderOverride: 'male' | 'female' | null;
    selectedRole: string;
    selectedCompany: typeof COMPANY_SIZES[number];
    appState: 'idle' | 'image-uploaded' | 'generating' | 'results-shown' | 'failed';
    onGenderChange: (gender: 'male' | 'female' | null) => void;
    onRoleChange: (role: string) => void;
    onCompanyChange: (company: typeof COMPANY_SIZES[number]) => void;
    getEffectiveGender: () => DetectedGender | null;
}

export function ImageConfiguration({
    genderOverride,
    selectedRole,
    selectedCompany,
    appState,
    onGenderChange,
    onRoleChange,
    onCompanyChange,
    getEffectiveGender,
}: ImageConfigurationProps) {
    const isDisabled = appState === 'generating' || appState === 'results-shown';

    return (
        <div className="mb-6" data-onboarding="gender">
            {/* Заголовок секции */}
            <div className="flex items-start gap-3 mb-6">
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
                            2
                        </span>
                    </div>
                </div>
                <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-bold mb-1" style={{ color: '#1e293b' }}>
                        Настройте параметры
                    </h2>
                    <p className="text-sm text-gray-500">
                        Выберите пол
                    </p>
                </div>
            </div>

            {/* Кнопки "Пол" */}
            <div className="mb-6">
                <div className="flex gap-2">
                    <button
                        className={cn(
                            'flex-1 px-4 py-2.5 text-sm rounded-lg border transition-all duration-200 font-medium',
                            genderOverride === 'female'
                                ? 'bg-white border-gray-300 text-gray-900 shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-50',
                            isDisabled && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                            if (!isDisabled) {
                                onGenderChange('female');
                            }
                        }}
                        disabled={isDisabled}
                    >
                        Женский
                    </button>
                    <button
                        className={cn(
                            'flex-1 px-4 py-2.5 text-sm rounded-lg border transition-all duration-200 font-medium',
                            genderOverride === 'male'
                                ? 'bg-white border-gray-300 text-gray-900 shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-50',
                            isDisabled && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                            if (!isDisabled) {
                                onGenderChange('male');
                            }
                        }}
                        disabled={isDisabled}
                    >
                        Мужской
                    </button>
                </div>
            </div>

            {/* Поле "Должность" */}
            <div className="mb-6" data-onboarding="role">
                <label className="block text-sm font-bold mb-3" style={{ color: '#1e293b' }}>
                    Должность
                </label>
                <input
                    type="text"
                    value={selectedRole}
                    onChange={(e) => onRoleChange(e.target.value)}
                    placeholder="Введите вашу должность"
                    disabled={isDisabled}
                    className={cn(
                        'w-full px-4 py-2.5 text-sm rounded-lg border transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        isDisabled
                            ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                    )}
                />
            </div>

            {/* Поле "Размер компании" */}
            <div className="mb-6" data-onboarding="company">
                <label className="block text-sm font-bold mb-3" style={{ color: '#1e293b' }}>
                    Размер компании
                </label>
                <CustomSelect
                    options={COMPANY_SIZES}
                    value={selectedCompany}
                    onChange={(value) => onCompanyChange(value as typeof COMPANY_SIZES[number])}
                    placeholder="Выберите размер компании"
                />
            </div>
        </div>
    );
}
