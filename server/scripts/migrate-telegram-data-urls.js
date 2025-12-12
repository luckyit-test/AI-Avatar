/**
 * Миграция: Конвертация data URL в файлы для заказов Telegram бота
 * 
 * Этот скрипт находит все заказы с data URL в generatedImagesJson
 * и сохраняет их в файлы, обновляя generatedImagesJson с путями к файлам
 */

import { db } from '../db/index.js';
import { saveImageForOrder } from '../services/portraitGeneration.js';
import { loadOrder, saveOrder } from '../db/orders.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IMAGE_ROOT_DIR } from '../config/index.js';

export async function migrateTelegramDataUrls() {
  console.log('🔄 Начинаем миграцию data URL в файлы...');
  
  try {
    // БД уже инициализирована при импорте модуля
    
    // Находим все заказы с generatedImagesJson
    const stmt = db.prepare(`
      SELECT invId, generatedImagesJson, status, imagesCount
      FROM orders
      WHERE generatedImagesJson IS NOT NULL
        AND generatedImagesJson != 'null'
        AND generatedImagesJson != ''
    `);
    
    const orders = stmt.all();
    console.log(`📊 Найдено заказов: ${orders.length}`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const orderRow of orders) {
      try {
        const invId = orderRow.invId;
        const generatedImagesJson = orderRow.generatedImagesJson;
        
        // Парсим JSON
        let images;
        try {
          images = JSON.parse(generatedImagesJson);
        } catch (e) {
          console.warn(`⚠️  Заказ ${invId}: не удалось распарсить JSON`, e.message);
          skippedCount++;
          continue;
        }
        
        if (!images || typeof images !== 'object') {
          console.log(`⏭️  Заказ ${invId}: images не является объектом, пропускаем`);
          skippedCount++;
          continue;
        }
        
        // Проверяем, есть ли data URL
        let hasDataUrl = false;
        const imageEntries = Object.entries(images);
        
        for (const [style, url] of imageEntries) {
          if (typeof url === 'string' && url.startsWith('data:image/')) {
            hasDataUrl = true;
            break;
          }
        }
        
        if (!hasDataUrl) {
          // Все URL уже являются путями к файлам
          skippedCount++;
          continue;
        }
        
        console.log(`🔄 Обрабатываем заказ ${invId}...`);
        
        // Загружаем полный заказ
        const order = loadOrder(invId);
        if (!order) {
          console.warn(`⚠️  Заказ ${invId} не найден через loadOrder`);
          errorCount++;
          continue;
        }
        
        // Конвертируем data URL в файлы
        const updatedImages = {};
        let hasChanges = false;
        
        for (const [style, url] of imageEntries) {
          if (typeof url === 'string' && url.startsWith('data:image/')) {
            // Это data URL, нужно сохранить в файл
            console.log(`  💾 Сохраняем ${style} для заказа ${invId}...`);
            
            try {
              const publicUrl = await saveImageForOrder(style, url, invId);
              updatedImages[style] = publicUrl;
              hasChanges = true;
              console.log(`  ✅ Сохранено: ${publicUrl}`);
            } catch (saveError) {
              console.error(`  ❌ Ошибка сохранения ${style} для заказа ${invId}:`, saveError);
              // Оставляем оригинальный URL в случае ошибки
              updatedImages[style] = url;
              errorCount++;
            }
          } else {
            // Это уже путь к файлу, оставляем как есть
            updatedImages[style] = url;
          }
        }
        
        if (hasChanges) {
          // Обновляем заказ
          order.generatedImages = updatedImages;
          order.imagesCount = Object.keys(updatedImages).length;
          saveOrder(order);
          
          migratedCount++;
          console.log(`✅ Заказ ${invId} мигрирован успешно`);
        } else {
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Ошибка при обработке заказа ${orderRow.invId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 Результаты миграции:');
    console.log(`  ✅ Мигрировано: ${migratedCount}`);
    console.log(`  ⏭️  Пропущено: ${skippedCount}`);
    console.log(`  ❌ Ошибок: ${errorCount}`);
    console.log(`  📦 Всего обработано: ${orders.length}`);
    
    if (migratedCount > 0) {
      console.log('\n✨ Миграция завершена успешно!');
    } else {
      console.log('\nℹ️  Нет заказов для миграции.');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    throw error; // Пробрасываем ошибку для обработки вызывающим кодом
  }
}

// Запускаем миграцию только если скрипт запущен напрямую (не импортирован)
// Проверяем, запущен ли скрипт напрямую через node
const isMainModule = process.argv[1] && process.argv[1].includes('migrate-telegram-data-urls');

if (isMainModule) {
  migrateTelegramDataUrls()
    .then(() => {
      console.log('\n🏁 Миграция завершена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Фатальная ошибка:', error);
      process.exit(1);
    });
}

