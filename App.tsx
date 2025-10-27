/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateImage } from './services/geminiService';
import { createAlbumPage } from './lib/albumUtils';
import Footer from './components/Footer';
import Uploader from './components/Uploader';
import ImageCard from './components/ImageCard';
import { Icons } from './components/Icons';

const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];

const PROMPTS: Record<string, string> = {
    'Классический': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a LinkedIn profile. The style should be classic and formal, with traditional corporate lighting and attire against a simple, neutral background.",
    'Современный': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a LinkedIn profile. The style should be modern and approachable, with natural lighting and a slightly blurred, contemporary office or neutral background.",
    'Креативный': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a profile for a creative industry professional. The style should be expressive, with more artistic lighting. The background can be a textured wall or a minimalist studio setting.",
    'Технологичный': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a LinkedIn profile in the tech industry. The style should be clean and minimalist, with bright, even lighting. A simple, light gray or white background is preferred. Attire should be smart-casual.",
    'Дружелюбный': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a LinkedIn profile. The style should be warm and friendly, with soft lighting and a genuine smile. The overall feel should be welcoming and approachable. The background should be clean and not distracting.",
    'Уверенный': "Create a professional, high-resolution business portrait of the person in the photo, suitable for a LinkedIn profile for an executive or leader. The style should be confident and powerful. The pose should be strong, attire sharp business formal, and the expression determined, against a clean, professional background.",
};

type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown';

function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppState>('idle');

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedImage(reader.result as string);
            setAppState('image-uploaded');
            setGeneratedImages({}); // Clear previous results
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;

        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        STYLES.forEach(style => {
            initialImages[style] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 2;
        const stylesQueue = [...STYLES];

        const processStyle = async (style: string) => {
            try {
                const prompt = PROMPTS[style];
                const resultUrl = await generateImage(uploadedImage, prompt);
                setGeneratedImages(prev => ({
                    ...prev,
                    [style]: { status: 'done', url: resultUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
                setGeneratedImages(prev => ({
                    ...prev,
                    [style]: { status: 'error', error: errorMessage },
                }));
                console.error(`Не удалось создать изображение для стиля ${style}:`, err);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (stylesQueue.length > 0) {
                const style = stylesQueue.shift();
                if (style) {
                    await processStyle(style);
                }
            }
        });

        await Promise.all(workers);
        setAppState('results-shown');
    };

    const handleRegenerateStyle = async (style: string) => {
        if (!uploadedImage || generatedImages[style]?.status === 'pending') return;
        
        setGeneratedImages(prev => ({ ...prev, [style]: { status: 'pending' } }));

        try {
            const prompt = PROMPTS[style];
            const resultUrl = await generateImage(uploadedImage, prompt);
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'done', url: resultUrl } }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setGeneratedImages(prev => ({ ...prev, [style]: { status: 'error', error: errorMessage } }));
            console.error(`Не удалось повторно создать изображение для стиля ${style}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
    };

    const handleDownloadIndividualImage = (style: string) => {
        const image = generatedImages[style];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `business-portrait-${style.toLowerCase().replace(' ', '-')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadAlbum = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                .filter((entry): entry is [string, GeneratedImage & { url: string }] => {
                    const image = entry[1] as GeneratedImage;
                    return image.status === 'done' && typeof image.url === 'string';
                })
                .reduce((acc, [style, image]) => {
                    acc[style] = image.url;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length === 0) {
                alert("Нет сгенерированных изображений для скачивания.");
                return;
            }

            const albumDataUrl = await createAlbumPage(imageData);
            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'business-portraits-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Не удалось создать или скачать альбом:", error);
            alert("К сожалению, произошла ошибка при создании вашего альбома. Пожалуйста, попробуйте еще раз.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    const isGenerationComplete = appState === 'results-shown';

    return (
        <div className="min-h-screen w-full bg-gray-50 text-gray-800 flex flex-col">
            <header className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center gap-2">
                           <Icons.logo className="h-8 w-8 text-blue-600" />
                            <h1 className="text-xl font-semibold text-gray-900">AI Бизнес-Портрет</h1>
                        </div>
                         <a
                            href="https://aistudio.google.com/apps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-500 hidden sm:block"
                        >
                            Создано в Google AI Studio
                        </a>
                    </div>
                </div>
            </header>
            
            <main className="flex-1 w-full container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* --- Left Column: Controls --- */}
                    <aside className="w-full lg:w-1/3 lg:max-w-sm flex-shrink-0">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm sticky top-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Загрузите ваше фото</h2>
                            <p className="text-sm text-gray-500 mb-4">Выберите четкое изображение лица анфас.</p>
                            
                            <AnimatePresence mode="wait">
                                {appState === 'idle' && (
                                    <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <Uploader onImageUpload={handleImageUpload} />
                                    </motion.div>
                                )}
                                {(appState !== 'idle') && uploadedImage && (
                                     <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <img src={uploadedImage} alt="Uploaded preview" className="w-full rounded-md object-cover aspect-square" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            
                            <div className="mt-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Сгенерируйте портреты</h2>
                                <p className="text-sm text-gray-500 mb-4">Мы создадим 6 профессиональных портретов в разных стилях.</p>
                                {appState === 'image-uploaded' && (
                                    <button onClick={handleGenerateClick} className="enterprise-button-primary w-full">
                                        <Icons.sparkles className="w-4 h-4 mr-2" />
                                        Сгенерировать
                                    </button>
                                )}
                                 {appState === 'generating' && (
                                    <button disabled className="enterprise-button-primary w-full opacity-70 cursor-not-allowed">
                                        <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                        Генерация...
                                    </button>
                                )}
                                {appState === 'results-shown' && (
                                     <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleReset} className="enterprise-button-secondary w-full">
                                            <Icons.reset className="w-4 h-4 mr-2" />
                                            Сбросить
                                        </button>
                                        <button onClick={handleDownloadAlbum} disabled={isDownloading} className="enterprise-button-primary w-full">
                                            {isDownloading ? (
                                                <Icons.spinner className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Icons.download className="w-4 h-4 mr-2" />
                                            )}
                                            Альбом
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                    
                    {/* --- Right Column: Results --- */}
                    <section className="flex-1">
                        <AnimatePresence>
                            {appState === 'idle' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="h-full flex flex-col items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
                                >
                                    <Icons.gallery className="h-16 w-16 text-gray-400 mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-800">Ваши бизнес-портреты</h3>
                                    <p className="text-gray-500 mt-2 max-w-md">
                                        После загрузки фото здесь появятся ваши сгенерированные изображения.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {(appState === 'generating' || appState === 'results-shown') && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                                <AnimatePresence>
                                {STYLES.map((style, index) => (
                                    <motion.div
                                        key={style}
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <ImageCard
                                            caption={style}
                                            status={generatedImages[style]?.status || 'pending'}
                                            imageUrl={generatedImages[style]?.url}
                                            error={generatedImages[style]?.error}
                                            onRegenerate={() => handleRegenerateStyle(style)}
                                            onDownload={() => handleDownloadIndividualImage(style)}
                                        />
                                    </motion.div>
                                ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default App;
