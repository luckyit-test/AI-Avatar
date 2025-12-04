/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface FooterProps {
    onOpenRules?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenRules }) => {
    return (
        <footer className="w-full mt-auto bg-white border-t border-gray-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 py-4 text-sm text-gray-500">
                    <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-gray-600">
                        <a href="tel:+79256852525" className="hover:text-blue-600 transition-colors">
                            Контакты
                        </a>
                        <span className="w-px h-4 bg-gray-300" aria-hidden="true" />
                        <a
                            href="/oferta.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors"
                        >
                            Оферта
                        </a>
                        {onOpenRules && (
                            <>
                                <span className="w-px h-4 bg-gray-300" aria-hidden="true" />
                                <button
                                    type="button"
                                    onClick={onOpenRules}
                                    className="hover:text-blue-600 transition-colors"
                                >
                                    Правила генераций
                                </button>
                            </>
                        )}
                        <span className="w-px h-4 bg-gray-300" aria-hidden="true" />
                        <a href="mailto:kuznetsov@i-integrator.com" className="hover:text-blue-600 transition-colors">
                            Служба поддержки
                        </a>
                    </nav>
                    <p className="text-xs text-gray-400 text-center">
                        Индивидуальный предприниматель&nbsp;Кузнецов&nbsp;Р.С. · ИНН&nbsp;682&nbsp;668&nbsp;344&nbsp;949 · ОГРНИП&nbsp;319&nbsp;774&nbsp;600&nbsp;123&nbsp;810
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
