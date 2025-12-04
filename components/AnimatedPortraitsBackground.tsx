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
  const rowHeight = portraitSize + 32; // Высота ряда (портрет + padding)
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
    const loadPortraits = async () => {
      try {
        console.log('[AnimatedPortraitsBackground] Loading portraits from /api/gallery/recent');
        // Уменьшаем лимит для более быстрой загрузки (нужно только 6 портретов для базового набора)
        // Используем requestIdleCallback для неблокирующей загрузки
        const loadData = async () => {
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

        // Создаем ряды портретов
        const newRows: PortraitRow[] = [];
        const element = containerRef.current as HTMLElement | null;
        const containerWidth = element?.clientWidth || 1200;
        const currentHeight = element?.clientHeight || containerHeight;
        
        // Вычисляем количество рядов, которые поместятся в контейнер
        // Ряды должны заполнять всю высоту без перекрытий и без отступов
        const numRows = Math.max(2, Math.ceil(currentHeight / rowHeight));
        
        // Для бесконечного эффекта нужно достаточно портретов, чтобы заполнить экран + большой запас
        // Рассчитываем минимальное количество портретов для одного прохода экрана
        // Нужно 5-6 портретов для заполнения всей ширины секции
        const portraitsForOneScreen = Math.ceil((containerWidth + 400) / (portraitSize + portraitGap));
        // Умножаем на 8-10 для полностью бесконечного движения без пробелов
        const portraitsPerRow = Math.max(30, portraitsForOneScreen * 10);
        
        console.log('[AnimatedPortraitsBackground] Container dimensions:', { width: containerWidth, height: currentHeight });
        console.log('[AnimatedPortraitsBackground] Calculated rows:', numRows, 'portraits per row:', portraitsPerRow);
        
        // Распределяем портреты по рядам
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
          const direction = rowIndex % 2 === 0 ? 'left' : 'right'; // Четные ряды - влево, нечетные - вправо
          
          // Распределяем ряды по высоте контейнера БЕЗ перекрытий
          // Портерты начинаются с самого верха секции (без белой области)
          // Первый ряд (rowIndex=0) начинается с самого верха: y=0 для верхнего края портрета
          // Используем portraitSize/2 для центрирования через translateY(-50%)
          // Вычитаем 100px чтобы подтянуть все ряды выше
          // Второй ряд должен начинаться сразу после первого без отступа
          const yPosition = rowIndex === 0 
            ? portraitSize / 2 - 100  // Первый ряд начинается выше на 100px
            : (rowIndex * rowHeight) + (rowHeight / 2) - 100; // Остальные ряды идут друг за другом, все выше на 100px
          
          // Исправляем отступ между первым и вторым рядом
          // Второй ряд должен начинаться сразу после первого (без gap)
          if (rowIndex === 1) {
            const firstRowY = portraitSize / 2 - 100;
            const firstRowBottom = firstRowY + (rowHeight / 2); // Нижний край первого ряда
            yPosition = firstRowBottom + (rowHeight / 2); // Центр второго ряда сразу после первого
          }
          
          console.log(`[AnimatedPortraitsBackground] Row ${rowIndex}: yPosition=${yPosition}px, height=${currentHeight}, direction=${direction}`);
          
          // Создаем зацикленный набор портретов для этого ряда
          // Берем первые 5-6 портретов и повторяем их для бесконечного эффекта
          const basePortraitsCount = Math.min(6, urls.length);
          const basePortraits = urls.slice(0, basePortraitsCount);
          
          // Если портретов недостаточно, используем все доступные
          const portraitsToUse = basePortraits.length > 0 ? basePortraits : urls;
          
          const rowPortraits: Portrait[] = [];
          for (let i = 0; i < portraitsPerRow; i++) {
            const urlIndex = i % portraitsToUse.length;
            rowPortraits.push({
              id: `portrait-${rowIndex}-${i}-${Date.now()}`,
              url: portraitsToUse[urlIndex],
              size: portraitSize,
            });
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

    loadPortraits();
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
        
        // Для бесконечного бесшовного движения:
        // Рассчитываем ширину одного "блока" портретов (сколько нужно для заполнения экрана + запас)
        // Это должно быть кратно количеству портретов в базовом наборе для бесшовного повтора
        const portraitsPerCycle = Math.ceil(containerWidth / singlePortraitWidth) + 4; // +4 для запаса
        const cycleWidth = portraitsPerCycle * singlePortraitWidth;
        
        // Ряды должны сразу отображаться в контейнере (не начинаться за пределами экрана)
        // Портерты должны быть видны сразу при загрузке страницы для ВСЕХ рядов
        // Для движения влево: начинаем так, чтобы портреты заполняли экран и были видны сразу
        // Для движения вправо: начинаем так, чтобы портреты заполняли экран и были видны сразу
        // Все ряды должны начинаться в видимой области экрана
        const startX = row.direction === 'left' 
          ? containerWidth - cycleWidth + rowPadding // Начинаем так, чтобы портреты были видны справа налево
          : -cycleWidth + containerWidth + rowPadding; // Начинаем так, чтобы портреты были видны слева направо
        
        const endX = row.direction === 'left' 
          ? containerWidth - cycleWidth * 2 + rowPadding // Заканчиваем так, чтобы следующий цикл начинался справа
          : containerWidth + rowPadding; // Заканчиваем справа, чтобы следующий цикл начинался слева

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
              padding: '16px',
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
