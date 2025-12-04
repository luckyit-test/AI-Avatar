import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPortraitsBackgroundProps {
  className?: string;
}

interface Portrait {
  id: string;
  url: string;
  row: number; // номер ряда (0, 1, 2, ...)
  direction: 'left' | 'right'; // направление движения
  startX: number; // начальная позиция X в пикселях
  duration: number; // секунды
  delay: number; // секунды
  size: number; // пиксели
  y: number; // позиция Y в процентах (0-100)
}

const AnimatedPortraitsBackground: React.FC<AnimatedPortraitsBackgroundProps> = ({ className = '' }) => {
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [activePortraitIds, setActivePortraitIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextPortraitIndexRef = useRef(0);
  const numRows = 4; // Количество рядов портретов
  const portraitsPerRow = 6; // Портретов в каждом ряду
  const maxActivePortraits = numRows * portraitsPerRow; // Максимум одновременно видимых портретов

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
            duration: 25 + Math.random() * 10, // 25-35 секунд
            delay: (index % portraitsPerRow) * 0.5 + Math.random() * 2, // Задержка для создания волны
            size: 140 + Math.random() * 40, // 140-180px
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

  // Управление активными портретами
  useEffect(() => {
    if (portraits.length === 0) return;

    const addNextPortrait = () => {
      setActivePortraitIds((prev) => {
        if (prev.size >= maxActivePortraits) return prev;

        // Находим следующий портрет из очереди
        const nextIndex = nextPortraitIndexRef.current;
        if (nextIndex >= portraits.length) {
          // Если все портреты использованы, начинаем заново
          nextPortraitIndexRef.current = 0;
          return prev;
        }

        const portrait = portraits[nextIndex];
        nextPortraitIndexRef.current = nextIndex + 1;

        const newSet = new Set(prev);
        newSet.add(portrait.id);
        return newSet;
      });
    };

    // Добавляем портреты по рядам с задержками
    const timeouts: NodeJS.Timeout[] = [];
    const portraitsToAdd = Math.min(maxActivePortraits, portraits.length);
    
    // Распределяем портреты по рядам
    for (let row = 0; row < numRows; row++) {
      const rowPortraits = portraits.filter(p => p.row === row).slice(0, portraitsPerRow);
      
      rowPortraits.forEach((portrait, indexInRow) => {
        const timeout = setTimeout(() => {
          setActivePortraitIds((prev) => {
            const newSet = new Set(prev);
            newSet.add(portrait.id);
            return newSet;
          });
          nextPortraitIndexRef.current = Math.max(nextPortraitIndexRef.current, 
            portraits.findIndex(p => p.id === portrait.id) + 1);
        }, row * 1000 + indexInRow * 300 + portrait.delay * 1000);
        timeouts.push(timeout);
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [portraits]);

  const handleAnimationComplete = (portraitId: string) => {
    // Находим завершившийся портрет
    const completedPortrait = portraits.find(p => p.id === portraitId);
    if (!completedPortrait) return;
    
    // Удаляем портрет после завершения анимации
    setActivePortraitIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(portraitId);
      return newSet;
    });
    
    // Добавляем следующий портрет из того же ряда
    setTimeout(() => {
      setActivePortraitIds((prev) => {
        // Считаем портреты в этом ряду
        const rowPortraits = portraits.filter(p => p.row === completedPortrait.row);
        const activeInRow = rowPortraits.filter(p => prev.has(p.id)).length;
        
        if (activeInRow >= portraitsPerRow) return prev;

        // Находим следующий портрет из того же ряда, который еще не активен
        const currentIndex = portraits.findIndex(p => p.id === portraitId);
        let nextIndex = currentIndex + 1;
        
        // Ищем следующий портрет из того же ряда
        while (nextIndex < portraits.length) {
          const candidate = portraits[nextIndex];
          if (candidate.row === completedPortrait.row && !prev.has(candidate.id)) {
            const newSet = new Set(prev);
            newSet.add(candidate.id);
            return newSet;
          }
          nextIndex++;
        }
        
        // Если не нашли в конце, ищем с начала
        nextIndex = 0;
        while (nextIndex < currentIndex) {
          const candidate = portraits[nextIndex];
          if (candidate.row === completedPortrait.row && !prev.has(candidate.id)) {
            const newSet = new Set(prev);
            newSet.add(candidate.id);
            return newSet;
          }
          nextIndex++;
        }
        
        return prev;
      });
    }, 200);
  };

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

  if (portraits.length === 0) {
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
      {portraits.map((portrait) => {
        if (!activePortraitIds.has(portrait.id)) return null;

        // Определяем конечную позицию X в зависимости от направления
        const containerWidth = containerRef.current?.clientWidth || 800;
        const endX = portrait.direction === 'left' 
          ? -portrait.size - 200 // Заканчиваем слева за пределами экрана
          : containerWidth + 200; // Заканчиваем справа за пределами экрана

        return (
          <motion.div
            key={portrait.id}
            className="absolute"
            initial={{
              x: portrait.startX,
              y: `${portrait.y}%`,
              opacity: 0,
            }}
            animate={{
              x: endX,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: portrait.duration,
              delay: portrait.delay,
              ease: 'linear',
              opacity: {
                times: [0, 0.05, 0.95, 1],
                duration: portrait.duration,
              },
            }}
            onAnimationComplete={() => handleAnimationComplete(portrait.id)}
            style={{
              width: `${portrait.size}px`,
              height: `${portrait.size}px`,
              willChange: 'transform, opacity',
              transform: `translateY(-50%)`, // Центрируем по вертикали
            }}
          >
            <img
              src={portrait.url}
              alt="Business portrait"
              className="w-full h-full object-cover rounded-lg shadow-lg"
              style={{
                filter: 'brightness(0.95) contrast(1.05)',
                opacity: 0.85,
              }}
              loading="lazy"
              onError={(e) => {
                console.error('[AnimatedPortraitsBackground] Failed to load image:', portrait.url);
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

export default AnimatedPortraitsBackground;
