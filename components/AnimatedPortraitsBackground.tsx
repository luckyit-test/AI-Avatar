import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPortraitsBackgroundProps {
  className?: string;
  containerRef?: React.RefObject<HTMLElement>; // Опциональный ref родительского контейнера
}

interface Portrait {
  id: string;
  url: string;
  size: number; // пиксели
  loaded?: boolean; // Флаг загрузки для Intersection Observer
}

interface PortraitRow {
  id: string;
  portraits: Portrait[];
  row: number; // номер ряда (0, 1, 2, ...)
  direction: 'left' | 'right'; // направление движения
  y: number; // позиция Y в пикселях (абсолютная)
  duration: number; // секунды
}

// Функция для получения оптимизированного URL изображения
const getOptimizedImageUrl = (originalUrl: string, size: 'small' | 'medium' = 'medium', format: 'webp' | 'jpeg' = 'webp'): string => {
  if (!originalUrl || !originalUrl.startsWith('/images/')) {
    return originalUrl;
  }
  
  // Определяем размер в зависимости от ширины экрана
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const imageSize = isMobile ? 'small' : size;
  
  // Формируем URL для оптимизированного изображения
  const params = new URLSearchParams({
    url: originalUrl,
    size: imageSize,
    format: format,
  });
  
  return `/api/images/optimized?${params.toString()}`;
};

// Компонент для одного портрета с Intersection Observer и WebP fallback
const OptimizedPortrait: React.FC<{ portrait: Portrait; size: number }> = ({ portrait, size }) => {
  const [isInView, setIsInView] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  
  // Определяем размер в зависимости от ширины экрана
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const imageSize = isMobile ? 'small' : 'medium';
  
  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Отключаем наблюдение после загрузки
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Начинаем загрузку за 50px до появления в viewport
        threshold: 0.01,
      }
    );
    
    observer.observe(imgRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Генерируем URL для WebP и fallback на JPEG
  const webpUrl = isInView ? getOptimizedImageUrl(portrait.url, imageSize, 'webp') : '';
  const jpegUrl = isInView ? getOptimizedImageUrl(portrait.url, imageSize, 'jpeg') : '';
  
  return (
    <div
      ref={imgRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
      }}
    >
      {isInView && (
        <picture>
          {/* WebP с fallback на JPEG */}
          <source srcSet={webpUrl} type="image/webp" />
          <img
            src={jpegUrl || portrait.url}
            alt="Business portrait"
            className="w-full h-full object-cover"
            style={{
              borderRadius: '12px',
              filter: 'brightness(0.98) contrast(1.08) saturate(1.1)',
              opacity: 1,
            }}
            loading="lazy"
            onError={(e) => {
              if (!imageError) {
                setImageError(true);
                // Если WebP не загрузился, пробуем оригинальное изображение
                const img = e.currentTarget;
                if (img.src !== portrait.url) {
                  img.src = portrait.url;
                } else {
                  console.error('[AnimatedPortraitsBackground] Failed to load image:', portrait.url);
                }
              }
            }}
          />
        </picture>
      )}
    </div>
  );
};

