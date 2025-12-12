/**
 * Portrait generation service
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { IMAGE_ROOT_DIR } from '../config/index.js';
import { buildPortraitPrompts } from './promptBuilder.js';
import { replaceBackgroundWithGray } from './imageProcessing.js';
import { addToQueue, getJobStatus } from '../queues/generationQueue.js';
import { loadOrder, saveOrder, orderImages } from '../db/orders.js';

const STYLES = ['Классический', 'Современный', 'Креативный', 'Технологичный', 'Дружелюбный', 'Уверенный'];

// Функция для добавления задачи в очередь с запуском обработки
// Должна быть передана из server/index.js как зависимость
let addToQueueWithProcessing = null;

export function setAddToQueueFunction(fn) {
  addToQueueWithProcessing = fn;
}

/**
 * Сохраняет изображение на диск и возвращает публичный URL
 */
export async function saveImageForOrder(style, dataUrl, invId) {
  try {
    const styleSlugMap = {
      'Классический': 'klassicheskiy',
      'Современный': 'sovremennyy',
      'Креативный': 'kreativnyy',
      'Технологичный': 'tekhnologichnyy',
      'Дружелюбный': 'druzhelyubnyy',
      'Уверенный': 'uverenniy',
    };
    const slug =
      styleSlugMap[style] ||
      String(style)
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

    const orderDir = join(IMAGE_ROOT_DIR, 'orders', String(invId));
    await fs.mkdir(orderDir, { recursive: true });

    const fileName = `${slug}.jpg`;
    const filePath = join(orderDir, fileName);

    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Data = match ? match[1] : dataUrl.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      const maxDimension = 800;
      let resizeOptions = null;
      
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        resizeOptions = {
          width: metadata.width > metadata.height ? maxDimension : null,
          height: metadata.height > metadata.width ? maxDimension : null,
          fit: 'inside',
          withoutEnlargement: true,
        };
      }
      
      let processingPipeline = image;
      if (resizeOptions) {
        processingPipeline = processingPipeline.resize(resizeOptions.width, resizeOptions.height, resizeOptions);
      }
      
      const optimizedBuffer = await processingPipeline
        .jpeg({ 
          quality: 65,
          mozjpeg: true,
          progressive: false,
        })
        .toBuffer();
      
      await fs.writeFile(filePath, optimizedBuffer);
      const compressionRatio = ((1 - optimizedBuffer.length / buffer.length) * 100).toFixed(1);
      console.log(`[saveImageForOrder] Optimized image saved: ${fileName}, original: ${(buffer.length / 1024).toFixed(1)}KB, optimized: ${(optimizedBuffer.length / 1024).toFixed(1)}KB, compression: ${compressionRatio}%`);
    } catch (optimizeError) {
      console.warn(`[saveImageForOrder] Failed to optimize image, saving original:`, optimizeError);
      await fs.writeFile(filePath, buffer);
    }

    const publicUrl = `/images/orders/${encodeURIComponent(String(invId))}/${encodeURIComponent(fileName)}`;
    return publicUrl;
  } catch (err) {
    console.error(`[generatePortraitsForOrder] Failed to save image for order ${invId}, style ${style}:`, err);
    return dataUrl;
  }
}

/**
 * Генерирует портреты для заказа
 */
