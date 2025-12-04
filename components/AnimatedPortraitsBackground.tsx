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
  const numRows = 2; // Количество рядов портретов
  const portraitsPerRow = 8; // Портретов в каждом ряду
  const portraitSize = 200; // Размер каждого портрета
  const portraitGap = 12; // Отступ между портретами

  useEffect(() => {
    // Обновляем размер контейнера при изменении размера окна
    const updateContainerSize = () => {
      if (containerRef.current) {
        // Триггерим обновление портретов при изменении размера
        setPortraits(prev => [...prev]);
      }
    };

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

        // Создаем портреты с распределением по рядам
        const newPortraits: Portrait[] = [];
        const containerWidth = containerRef.current?.clientWidth || 800; // примерная ширина
        
        urls.forEach((url, index) => {
          const row = index % numRows; // Распределяем по рядам циклически
          const direction = row % 2 === 0 ? 'left' : 'right'; // Четные ряды - влево, нечетные - вправо
          
          // Распределяем портреты по высоте контейнера
          const yPercent = (row / numRows) * 80 + 10 + (Math.random() * 5); // 10-90% с небольшим разбросом
          
          // Для движения влево: начинаем справа, заканчиваем слева
          // Для движения вправо: начинаем слева, заканчиваем справа
          const startX = direction === 'left' 
            ? containerWidth + 200 // Начинаем справа за пределами экрана
            : -200; // Начинаем слева за пределами экрана
          
          
          newPortraits.push({
            id: `portrait-${index}-${Date.now()}-${Math.random()}`,
            url,
            row,
            direction,
            startX,
            duration: 30 + Math.random() * 15, // 30-45 секунд (более медленная, плавная анимация)
            delay: (index % portraitsPerRow) * 0.8 + Math.random() * 3, // Задержка для создания волны
            size: 180 + Math.random() * 60, // 180-240px (ближе к размеру на сайте 221x295)
            y: yPercent,
          });
        });

        console.log('[AnimatedPortraitsBackground] Created portrait objects:', newPortraits.length);
        setPortraits(newPortraits);
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
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
