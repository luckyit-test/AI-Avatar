/**
 * Утилиты для сжатия изображений на клиенте
 * Особенно важно для мобильных устройств
 */

/**
 * Сжимает изображение до указанного максимального размера
 * @param file Исходный файл
 * @param maxWidth Максимальная ширина (по умолчанию 1920)
 * @param maxHeight Максимальная высота (по умолчанию 1920)
 * @param quality Качество JPEG (0-1, по умолчанию 0.85)
 * @returns Promise с data URL сжатого изображения
 */
export async function compressImage(
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1920,
    quality: number = 0.85
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Вычисляем новые размеры с сохранением пропорций
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Не удалось создать canvas контекст'));
                    return;
                }
                
                // Рисуем изображение на canvas с новыми размерами
                ctx.drawImage(img, 0, 0, width, height);
                
                // Конвертируем в data URL с указанным качеством
                const mimeType = file.type || 'image/jpeg';
                const compressedDataUrl = canvas.toDataURL(mimeType, quality);
                
                resolve(compressedDataUrl);
            };
            
            img.onerror = () => {
                reject(new Error('Ошибка загрузки изображения'));
            };
            
            img.src = e.target?.result as string;
        };
        
        reader.onerror = () => {
            reject(new Error('Ошибка чтения файла'));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Определяет, нужно ли сжимать изображение
 * @param file Исходный файл
 * @param isMobile Является ли устройство мобильным
 * @returns true если нужно сжимать
 */
export function shouldCompressImage(file: File, isMobile: boolean): boolean {
    // На мобильных устройствах сжимаем если файл больше 2MB
    if (isMobile && file.size > 2 * 1024 * 1024) {
        return true;
    }
    
    // На десктопе сжимаем если файл больше 5MB
    if (!isMobile && file.size > 5 * 1024 * 1024) {
        return true;
    }
    
    return false;
}

