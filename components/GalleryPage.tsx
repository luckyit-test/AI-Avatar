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
    const [isRulesOpen, setIsRulesOpen] = useState(false);

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
                    background: 'rgba(255, 255, 255, 0.98)',
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
                                    src="/logo.png" 
                                    alt="newava.pro logo"
                                    className="w-auto object-contain"
                                    style={{
                                        height: '75px',
                                    }}
                                />
                            </a>
                        </div>
                        
                        {/* Кнопки справа */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Кнопка "Поддержка" - скрыта на мобильных */}
                            <button
                                type="button"
                                onClick={() => {
                                    // Открываем Gmail compose с предзаполненным адресом
                                    // Это работает даже если почтовый клиент не установлен
                                    window.open('https://mail.google.com/mail/?view=cm&fs=1&to=info@i-integrator.com', '_blank');
                                }}
                                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 touch-manipulation active:scale-[0.98]"
                            >
                                <img 
                                    src="/headphone.png" 
                                    alt="Support"
                                    className="w-4 h-4 object-contain"
                                />
                                Поддержка
                            </button>
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
            <Footer onOpenRules={() => setIsRulesOpen(true)} />
            
            {/* Rules Modal */}
            <AnimatePresence>
                {isRulesOpen && (
                    <motion.div
                        key="rules-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setIsRulesOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.96, opacity: 0 }}
                            className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 sm:p-8 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                aria-label="Закрыть правила генераций"
                                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                                onClick={() => setIsRulesOpen(false)}
                            >
                                <Icons.close className="h-4 w-4" />
                            </button>
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
                                Правила генераций
                            </h2>
                            <div className="space-y-4 text-sm sm:text-base text-gray-700">
                                <p>
                                    Перед созданием портретов внимательно ознакомьтесь с правилами. Нажимая кнопку
                                    <span className="font-semibold"> «Сгенерировать»</span>, вы подтверждаете, что
                                    согласны с данными условиями.
                                </p>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">1. Требования к фотографиям</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>На фото должно быть чётко видно лицо, без сильных теней и пересветов.</li>
                                        <li>Желательно один человек в кадре, без посторонних людей на переднем плане.</li>
                                        <li>Без сильных фильтров, масок, AR‑эффектов и дорисованных элементов.</li>
                                        <li>Избегайте слишком маленьких, размытых или сильно обрезанных изображений.</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">2. Системные и контент‑ошибки</h3>
                                    <p>
                                        Мы разделяем ошибки на системные (технические сбои генерации) и контент‑ошибки
                                        (когда исходная фотография не удовлетворяет требованиям или содержит
                                        некорректный контент).
                                    </p>
                                    <p>
                                        За <span className="font-semibold">контент‑ошибки</span> оплата не
                                        возвращается: сервис не несёт ответственности за результат, если исходное фото
                                        не подходит под данные правила.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">3. Повторные попытки</h3>
                                    <p>
                                        При технических сбоях генерации вы можете сделать до{' '}
                                        <span className="font-semibold">двух повторных попыток</span> по одному заказу.
                                        Если проблема не решается, вы можете обратиться в службу поддержки.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">4. Права на сгенерированные изображения</h3>
                                    <p>
                                        Нажимая на кнопку <span className="font-semibold">«Сгенерировать портреты»</span> или при применении промокода, вы даёте право нам на сгенерированные изображения и мы можем использовать их в качестве примеров сгенерированных портретов на этом ресурсе.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">5. Ответственность и поддержка</h3>
                                    <p>
                                        Нажимая кнопку <span className="font-semibold">«Сгенерировать»</span>, вы
                                        подтверждаете, что согласны с этими правилами. В случае нарушения правил
                                        генерации сервис не несёт ответственности за потраченные средства.
                                    </p>
                                    <p>
                                        Если вы не согласны с полученными результатами или у вас есть вопросы, вы
                                        можете написать в службу поддержки по адресу:{' '}
                                        <a
                                            href="mailto:info@i-integrator.com"
                                            className="text-blue-600 hover:underline"
                                        >
                                            info@i-integrator.com
                                        </a>
                                        .
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

