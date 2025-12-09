/**
 * GalleryPage component
 * Displays a grid of 9 random portraits from recent orders with pagination
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import Footer from './Footer';

interface GalleryItem {
    orderId: string;
    imageUrl: string;
    createdAt: number;
}

const ITEMS_PER_PAGE = 9;

export function GalleryPage() {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadGallery = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch('/api/gallery/orders');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                setItems(data.items || []);
            } catch (err) {
                console.error('[GalleryPage] Failed to load gallery:', err);
                setError('Не удалось загрузить галерею портретов');
            } finally {
                setIsLoading(false);
            }
        };

        loadGallery();
    }, []);

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = items.slice(startIndex, endIndex);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            // Прокрутка вверх при смене страницы
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen w-full text-gray-800 flex flex-col" style={{ background: '#f8f9fa' }}>
            {/* Header - такой же как на главной */}
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
                    <div className="flex justify-between items-center py-5">
                        <div className="flex items-center gap-4">
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
                                        height: '55px',
                                    }}
                                />
                            </a>
                            
                            {/* Текстовая часть */}
                            <div 
                                className="flex flex-col gap-0.5"
                                style={{
                                    marginLeft: '-5px',
                                    marginTop: '-5px',
                                }}
                            >
                                <h1 className="flex items-baseline gap-1.5">
                                    <span 
                                        className="text-2xl font-bold tracking-tight"
                                        style={{
                                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                        }}
                                    >
                                        newava
                                    </span>
                                    <span 
                                        className="text-lg font-semibold px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.25rem',
                                        }}
                                    >
                                        .pro
                                    </span>
                                </h1>
                                <p 
                                    className="text-xs font-medium tracking-wide"
                                    style={{
                                        color: '#64748b',
                                        letterSpacing: '0.025em',
                                    }}
                                >
                                    АІ-ПОРТРЕТЫ
                                </p>
                            </div>
                        </div>
                        
                        {/* Кнопки справа */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Кнопка "Поддержка" - скрыта на мобильных */}
                            <a
                                href="mailto:kuznetsov@i-integrator.com"
                                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 touch-manipulation active:scale-[0.98]"
                            >
                                <Icons.helpCircle className="w-4 h-4" />
                                Поддержка
                            </a>
                            {/* Кнопка "Портреты" - адаптивный текст */}
                            <a
                                href="/gallery"
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 touch-manipulation active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3), 0 2px 4px -2px rgba(99, 102, 241, 0.3)',
                                }}
                            >
                                <Icons.sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">Смотреть портреты</span>
                                <span className="sm:hidden">Портреты</span>
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full container mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Заголовок */}
                <h2 
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                >
                    Наши портреты
                </h2>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <Icons.spinner className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Icons.error className="w-16 h-16 text-red-500 mb-4" />
                        <p className="text-lg text-gray-700">{error}</p>
                    </div>
                )}

                {/* Gallery Grid */}
                {!isLoading && !error && (
                    <>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentPage}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
                            >
                                {currentItems.map((item, index) => (
                                    <motion.div
                                        key={`${item.orderId}-${index}`}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                        className="group relative aspect-square rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300"
                                    >
                                        <img
                                            src={item.imageUrl}
                                            alt={`Portrait from order ${item.orderId}`}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            loading="lazy"
                                        />
                                        {/* Overlay gradient for better hover effect */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </AnimatePresence>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mb-12">
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation"
                                >
                                    Назад
                                </button>
                                
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => handlePageChange(page)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 touch-manipulation ${
                                                page === currentPage
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation"
                                >
                                    Вперед
                                </button>
                            </div>
                        )}

                        {/* Generate Button */}
                        <div className="flex justify-center">
                            <a
                                href="/"
                                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-lg font-semibold text-white transition-all duration-200 touch-manipulation active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -4px rgba(99, 102, 241, 0.3)',
                                }}
                            >
                                <Icons.sparkles className="w-5 h-5" />
                                СГЕНЕРИРОВАТЬ ПОРТРЕТ
                            </a>
                        </div>
                    </>
                )}
            </main>

            {/* Footer - такой же как на главной */}
            <Footer />
        </div>
    );
}

