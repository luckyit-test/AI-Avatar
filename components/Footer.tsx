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
                                className="text-sm font-medium transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
                            >
                                kuznetsov@i-integrator.com
                            </a>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-gray-500">Телефон</span>
                            <a 
                                href="tel:+79256852525" 
                                className="text-sm font-medium transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
                            >
                                +7 925 685-25-25
                            </a>
                        </div>
                    </div>

                    {/* Центральная секция - Логотип и навигация */}
                    <div className="flex flex-col items-center gap-4 flex-1">
                        {/* Логотип */}
                        <div className="flex items-center gap-3">
                            <img 
                                src="/logo.png" 
                                alt="newava.pro logo"
                                className="w-auto object-contain"
                                style={{
                                    height: '48px',
                                }}
                            />
                        </div>

                        {/* Навигационные ссылки */}
                        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
                            <button
                                type="button"
                                onClick={onOpenRules}
                                className="transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
                            >
                                Правила генераций
                            </button>
                            <a
                                href="/oferta.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
                            >
                                Оферта
                            </a>
                            <a
                                href="/"
                                className="transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
                            >
                                Сгенерировать портрет
                            </a>
                            <a
                                href="/gallery"
                                className="transition-colors"
                                style={{ color: 'rgb(67, 89, 241)' }}
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
                                color: 'rgb(67, 89, 241)'
                            }}
                        >
                            <img 
                                src="/headphone.png" 
                                alt="Support"
                                className="w-5 h-5 object-contain"
                            />
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
