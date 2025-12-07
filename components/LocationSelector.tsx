import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';
import { NEW_YEAR_LOCATIONS, type NewYearLocationId, type NewYearLocation } from '../lib/newYearConstants';

interface LocationSelectorProps {
  selectedLocation: NewYearLocationId | null;
  onSelect: (locationId: NewYearLocationId) => void;
  className?: string;
}

// Группировка локаций по типам
const LOCATION_GROUPS = {
  home: ['living-room', 'winter-house', 'village-house', 'cottage', 'balcony-terrace'],
  outdoor: ['city-street', 'city-square', 'outdoor-rink', 'winter-forest', 'park', 'ski-resort'],
  luxury: ['luxury-hall', 'luxury-hotel', 'theater', 'library'],
  unique: ['cafe-restaurant', 'photo-studio', 'greenhouse', 'workshop'],
} as const;

const GROUP_LABELS = {
  home: 'Домашние локации',
  outdoor: 'Уличные локации',
  luxury: 'Роскошные локации',
  unique: 'Необычные локации',
} as const;

export function LocationSelector({ selectedLocation, onSelect, className }: LocationSelectorProps) {
  const [expandedGroup, setExpandedGroup] = useState<keyof typeof LOCATION_GROUPS | null>(null);

  const toggleGroup = (group: keyof typeof LOCATION_GROUPS) => {
    setExpandedGroup(expandedGroup === group ? null : group);
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Выберите новогоднюю локацию
        </h3>
        <p className="text-sm text-gray-600">
          Локация определит окружение для всех 6 фотографий
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(LOCATION_GROUPS) as Array<keyof typeof LOCATION_GROUPS>).map((groupKey) => {
          const groupLocationIds = LOCATION_GROUPS[groupKey];
          const groupLocations = NEW_YEAR_LOCATIONS.filter(loc => 
            groupLocationIds.includes(loc.id as any)
          );
          const isExpanded = expandedGroup === groupKey;

          return (
            <div key={groupKey} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className={cn(
                  'w-full px-4 py-3 flex items-center justify-between',
                  'bg-gray-50 hover:bg-gray-100 transition-colors',
                  isExpanded && 'bg-blue-50'
                )}
              >
                <span className="font-semibold text-gray-900">
                  {GROUP_LABELS[groupKey]}
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icons.chevronDown className="h-5 w-5 text-gray-500" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupLocations.map((location) => {
                        const isSelected = selectedLocation === location.id;
                        return (
                          <motion.button
                            key={location.id}
                            type="button"
                            onClick={() => onSelect(location.id)}
                            className={cn(
                              'relative p-3 rounded-lg border-2 transition-all duration-200 text-left',
                              'hover:shadow-md',
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            )}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-2 right-2"
                              >
                                <Icons.checkCircle className="h-5 w-5 text-blue-600" />
                              </motion.div>
                            )}

                            <div className="pr-8">
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                {location.name}
                              </h4>
                              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                {location.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {location.elements.slice(0, 2).map((element, idx) => (
                                  <span
                                    key={idx}
                                    className={cn(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      isSelected
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600'
                                    )}
                                  >
                                    {element}
                                  </span>
                                ))}
                                {location.elements.length > 2 && (
                                  <span
                                    className={cn(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      isSelected
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600'
                                    )}
                                  >
                                    +{location.elements.length - 2}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

