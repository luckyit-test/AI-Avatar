import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPortraitsBackgroundProps {
  className?: string;
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
  y: number; // позиция Y в процентах (0-100)
  duration: number; // секунды
}

const AnimatedPortraitsBackground: React.FC<AnimatedPortraitsBackgroundProps> = ({ className = '' }) => {
  const [rows, setRows] = useState<PortraitRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(800); // Высота контейнера
  const portraitSize = 200; // Размер каждого портрета
  const portraitGap = 12; // Отступ между портретами
  const rowHeight = portraitSize + 32; // Высота ряда (портрет + padding)
  const rowGap = 40; // Отступ между рядами

  useEffect(() => {
    // Обновляем размер контейнера при изменении размера окна
    const updateContainerSize = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);
        // Триггерим обновление рядов при изменении размера
        setRows(prev => [...prev]);
      }
    };

    // Устанавливаем начальную высоту
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
    }

    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  useEffect(() => {
    // Загружаем портреты с сервера
    const loadPortraits = async () => {
      try {
        console.log('[AnimatedPortraitsBackground] Loading portraits from /api/gallery/recent');
        const response = await fetch('/api/gallery/recent?limit=50');
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
        const containerWidth = containerRef.current?.clientWidth || 1200;
        const currentHeight = containerRef.current?.clientHeight || containerHeight;
        
        // Вычисляем количество рядов, которые поместятся в контейнер
        // Учитываем отступы сверху и снизу (по 50px)
        const availableHeight = currentHeight - 100;
        const numRows = Math.max(2, Math.floor(availableHeight / (rowHeight + rowGap)));
        const portraitsPerRow = Math.max(6, Math.floor(containerWidth / (portraitSize + portraitGap)) + 2); // +2 для плавного движения
        
        console.log('[AnimatedPortraitsBackground] Container dimensions:', { width: containerWidth, height: currentHeight });
        console.log('[AnimatedPortraitsBackground] Calculated rows:', numRows, 'portraits per row:', portraitsPerRow);
        
        // Распределяем портреты по рядам
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
          const direction = rowIndex % 2 === 0 ? 'left' : 'right'; // Четные ряды - влево, нечетные - вправо
          
          // Распределяем портреты по высоте контейнера равномерно
          // Учитываем высоту ряда и отступы
          const yPosition = 50 + (rowIndex * (rowHeight + rowGap)) + (rowHeight / 2);
          const yPercent = (yPosition / currentHeight) * 100;
          
          // Берем портреты для этого ряда
          const rowPortraits: Portrait[] = [];
          for (let i = 0; i < portraitsPerRow; i++) {
            const urlIndex = rowIndex * portraitsPerRow + i;
            if (urlIndex < urls.length) {
              rowPortraits.push({
                id: `portrait-${rowIndex}-${i}-${Date.now()}`,
                url: urls[urlIndex],
                size: portraitSize,
              });
            } else {
              // Если портретов не хватает, используем циклически
              const cyclicIndex = urlIndex % urls.length;
              rowPortraits.push({
                id: `portrait-${rowIndex}-${i}-${Date.now()}`,
                url: urls[cyclicIndex],
                size: portraitSize,
              });
            }
          }
          
          newRows.push({
            id: `row-${rowIndex}-${Date.now()}`,
            portraits: rowPortraits,
            row: rowIndex,
            direction,
            y: yPercent,
            duration: 40 + Math.random() * 10, // 40-50 секунд для плавного движения
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
  }, []);


  // Показываем компонент даже если портреты еще загружаются или их нет
  // (для отладки видно, что компонент рендерится)
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
        style={{ zIndex: 0 }}
      >
        {/* Показываем индикатор загрузки для отладки */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-2 left-2 text-xs text-gray-400 opacity-50">
            Загрузка портретов...
          </div>
        )}
      </div>
    );
  }

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
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    >
      {rows.map((row) => {
        const containerWidth = containerRef.current?.clientWidth || 1200;
        const rowWidth = row.portraits.length * portraitSize + (row.portraits.length - 1) * portraitGap;
        
        // Для движения влево: начинаем справа, заканчиваем слева
        // Для движения вправо: начинаем слева, заканчиваем справа
        const startX = row.direction === 'left' 
          ? containerWidth + 100 // Начинаем справа за пределами экрана
          : -rowWidth - 100; // Начинаем слева за пределами экрана
        
        const endX = row.direction === 'left' 
          ? -rowWidth - 100 // Заканчиваем слева за пределами экрана
          : containerWidth + 100; // Заканчиваем справа за пределами экрана

        return (
          <motion.div
            key={row.id}
            className="absolute"
            initial={{
              x: startX,
              y: `${row.y}%`,
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
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              alignItems: 'center',
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
