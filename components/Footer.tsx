/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Footer = () => {
    return (
        <footer className="w-full mt-auto bg-white border-t border-gray-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 py-4 text-sm text-gray-500">
                    <p>
                        Создано{' '}
                        <a
                            href="https://x.com/ammaar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-700 hover:text-blue-600 transition-colors"
                        >
                            @ammaar
                        </a>
                    </p>
                    <div className="flex items-center gap-4">
                         <a
                            href="https://gemini.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-700 hover:text-blue-600 transition-colors"
                        >
                            Чат с Gemini
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
