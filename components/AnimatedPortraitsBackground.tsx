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
}

interface PortraitRow {
  id: string;
  portraits: Portrait[];
  row: number; // номер ряда (0, 1, 2, ...)
  direction: 'left' | 'right'; // направление движения
  y: number; // позиция Y в пикселях (абсолютная)
  duration: number; // секунды
}

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
        // Уменьшаем лимит для более быстрой загрузки (нужно только 6 портретов для базового набора)
        const response = await fetch('/api/gallery/recent?limit=10');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const urls: string[] = data.portraits || [];

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
        // Ряды должны заполнять всю высоту без перекрытий и без отступов
        const numRows = Math.max(2, Math.ceil(currentHeight / rowHeight));
        
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
          const setsNeeded = Math.ceil((containerWidth * 3) / singleSetWidth) + 4; // 3 экрана ширины + запас
          
          const rowPortraits: Portrait[] = [];
          // Создаем несколько наборов портретов для бесконечного движения
          for (let setIndex = 0; setIndex < setsNeeded; setIndex++) {
            for (let i = 0; i < rowPortraitsSet.length; i++) {
              rowPortraits.push({
                id: `portrait-${rowIndex}-${setIndex}-${i}-${Date.now()}`,
                url: rowPortraitsSet[i],
                size: portraitSize,
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
        
        // Ряды должны сразу отображаться в контейнере и заполнять весь экран
        // Для бесшовного движения: когда один набор портретов уходит за экран,
        // следующий набор уже должен быть виден. Двигаемся на ширину одного набора.
        // Для движения влево: начинаем так, чтобы портреты заполняли экран справа налево
        // Для движения вправо: начинаем так, чтобы портреты заполняли экран слева направо
        const startX = row.direction === 'left' 
          ? containerWidth - singleSetWidth + rowPadding // Начинаем так, чтобы портреты были видны справа налево
          : -singleSetWidth + containerWidth + rowPadding; // Начинаем так, чтобы портреты были видны слева направо
        
        const endX = row.direction === 'left' 
          ? containerWidth - singleSetWidth * 2 + rowPadding // Заканчиваем так, чтобы следующий набор начинался справа
          : containerWidth + rowPadding; // Заканчиваем справа, чтобы следующий набор начинался слева

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
              <div
                key={portrait.id}
                style={{
                  width: `${portrait.size}px`,
                  height: `${portrait.size}px`,
                  flexShrink: 0,
                }}
              >
                <img
                  src={portrait.url}
                  alt="Business portrait"
                  className="w-full h-full object-cover"
                  style={{
                    borderRadius: '12px',
                    filter: 'brightness(0.98) contrast(1.08) saturate(1.1)',
                  }}
                  loading="lazy"
                  onError={(e) => {
                    console.error('[AnimatedPortraitsBackground] Failed to load image:', portrait.url);
                  }}
                />
              </div>
            ))}
          </motion.div>
        );
      })}
    </div>
  );
};

export default AnimatedPortraitsBackground;
