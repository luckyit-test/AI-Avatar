import React from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';
import { NEW_YEAR_STYLES, type NewYearStyleId, type NewYearStyle } from '../lib/newYearConstants';

interface StyleSelectorProps {
  selectedStyle: NewYearStyleId | null;
  onSelect: (styleId: NewYearStyleId) => void;
  className?: string;
}

export function StyleSelector({ selectedStyle, onSelect, className }: StyleSelectorProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Стиль фотосессии
        </h3>
        <p className="text-xs text-gray-600">
          Выберите стиль для всех 6 фотографий
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {NEW_YEAR_STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          return (
            <motion.button
              key={style.id}
              type="button"
              onClick={() => onSelect(style.id)}
              className={cn(
                'relative p-3 rounded-lg border-2 transition-all duration-200 text-left',
                'hover:shadow-md',
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              )}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <Icons.checkCircle className="h-6 w-6 text-blue-600" />
                </motion.div>
              )}

              <div className="pr-8">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  {style.name}
                </h4>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {style.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {style.elements.slice(0, 3).map((element, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        isSelected
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {element}
                    </span>
                  ))}
                  {style.elements.length > 3 && (
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        isSelected
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      +{style.elements.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