const AnimatedPortraitsBackground: React.FC<AnimatedPortraitsBackgroundProps> = ({ className = '', containerRef: externalContainerRef }) => {
  const [rows, setRows] = useState<PortraitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [containerHeight, setContainerHeight] = useState(800); // Высота контейнера
  const portraitSize = 200; // Размер каждого портрета
  const portraitGap = 12; // Отступ между портретами
  const rowVerticalPadding = 8; // Вертикальный padding (сверху и снизу)
  const rowHeight = portraitSize + (rowVerticalPadding * 2); // Высота ряда (портрет + padding сверху и снизу)
  const rowGap = 0; // Без отступов между рядами

  useEffect(() => {
    // Обновляем размер контейнера при изменении размера окна
    const updateContainerSize = () => {
      const element = containerRef.current as HTMLElement | null;
      if (element) {
        const height = element.clientHeight;
        setContainerHeight(height);
        // Триггерим обновление рядов при изменении размера
        setRows(prev => [...prev]);
      }
    };

    // Устанавливаем начальную высоту
    const element = containerRef.current as HTMLElement | null;
    if (element) {
      setContainerHeight(element.clientHeight);
    }

    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, [containerRef]);

  useEffect(() => {
    // Загружаем портреты с сервера
    // Используем отложенную загрузку для ускорения загрузки страницы
    const loadData = async () => {
      try {
        console.log('[AnimatedPortraitsBackground] Loading portraits from /api/gallery/recent');
        // Увеличиваем лимит для большего разнообразия (нужно 12 портретов на ряд * количество рядов)
        const response = await fetch('/api/gallery/recent?limit=50').catch((fetchError) => {
          console.error('[AnimatedPortraitsBackground] Fetch error:', fetchError);
          throw fetchError;
        });
        
        if (!response || !response.ok) {
          throw new Error(`HTTP ${response?.status || 'unknown'}`);
        }
        
        const data = await response.json().catch((parseError) => {
          console.error('[AnimatedPortraitsBackground] JSON parse error:', parseError);
          throw parseError;
        });
        
        const urls: string[] = Array.isArray(data?.portraits) ? data.portraits : [];

        console.log('[AnimatedPortraitsBackground] Loaded portraits:', urls.length);

        if (urls.length === 0) {
          console.warn('[AnimatedPortraitsBackground] No portraits found in database');
          setIsLoading(false);
          return;
        }

        // Перемешиваем портреты для разнообразия при каждой загрузке страницы
        const shuffledUrls = [...urls];
        for (let i = shuffledUrls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledUrls[i], shuffledUrls[j]] = [shuffledUrls[j], shuffledUrls[i]];
        }

        // Создаем ряды портретов
        const newRows: PortraitRow[] = [];
        const element = containerRef.current as HTMLElement | null;
        const containerWidth = element?.clientWidth || 1200;
        const currentHeight = element?.clientHeight || containerHeight;
        
        // Вычисляем количество рядов, которые поместятся в контейнер
        // Ряды должны заполнять всю высоту без перекрытий и без свободного пространства
        // Добавляем дополнительный ряд для гарантированного заполнения без пробелов
        const numRows = Math.max(5, Math.ceil(currentHeight / rowHeight) + 1);
        
        // Увеличиваем ширину ряда на 6 портретов (было 6, стало 12 портретов в базовом наборе)
        const basePortraitsPerRow = 12; // Увеличенный набор портретов для каждого ряда
        
        console.log('[AnimatedPortraitsBackground] Container dimensions:', { width: containerWidth, height: currentHeight });
        console.log('[AnimatedPortraitsBackground] Calculated rows:', numRows, 'base portraits per row:', basePortraitsPerRow);
        
        // Распределяем портреты по рядам
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
          const direction = rowIndex % 2 === 0 ? 'left' : 'right'; // Четные ряды - влево, нечетные - вправо
          
          // Распределяем ряды по высоте контейнера БЕЗ перекрытий и БЕЗ свободного пространства
          // Портерты начинаются с самого верха секции (без белой области)
          // Первый ряд (rowIndex=0) начинается с самого верха: y=0 для верхнего края портрета
          // Используем portraitSize/2 для центрирования через translateY(-50%)
          // Вычитаем 100px чтобы подтянуть все ряды выше
          // Все ряды прижаты друг к другу БЕЗ свободного пространства между ними
          let yPosition;
          if (rowIndex === 0) {
            // Первый ряд: центр на portraitSize/2 от верха (с учетом смещения -100px)
            yPosition = portraitSize / 2 - 100;
          } else {
            // Для всех остальных рядов: центр = центр первого ряда + (индекс * высота ряда)
            // rowHeight уже включает padding, поэтому ряды будут прижаты друг к другу
            const firstRowCenter = portraitSize / 2 - 100;
            yPosition = firstRowCenter + (rowIndex * rowHeight);
          }
          
          // Каждый ряд получает уникальный набор портретов
          // Распределяем портреты циклически по рядам для разнообразия
          const rowStartIndex = (rowIndex * basePortraitsPerRow) % shuffledUrls.length;
          const rowPortraitsSet: string[] = [];
          
          // Собираем уникальный набор портретов для этого ряда
          for (let i = 0; i < basePortraitsPerRow; i++) {
            const urlIndex = (rowStartIndex + i) % shuffledUrls.length;
            rowPortraitsSet.push(shuffledUrls[urlIndex]);
          }
          
          console.log(`[AnimatedPortraitsBackground] Row ${rowIndex}: yPosition=${yPosition}px, height=${currentHeight}, direction=${direction}, portraits=${rowPortraitsSet.length}`);
          
          // Для бесшовного бесконечного движения создаем достаточно портретов
          // чтобы заполнить экран + большой запас для бесконечного движения
          // Рассчитываем ширину одного набора портретов
          const singleSetWidth = rowPortraitsSet.length * (portraitSize + portraitGap) - portraitGap; // Ширина одного набора без padding
          // Нужно достаточно наборов чтобы заполнить экран + запас для бесконечного движения
          // Увеличиваем количество наборов для гарантированного заполнения без пробелов
          const setsNeeded = Math.max(8, Math.ceil((containerWidth * 4) / singleSetWidth) + 6); // 4 экрана ширины + большой запас
          
          const rowPortraits: Portrait[] = [];
          // Создаем несколько наборов портретов для бесконечного движения
          // Важно: создаем достаточно портретов, чтобы при любом положении экран был заполнен
          for (let setIndex = 0; setIndex < setsNeeded; setIndex++) {
            for (let i = 0; i < rowPortraitsSet.length; i++) {
              rowPortraits.push({
                id: `portrait-${rowIndex}-${setIndex}-${i}-${Date.now()}`,
                url: rowPortraitsSet[i],
                size: portraitSize,
                loaded: false,
              });
            }
          }
          
          newRows.push({
            id: `row-${rowIndex}-${Date.now()}`,
            portraits: rowPortraits,
            row: rowIndex,
            direction,
            y: yPosition, // Используем абсолютную позицию в пикселях
            duration: 120 + Math.random() * 40, // 120-160 секунд (в 2 раза медленнее)
          });
        }

        console.log('[AnimatedPortraitsBackground] Created rows:', newRows.length);
        setRows(newRows);
        setIsLoading(false);
      } catch (error) {
        console.error('[AnimatedPortraitsBackground] Failed to load portraits:', error);
        setIsLoading(false);
      }
    };
    
    // Используем requestIdleCallback для неблокирующей загрузки после рендера страницы
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadData, { timeout: 2000 });
    } else {
      // Fallback для браузеров без requestIdleCallback
      setTimeout(loadData, 100);
    }
  }, [containerHeight]);


  // Показываем портреты сразу, даже если они еще загружаются
  // (показываем пустой контейнер, чтобы не было белого экрана)

  if (rows.length === 0) {
    // Если портретов нет, все равно рендерим контейнер для отладки
    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
        style={{ zIndex: 0 }}
      >
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-2 left-2 text-xs text-gray-400 opacity-50">
            Портреты не найдены
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={internalContainerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
    >
      {rows.map((row) => {
        const element = containerRef.current as HTMLElement | null;
        const containerWidth = element?.clientWidth || 1200;
        const singlePortraitWidth = portraitSize + portraitGap;
        const rowPadding = 32; // padding ряда
        
        // Для бесконечного бесшовного движения без резкого появления:
        // Базовый набор - это уникальные портреты в ряду (12 портретов)
        // Находим размер базового набора из структуры портретов
        const uniquePortraits = new Set(row.portraits.map(p => p.url));
        const baseSetSize = uniquePortraits.size || 12; // Теперь 12 портретов в базовом наборе
        const singleSetWidth = baseSetSize * singlePortraitWidth - portraitGap; // Ширина одного набора портретов (без последнего gap)
        
        // Рассчитываем общую ширину всех портретов в ряду
        const totalRowWidth = row.portraits.length * singlePortraitWidth - portraitGap + rowPadding * 2;
        
        // Для бесшовного бесконечного движения:
        // 1. Ряды должны сразу заполнять весь экран (без пустых областей)
        // 2. Анимация должна двигаться ровно на ширину одного набора (singleSetWidth)
        // 3. Когда анимация повторяется, она должна начинаться с той же позиции
        
        // Для бесшовного бесконечного движения:
        // Для движения влево: портреты движутся справа налево
        // Для движения вправо: портреты движутся слева направо
        // Начальная позиция должна быть такой, чтобы портреты сразу заполняли весь экран
        // и чтобы при зацикливании не было разрывов
        
        // Для движения влево: начинаем так, чтобы портреты сразу заполняли весь экран
        // Портреты должны начинаться справа и сразу быть видны по всей ширине
        // Для движения вправо: начинаем так, чтобы портреты сразу заполняли весь экран
        // Портреты должны начинаться слева и сразу быть видны по всей ширине
        const startX = row.direction === 'left' 
          ? containerWidth - singleSetWidth + rowPadding // Начинаем так, чтобы портреты сразу заполняли весь экран
          : -singleSetWidth + rowPadding; // Начинаем слева от контейнера, чтобы портреты сразу заполняли весь экран
        
        // Конечная позиция должна быть ровно на один набор дальше для бесшовного зацикливания
        // Когда анимация повторяется, она возвращается к startX, создавая бесконечный цикл
        const endX = row.direction === 'left' 
          ? startX - singleSetWidth // Двигаемся на один набор влево
          : startX + singleSetWidth; // Двигаемся на один набор вправо

        return (
          <motion.div
            key={row.id}
            className="absolute"
            initial={{
              x: startX,
              y: row.y,
              opacity: 1,
            }}
            animate={{
              x: endX,
            }}
            transition={{
              duration: row.duration,
              ease: 'linear',
              repeat: Infinity,
            }}
            style={{
              willChange: 'transform',
              transform: `translateY(-50%)`, // Центрируем по вертикали
              display: 'flex',
              gap: `${portraitGap}px`,
              padding: `${rowVerticalPadding}px 16px`, // Минимальный вертикальный padding для прижатия рядов друг к другу
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              alignItems: 'center',
              zIndex: 2,
            }}
          >
            {row.portraits.map((portrait) => (
              <OptimizedPortrait
                key={portrait.id}
                portrait={portrait}
                size={portrait.size}
              />
            ))}
          </motion.div>
        );
      })}
    </div>
  );
};

export default AnimatedPortraitsBackground;
