import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  magic: ['cafe-restaurant', 'photo-studio', 'greenhouse', 'workshop', 'santa-residence', 'metro-new-year'],
} as const;

const GROUP_LABELS = {
  home: 'Дом',
  outdoor: 'Улица',
  luxury: 'Роскошь',
  magic: 'Волшебство',
} as const;

type CategoryKey = keyof typeof LOCATION_GROUPS;

// Функция для получения цвета градиента для группы
const getGroupGradient = (group: CategoryKey) => {
  const gradients = {
    home: 'from-blue-500 to-blue-600',
    outdoor: 'from-green-500 to-green-600',
    luxury: 'from-purple-500 to-purple-600',
    magic: 'from-orange-500 to-orange-600',
  };
  return gradients[group] || 'from-gray-500 to-gray-600';
};

// Цвета для табов - красно-оранжевые оттенки
const getTabColors = (group: CategoryKey, isActive: boolean) => {
  const colors = {
    home: isActive 
      ? 'bg-red-600 text-white shadow-lg shadow-red-200' 
      : 'bg-red-100 text-white hover:bg-red-200',
    outdoor: isActive 
      ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' 
      : 'bg-orange-100 text-white hover:bg-orange-200',
    luxury: isActive 
      ? 'bg-red-700 text-white shadow-lg shadow-red-300' 
      : 'bg-red-200 text-white hover:bg-red-300',
    magic: isActive 
      ? 'bg-orange-700 text-white shadow-lg shadow-orange-300' 
      : 'bg-orange-200 text-white hover:bg-orange-300',
  };
  return colors[group];
};

export function LocationGrid({ selectedLocation, onSelect, className }: LocationGridProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('home');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (locationId: string) => {
    setImageErrors(prev => ({ ...prev, [locationId]: true }));
  };

  const activeCategoryIds = LOCATION_GROUPS[activeCategory];
  const activeLocations = NEW_YEAR_LOCATIONS.filter(loc => 
    activeCategoryIds.includes(loc.id as any)
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Заголовок */}
      <div className="flex items-start gap-3 mb-6">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white flex-shrink-0 mt-0.5 shadow-md"
          style={{
            background: 'rgb(220, 38, 38)',
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

      {/* Табы для ПК версии */}
      <div className="hidden md:block mb-6">
        <div className="flex gap-2 bg-red-50 p-1.5 rounded-xl">
          {(Object.keys(LOCATION_GROUPS) as CategoryKey[]).map((categoryKey) => {
            const isActive = activeCategory === categoryKey;
            return (
              <motion.button
                key={categoryKey}
                type="button"
                onClick={() => setActiveCategory(categoryKey)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  getTabColors(categoryKey, isActive),
                  isActive ? 'focus:ring-opacity-50' : 'focus:ring-gray-300'
                )}
                whileHover={{ scale: isActive ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {GROUP_LABELS[categoryKey]}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Мобильная версия: показываем все категории как раньше */}
      <div className="md:hidden space-y-6">
        {(Object.keys(LOCATION_GROUPS) as CategoryKey[]).map((groupKey) => {
          const groupLocationIds = LOCATION_GROUPS[groupKey];
          const groupLocations = NEW_YEAR_LOCATIONS.filter(loc => 
            groupLocationIds.includes(loc.id as any)
          );

          return (
            <div key={groupKey}>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {GROUP_LABELS[groupKey]}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {groupLocations.map((location) => {
                  const isSelected = selectedLocation === location.id;
                  const previewPath = getLocationPreviewPath(location.id);
                  const imageError = imageErrors[location.id] || false;
                  
                  return (
                    <LocationCard
                      key={location.id}
                      location={location}
                      isSelected={isSelected}
                      previewPath={previewPath}
                      imageError={imageError}
                      groupKey={groupKey}
                      onSelect={onSelect}
                      onImageError={() => handleImageError(location.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ПК версия: показываем только активную категорию */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="hidden md:block"
        >
          <div className="grid grid-cols-3 gap-4">
            {activeLocations.map((location) => {
              const isSelected = selectedLocation === location.id;
              const previewPath = getLocationPreviewPath(location.id);
              const imageError = imageErrors[location.id] || false;
              
              return (
                <LocationCard
                  key={location.id}
                  location={location}
                  isSelected={isSelected}
                  previewPath={previewPath}
                  imageError={imageError}
                  groupKey={activeCategory}
                  onSelect={onSelect}
                  onImageError={() => handleImageError(location.id)}
                />
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Вынесенный компонент карточки локации
interface LocationCardProps {
  location: typeof NEW_YEAR_LOCATIONS[number];
  isSelected: boolean;
  previewPath: string | null;
  imageError: boolean;
  groupKey: CategoryKey;
  onSelect: (locationId: NewYearLocationId) => void;
  onImageError: () => void;
}

function LocationCard({
  location,
  isSelected,
  previewPath,
  imageError,
  groupKey,
  onSelect,
  onImageError,
}: LocationCardProps) {
  return (
    <motion.button
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
              onError={onImageError}
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
}

