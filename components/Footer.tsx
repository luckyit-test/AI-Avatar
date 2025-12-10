/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Icons } from './Icons';

type FooterProps = {
    onOpenRules?: () => void;
};

const Footer: React.FC<FooterProps> = ({ onOpenRules }) => {
    return (
        <footer className="w-full mt-8 bg-white border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                    {/* Левая секция - Контактная информация */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-gray-500">Email</span>
                            <a 
                                href="mailto:kuznetsov@i-integrator.com" 
                                className="text-sm font-medium hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                kuznetsov@i-integrator.com
                            </a>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-gray-500">Телефон</span>
                            <a 
                                href="tel:+79256852525" 
                                className="text-sm font-medium hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                +7 925 685-25-25
                            </a>
                        </div>
                    </div>

                    {/* Центральная секция - Логотип и навигация */}
                    <div className="flex flex-col items-center gap-4 flex-1">
                        {/* Логотип */}
                        <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex items-center justify-center">
                                {/* Круглый логотип с концентрическими кругами */}
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="24" cy="24" r="22" fill="url(#gradient1)" />
                                    <circle cx="24" cy="24" r="16" fill="url(#gradient2)" />
                                    <circle cx="24" cy="24" r="10" fill="url(#gradient3)" />
                                    <circle cx="24" cy="24" r="4" fill="rgb(30, 58, 138)" />
                                    <defs>
                                        <linearGradient id="gradient1" x1="0" y1="0" x2="48" y2="48">
                                            <stop offset="0%" stopColor="rgb(99, 102, 241)" />
                                            <stop offset="100%" stopColor="rgb(139, 92, 246)" />
                                        </linearGradient>
                                        <linearGradient id="gradient2" x1="0" y1="0" x2="32" y2="32">
                                            <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                                            <stop offset="100%" stopColor="rgb(99, 102, 241)" />
                                        </linearGradient>
                                        <linearGradient id="gradient3" x1="0" y1="0" x2="20" y2="20">
                                            <stop offset="0%" stopColor="rgb(99, 102, 241)" />
                                            <stop offset="100%" stopColor="rgb(139, 92, 246)" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-semibold" style={{ color: 'rgb(30, 58, 138)' }}>
                                    newava.pro
                                </span>
                                <span className="text-xs text-gray-500">
                                    Ваш AI бизнес-портрет
                                </span>
                            </div>
                        </div>

                        {/* Навигационные ссылки */}
                        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
                            <button
                                type="button"
                                onClick={onOpenRules}
                                className="hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                Правила генераций
                            </button>
                            <a
                                href="/oferta.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                Оферта
                            </a>
                            <a
                                href="/"
                                className="hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                Сгенерировать портрет
                            </a>
                            <a
                                href="/gallery"
                                className="hover:text-blue-600 transition-colors"
                                style={{ color: 'rgb(30, 58, 138)' }}
                            >
                                Галерея
                            </a>
                        </nav>
                    </div>

                    {/* Правая секция - Кнопка поддержки */}
                    <div className="flex items-center">
                        <a
                            href="mailto:kuznetsov@i-integrator.com"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ 
                                borderColor: 'rgb(147, 197, 253)',
                                color: 'rgb(30, 58, 138)'
                            }}
                        >
                            <Icons.headphones className="w-5 h-5" />
                            <span className="text-sm font-medium">Служба поддержки</span>
                        </a>
                    </div>
                </div>

                {/* Разделительная линия */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Индивидуальный предприниматель Кузнецов Р.С. ИНН 682 668 344 949 - ОГРНИП 319 774 600 123 810
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
