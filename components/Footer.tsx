/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

type FooterProps = {
    onOpenRules?: () => void;
};

const Footer: React.FC<FooterProps> = ({ onOpenRules }) => {
    return (
        <footer 
            className="w-full mt-8 border-t border-gray-200"
            style={{
                background: 'rgb(139, 5, 5)',
            }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-3 items-center text-sm text-white">
                <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-white">
                    <button
                        type="button"
                        onClick={onOpenRules}
                        className="hover:text-gray-200 transition-colors underline decoration-dotted text-white"
                    >
                        Правила генераций
                    </button>
                    <span className="w-px h-4 bg-white/30" aria-hidden="true" />
                    <a href="tel:+79256852525" className="hover:text-gray-200 transition-colors text-white">
                        Контакты
                    </a>
                    <span className="w-px h-4 bg-white/30" aria-hidden="true" />
                    <a
                        href="/oferta.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-200 transition-colors text-white"
                    >
                        Оферта
                    </a>
                    <span className="w-px h-4 bg-white/30" aria-hidden="true" />
                    <a href="mailto:kuznetsov@i-integrator.com" className="hover:text-gray-200 transition-colors text-white">
                        Служба поддержки
                    </a>
                </nav>
                <p className="text-xs text-white/90 text-center">
                    Индивидуальный предприниматель&nbsp;Кузнецов&nbsp;Р.С. · ИНН&nbsp;682&nbsp;668&nbsp;344&nbsp;949 · ОГРНИП&nbsp;319&nbsp;774&nbsp;600&nbsp;123&nbsp;810
                </p>
                <p className="text-xs text-white/90 text-center">
                    Телефон:&nbsp;
                    <a href="tel:+79256852525" className="underline decoration-dotted text-white hover:text-gray-200">
                        +7&nbsp;925&nbsp;685‑25‑25
                    </a>
                    &nbsp;· Email:&nbsp;
                    <a href="mailto:kuznetsov@i-integrator.com" className="underline decoration-dotted text-white hover:text-gray-200">
                        kuznetsov@i-integrator.com
                    </a>
                </p>
            </div>
        </footer>
    );
};

export default Footer;
