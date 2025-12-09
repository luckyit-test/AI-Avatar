import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

export function HeaderMenu() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const menuItems = [
        { label: 'КАК ЭТО РАБОТАЕТ', href: '#how-it-works' },
        { label: 'ПРИМЕРЫ РАБОТ', href: '/gallery' },
        { label: 'ЦЕНЫ', href: '#prices' },
        { label: 'ПОПРОБОВАТЬ БЕСПЛАТНО', href: '#try-free', highlight: true },
    ];

    const handleMenuClick = (href: string) => {
        setIsMobileMenuOpen(false);
        if (href.startsWith('#')) {
            // Прокрутка к якорю
            const element = document.querySelector(href);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    return (
        <header 
            className="border-b sticky top-0 z-50"
            style={{
                background: 'rgb(139, 5, 5)',
                backdropFilter: 'blur(16px)',
                borderColor: 'rgba(226, 232, 240, 0.6)',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                    {/* Логотип */}
                    <a
                        href="/"
                        className="flex items-center justify-center logo-container cursor-pointer transition-opacity duration-200 hover:opacity-80"
                    >
                        <img 
                            src="/loho-hn.png" 
                            alt="Новогодние фотосессии"
                            className="w-auto object-contain"
                            style={{
                                height: '80px',
                            }}
                        />
                    </a>
                    
                    {/* Десктопное меню */}
                    <nav className="hidden md:flex items-center gap-1">
                        {menuItems.map((item, index) => {
                            return (
                                <a
                                    key={index}
                                    href={item.href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleMenuClick(item.href);
                                    }}
                                    className={cn(
                                        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                                        item.highlight
                                            ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg hover:shadow-xl'
                                            : 'text-white hover:bg-white/10 hover:text-white'
                                    )}
                                >
                                    {item.label}
                                </a>
                            );
                        })}
                    </nav>

                    {/* Гамбургер меню для мобильных */}
                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                        aria-label="Открыть меню"
                    >
                        {isMobileMenuOpen ? (
                            <Icons.close className="w-6 h-6" />
                        ) : (
                            <Icons.menu className="w-6 h-6" />
                        )}
                    </button>
                </div>

                {/* Мобильное меню */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.nav
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden overflow-hidden"
                        >
                            <div className="py-4 space-y-2 border-t border-white/20">
                                {menuItems.map((item, index) => {
                                    return (
                                        <a
                                            key={index}
                                            href={item.href}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleMenuClick(item.href);
                                            }}
                                            className={cn(
                                                'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                                                item.highlight
                                                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                                                    : 'text-white hover:bg-white/10'
                                            )}
                                        >
                                            {item.label}
                                        </a>
                                    );
                                })}
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </div>
        </header>
    );
}