export async function generatePortraitsForOrder(invId, MAX_QUEUE_SIZE, addToQueueFn = null) {
  console.log(`[generatePortraitsForOrder] Called with invId=${invId}, MAX_QUEUE_SIZE=${MAX_QUEUE_SIZE}, addToQueueFn=${!!addToQueueFn}, addToQueueWithProcessing=${!!addToQueueWithProcessing}`);
  
  const order = loadOrder(invId);
  const imageData = orderImages.get(String(invId));
  if (!order || !imageData) {
    console.error(
      `[generatePortraitsForOrder] Order ${invId} not found or missing imageData`,
      { hasOrder: !!order, hasImageData: !!imageData }
    );
    return;
  }
  
  const { gender, role, company } = order;
  
  order.status = 'processing';
  order.generatedImages = {};
  saveOrder(order);
  
  console.log(`[generatePortraitsForOrder] Starting generation for order ${invId}`, { gender, role, company });

  try {
    // ШАГ 1: Генерируем промежуточное изображение
    let intermediateImage;
    try {
      intermediateImage = await replaceBackgroundWithGray(imageData);
      console.log(`[generatePortraitsForOrder] Intermediate image generated for order ${invId}`);
    } catch (err) {
      console.error(`[generatePortraitsForOrder] Failed to generate intermediate image for order ${invId}:`, err);
      intermediateImage = imageData;
    }
    
    // ШАГ 2: Строим промпты для всех 6 стилей
    const prompts = buildPortraitPrompts(gender, role, company);
    
    // ШАГ 3: Генерируем все 6 портретов параллельно
    console.log(`[generatePortraitsForOrder] Generating 6 final portraits`);
    
    const generationPromises = STYLES.map(async (style) => {
      const prompt = prompts[style];
      console.log(`[generatePortraitsForOrder] Starting generation for style: ${style}`);
      try {
        // Используем функцию с обработкой очереди, если передана, иначе обычную addToQueue
        // Используем функцию с обработкой очереди, если передана или установлена через setAddToQueueFunction
        const queueFn = addToQueueFn || addToQueueWithProcessing || addToQueue;
        console.log(`[generatePortraitsForOrder] Using queue function:`, {
          style,
          hasAddToQueueFn: !!addToQueueFn,
          hasAddToQueueWithProcessing: !!addToQueueWithProcessing,
          usingAddToQueue: queueFn === addToQueue,
          queueFnName: queueFn.name || 'anonymous'
        });
        const queueResult = queueFn(intermediateImage, prompt, MAX_QUEUE_SIZE);
        const jobId = queueResult.jobId;
        console.log(`[generatePortraitsForOrder] Added job to queue for ${style}, jobId: ${jobId}`);
        
        const maxWaitTime = 300000;
        const startTime = Date.now();
        const pollInterval = 2000;
        
        while (Date.now() - startTime < maxWaitTime) {
          const status = getJobStatus(jobId);
          
          if (status && status.status === 'completed' && status.result) {
            const publicUrl = await saveImageForOrder(style, status.result.imageDataUrl, invId);
            order.generatedImages[style] = publicUrl;
            saveOrder(order);
            console.log(`[generatePortraitsForOrder] ✅ Successfully generated ${style} for order ${invId}`);
            return { style, success: true, url: status.result.imageDataUrl };
          }
          
          if (status && status.status === 'error') {
            console.error(`[generatePortraitsForOrder] ❌ Failed to generate ${style} for order ${invId}:`, status.error);
            return { style, success: false, error: status.error };
          }
          
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        console.error(`[generatePortraitsForOrder] ⏱️ Timeout generating ${style} for order ${invId}`);
        return { style, success: false, error: 'Таймаут генерации' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[generatePortraitsForOrder] ❌ Error generating ${style} for order ${invId}:`, errorMessage);
        return { style, success: false, error: errorMessage };
      }
    });
    
    const results = await Promise.all(generationPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`[generatePortraitsForOrder] Results: ${successful.length} successful, ${failed.length} failed`);
    
    // ШАГ 4: Retry для неудачных портретов
    if (successful.length > 0 && failed.length > 0) {
      console.log(`[generatePortraitsForOrder] Retrying ${failed.length} failed portraits`);
      
      const MAX_SOURCES_PER_FAILED_STYLE = 3;
      
      const retryPromises = failed.map(async (failedResult) => {
        const style = failedResult.style;
        const prompt = prompts[style];
        let sourcesTried = 0;
        let sourceIndex = 0;
        
        while (
          sourcesTried < MAX_SOURCES_PER_FAILED_STYLE &&
          sourceIndex < successful.length
        ) {
          const source = successful[sourceIndex];
          console.log(`[generatePortraitsForOrder] Retrying ${style} using source: ${source.style} (attempt ${sourcesTried + 1})`);
          
          try {
            // Используем функцию с обработкой очереди, если передана или установлена через setAddToQueueFunction
            const queueFn = addToQueueFn || addToQueueWithProcessing || addToQueue;
            const queueResult = queueFn(source.url, prompt, MAX_QUEUE_SIZE);
            const jobId = queueResult.jobId;
            
            const maxWaitTime = 300000;
            const startTime = Date.now();
            const pollInterval = 2000;
            
            while (Date.now() - startTime < maxWaitTime) {
              const status = getJobStatus(jobId);
              
              if (status && status.status === 'completed' && status.result) {
                const publicUrl = await saveImageForOrder(style, status.result.imageDataUrl, invId);
                order.generatedImages[style] = publicUrl;
                saveOrder(order);
                console.log(`[generatePortraitsForOrder] ✅ Retry successful for ${style} using ${source.style}`);
                return { style, success: true, url: status.result.imageDataUrl };
              }
              
              if (status && status.status === 'error') {
                console.error(`[generatePortraitsForOrder] ❌ Retry failed for ${style} using ${source.style}`);
                break;
              }
              
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          } catch (err) {
            console.error(`[generatePortraitsForOrder] Error in retry for ${style}:`, err);
          }
          
          sourcesTried += 1;
          sourceIndex += 1;
        }
        
        return { style, success: false };
      });
      
      const retryResults = await Promise.all(retryPromises);
      retryResults.forEach(result => {
        if (result.success) {
          const index = failed.findIndex(f => f.style === result.style);
          if (index >= 0) {
            failed.splice(index, 1);
            successful.push(result);
          }
        }
      });
    }
    
    console.log(`[generatePortraitsForOrder] Final results: ${successful.length} successful, ${failed.length} failed`);
    
    // Обновляем статус заказа
    if (successful.length === 6) {
      order.status = 'completed';
      console.log(`[generatePortraitsForOrder] ✅ Order ${invId} completed successfully with all 6 portraits`);
    } else if (successful.length > 0) {
      order.status = 'completed';
      order.failureReason = `Сгенерировано ${successful.length} из 6 портретов`;
      console.log(`[generatePortraitsForOrder] ⚠️ Order ${invId} partially completed: ${successful.length}/6`);
    } else {
      order.status = 'failed';
      order.failureReason = 'Не удалось сгенерировать ни одного портрета';
      console.error(`[generatePortraitsForOrder] ❌ Order ${invId} failed: no portraits generated`);
    }
    
    saveOrder(order);
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[generatePortraitsForOrder] Fatal error for order ${invId}:`, errorMessage);
    order.status = 'failed';
    order.failureReason = errorMessage;
    saveOrder(order);
  }
}

