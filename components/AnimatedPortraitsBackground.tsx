import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedPortraitsBackgroundProps {
  className?: string;
}

interface Portrait {
  id: string;
  url: string;
  startX: number; // 0-100 (процент от ширины контейнера)
  duration: number; // секунды
  delay: number; // секунды
  size: number; // пиксели
}

const AnimatedPortraitsBackground: React.FC<AnimatedPortraitsBackgroundProps> = ({ className = '' }) => {
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [activePortraitIds, setActivePortraitIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextPortraitIndexRef = useRef(0);
  const maxActivePortraits = 12; // Максимум одновременно видимых портретов

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

        // Создаем портреты с разными параметрами анимации
        const newPortraits: Portrait[] = urls.map((url, index) => ({
          id: `portrait-${index}-${Date.now()}-${Math.random()}`,
          url,
          startX: Math.random() * 80 + 10, // 10-90% от ширины
          duration: 20 + Math.random() * 10, // 20-30 секунд
          delay: Math.random() * 5, // 0-5 секунд задержки
          size: 120 + Math.random() * 60, // 120-180px
        }));

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

    // Добавляем первые портреты с задержками
    const timeouts: NodeJS.Timeout[] = [];
    const initialCount = Math.min(maxActivePortraits, portraits.length);
    
    for (let i = 0; i < initialCount; i++) {
      const portrait = portraits[i];
      const timeout = setTimeout(() => {
        setActivePortraitIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(portrait.id);
          return newSet;
        });
        nextPortraitIndexRef.current = i + 1;
      }, i * 500 + portrait.delay * 1000);
      timeouts.push(timeout);
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [portraits]);

  const handleAnimationComplete = (portraitId: string) => {
    // Удаляем портрет после завершения анимации
    setActivePortraitIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(portraitId);
      return newSet;
    });
    
    // Добавляем следующий портрет из очереди
    setTimeout(() => {
      setActivePortraitIds((prev) => {
        if (prev.size >= maxActivePortraits) return prev;

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
    }, 100);
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

        return (
          <motion.div
            key={portrait.id}
            className="absolute"
            initial={{
              x: `${portrait.startX}%`,
              y: '100%',
              opacity: 0,
            }}
            animate={{
              y: '-100%',
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: portrait.duration,
              delay: portrait.delay,
              ease: 'linear',
              opacity: {
                times: [0, 0.1, 0.9, 1],
                duration: portrait.duration,
              },
            }}
            onAnimationComplete={() => handleAnimationComplete(portrait.id)}
            style={{
              width: `${portrait.size}px`,
              height: `${portrait.size}px`,
              willChange: 'transform, opacity',
            }}
          >
            <img
              src={portrait.url}
              alt="Business portrait"
              className="w-full h-full object-cover rounded-lg shadow-lg"
              style={{
                filter: 'brightness(0.95) contrast(1.05)',
              }}
              loading="lazy"
            />
          </motion.div>
        );
      })}
    </div>
  );
};

export default AnimatedPortraitsBackground;
