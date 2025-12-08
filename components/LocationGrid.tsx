import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';
import { NEW_YEAR_LOCATIONS, type NewYearLocationId, getLocationPreviewPath } from '../lib/newYearConstants';

interface LocationGridProps {
  selectedLocation: NewYearLocationId | null;
  onSelect: (locationId: NewYearLocationId) => void;
  className?: string;
}

// Группировка локаций по типам
const LOCATION_GROUPS = {
  home: ['living-room', 'winter-house', 'village-house', 'cottage', 'balcony-terrace', 'new-year-dacha'],
  outdoor: ['city-street', 'city-square', 'outdoor-rink', 'winter-forest', 'park', 'ski-resort'],
  luxury: ['luxury-hall', 'luxury-hotel', 'theater', 'library', 'eiffel-tower', 'new-year-ball'],
  unique: ['cafe-restaurant', 'photo-studio', 'greenhouse', 'workshop', 'santa-residence', 'metro-new-year'],
} as const;

const GROUP_LABELS = {
  home: 'Домашние локации',
  outdoor: 'Уличные локации',
  luxury: 'Роскошные локации',
  unique: 'Необычные локации',
} as const;

// Функция для получения цвета градиента для группы
const getGroupGradient = (group: keyof typeof LOCATION_GROUPS) => {
  const gradients = {
    home: 'from-blue-500 to-blue-600',
    outdoor: 'from-green-500 to-green-600',
    luxury: 'from-purple-500 to-purple-600',
    unique: 'from-orange-500 to-orange-600',
  };
  return gradients[group] || 'from-gray-500 to-gray-600';
};

export function LocationGrid({ selectedLocation, onSelect, className }: LocationGridProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white flex-shrink-0 mt-0.5"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 10px 20px rgba(16,185,129,0.35)',
          }}
        >
          3
        </span>
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-0.5">
            Выберите локацию
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Локация определит окружение для всех 6 фотографий
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {(Object.keys(LOCATION_GROUPS) as Array<keyof typeof LOCATION_GROUPS>).map((groupKey) => {
          const groupLocationIds = LOCATION_GROUPS[groupKey];
          const groupLocations = NEW_YEAR_LOCATIONS.filter(loc => 
            groupLocationIds.includes(loc.id as any)
          );

          return (
            <div key={groupKey}>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {GROUP_LABELS[groupKey]}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {groupLocations.map((location) => {
                  const isSelected = selectedLocation === location.id;
                  const previewPath = getLocationPreviewPath(location.id);
                  const [imageError, setImageError] = useState(false);
                  
                  return (
                    <motion.button
                      key={location.id}
                      type="button"
                      onClick={() => onSelect(location.id)}
                      className={cn(
                        'relative group rounded-lg overflow-hidden border-2 transition-all duration-200',
                        'hover:shadow-lg hover:scale-[1.02]',
                        isSelected
                          ? 'border-blue-500 shadow-md ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300'
                      )}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Превью изображение или градиент fallback */}
                      <div className={cn(
                        'w-full aspect-square relative overflow-hidden',
                        !previewPath || imageError ? `bg-gradient-to-br ${getGroupGradient(groupKey)}` : ''
                      )}>
                        {previewPath && !imageError ? (
                          <>
                            <img
                              src={previewPath}
                              alt={location.name}
                              className="w-full h-full object-cover"
                              onError={() => setImageError(true)}
                              loading="lazy"
                            />
                            {/* Overlay при наведении */}
                            <div className={cn(
                              'absolute inset-0 bg-black transition-opacity duration-200',
                              'opacity-0 group-hover:opacity-20',
                              isSelected && 'opacity-10'
                            )} />
                          </>
                        ) : (
                          <>
                            {/* Иконка локации (fallback) */}
                            <Icons.mapPin className="w-12 h-12 text-white opacity-80 absolute inset-0 m-auto" />
                            
                            {/* Overlay при наведении */}
                            <div className={cn(
                              'absolute inset-0 bg-black transition-opacity duration-200',
                              'opacity-0 group-hover:opacity-20',
                              isSelected && 'opacity-10'
                            )} />
                          </>
                        )}
                        
                        {/* Индикатор выбора */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 bg-blue-500 rounded-full p-1.5 shadow-lg z-10"
                          >
                            <Icons.checkCircle className="h-5 w-5 text-white" />
                          </motion.div>
                        )}
                      </div>
                      
                      {/* Подпись */}
                      <div className="p-3 bg-white">
                        <h5 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
                          {location.name}
                        </h5>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {location.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

