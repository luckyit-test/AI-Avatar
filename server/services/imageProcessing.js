/**
 * Image processing services
 */
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IMAGE_ROOT_DIR } from '../config/index.js';

/**
 * Заменяет фон изображения на серый
 */
export async function replaceBackgroundWithGray(imageDataUrl) {
  try {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URL format');
    }
    
    const [, mimeType, base64Data] = match;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Используем sharp для обработки изображения
    // Получаем размеры исходного изображения
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;
    
    // Создаем серый фон того же размера
    const grayBackground = sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    });
    
    // Композиция: сначала серый фон, затем исходное изображение поверх
    const processedImage = await grayBackground
      .composite([{
        input: imageBuffer,
        blend: 'over'
      }])
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const base64 = processedImage.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('[replaceBackgroundWithGray] Error:', error);
    throw error;
  }
}

/**
 * Агрессивная обработка промежуточного изображения
 */
export async function processIntermediateImageAggressively(imageDataUrl, level = 2) {
  try {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid image data URL format');
    }
    
    const [, mimeType, base64Data] = match;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    
    // Агрессивная обработка в зависимости от уровня
    let processedBuffer;
    
    if (level === 1) {
      // Базовая обработка: замена фона на серый
      processedBuffer = await replaceBackgroundWithGray(imageDataUrl);
      const match2 = processedBuffer.match(/^data:image\/\w+;base64,(.*)$/);
      return match2 ? processedBuffer : `data:image/jpeg;base64,${Buffer.from(processedBuffer).toString('base64')}`;
    } else {
      // Более агрессивная обработка: уменьшение размера и упрощение
      processedBuffer = await sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .greyscale()
        .normalize()
        .jpeg({ quality: 70 })
        .toBuffer();
      
      const base64 = processedBuffer.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (error) {
    console.error('[processIntermediateImageAggressively] Error:', error);
    throw error;
  }
}

