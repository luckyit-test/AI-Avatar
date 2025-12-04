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
        <>
            <div className="mb-6" data-onboarding="gender">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-1">
                    <Icons.career className="w-4 h-4 text-blue-500" />
                    Пол
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                    {genderOverride === null 
                        ? 'Выберите пол для генерации портретов' 
                        : genderOverride === 'male'
                        ? 'Выбран: Мужской'
                        : 'Выбран: Женский'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        className={cn(
                            'px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                            genderOverride === 'male'
                                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-medium' 
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300',
                            isDisabled && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                            if (appState === 'image-uploaded') {
                                onGenderChange('male');
                            }
                        }}
                        disabled={isDisabled}
                    >
                        Мужской
                    </button>
                    <button
                        className={cn(
                            'px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                            genderOverride === 'female'
                                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm font-medium' 
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300',
                            isDisabled && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                            if (appState === 'image-uploaded') {
                                onGenderChange('female');
                            }
                        }}
                        disabled={isDisabled}
                    >
                        Женский
                    </button>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4">
                <div data-onboarding="role">
                    <CustomSelect
                        label={(
                            <span className="inline-flex items-center gap-2">
                                <Icons.logo className="w-4 h-4 text-blue-500" />
                                <span>Должность в ИТ</span>
                            </span>
                        ) as unknown as string}
                        options={IT_ROLES}
                        value={selectedRole}
                        onChange={(value) => onRoleChange(value as typeof IT_ROLES[number])}
                        placeholder="Выберите должность"
                    />
                </div>
                <div data-onboarding="company">
                    <CustomSelect
                        label={(
                            <span className="inline-flex items-center gap-2">
                                <Icons.logo className="w-4 h-4 text-blue-500" />
                                <span>Тип компании</span>
                            </span>
                        ) as unknown as string}
                        options={COMPANY_TYPES}
                        value={selectedCompany}
                        onChange={(value) => onCompanyChange(value as typeof COMPANY_TYPES[number])}
                        placeholder="Выберите тип компании"
                    />
                </div>
            </div>
        </>
    );
}

