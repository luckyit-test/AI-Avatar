/**
 * ImageConfiguration component
 * Handles gender, role, and company selection
 */
import React from 'react';
import { Icons } from './Icons';
import { CustomSelect } from './CustomSelect';
import { cn } from '../lib/utils';
import { IT_ROLES, COMPANY_TYPES } from '../lib/constants';
import type { DetectedGender } from '../services/geminiService';

export interface ImageConfigurationProps {
    genderOverride: 'male' | 'female' | null;
    selectedRole: typeof IT_ROLES[number];
    selectedCompany: typeof COMPANY_TYPES[number];
    appState: 'idle' | 'image-uploaded' | 'generating' | 'results-shown' | 'failed';
    onGenderChange: (gender: 'male' | 'female' | null) => void;
    onRoleChange: (role: typeof IT_ROLES[number]) => void;
    onCompanyChange: (company: typeof COMPANY_TYPES[number]) => void;
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
                        Под ваш запрос
                    </p>
                </div>
            </div>

            {/* Секция "Пол" */}
            <div className="mb-6">
                <label className="block text-sm font-bold mb-3" style={{ color: '#1e293b' }}>
                    Пол
                </label>
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

            {/* Секция "Должность в ИТ" */}
            <div className="mb-6" data-onboarding="role">
                <label className="block text-sm font-bold mb-3" style={{ color: '#1e293b' }}>
                    Должность в ИТ
                </label>
                <CustomSelect
                    label="Должность в ИТ"
                    options={IT_ROLES}
                    value={selectedRole}
                    onChange={(value) => onRoleChange(value as typeof IT_ROLES[number])}
                    placeholder="Выберите должность"
                />
            </div>

            {/* Секция "Тип компании" */}
            <div className="mb-6" data-onboarding="company">
                <label className="block text-sm font-bold mb-3" style={{ color: '#1e293b' }}>
                    Тип компании
                </label>
                <CustomSelect
                    label="Тип компании"
                    options={COMPANY_TYPES}
                    value={selectedCompany}
                    onChange={(value) => onCompanyChange(value as typeof COMPANY_TYPES[number])}
                    placeholder="Выберите тип компании"
                />
            </div>
        </div>
    );
}

