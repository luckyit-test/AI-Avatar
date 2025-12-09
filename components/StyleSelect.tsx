import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { NEW_YEAR_STYLES, type NewYearStyleId } from '../lib/newYearConstants';
import { Icons } from './Icons';

interface StyleSelectProps {
  selectedStyle: NewYearStyleId | null;
  onSelect: (styleId: NewYearStyleId) => void;
  className?: string;
}

export function StyleSelect({ selectedStyle, onSelect, className }: StyleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedStyleData = selectedStyle 
    ? NEW_YEAR_STYLES.find(s => s.id === selectedStyle)
    : null;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start gap-3 mb-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white flex-shrink-0 mt-0.5"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
            boxShadow: '0 10px 20px rgba(139,92,246,0.35)',
          }}
        >
          2
        </span>
        <div className="flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-0.5">
            Выберите стиль фотосессии
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Стиль определит общую атмосферу всех 6 фотографий
          </p>
        </div>
      </div>
      
      <div ref={selectRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-left',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            isOpen
              ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-100 focus:ring-purple-300'
              : selectedStyle
              ? 'border-purple-400 bg-purple-50 hover:border-purple-500 hover:shadow-sm focus:ring-purple-200'
              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm focus:ring-purple-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-base truncate',
              selectedStyle ? 'text-gray-900 font-medium' : 'text-gray-400'
            )}>
              {selectedStyleData?.name || 'Выберите стиль...'}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 ml-3"
            >
              <Icons.chevronDown className={cn(
                'h-5 w-5 transition-colors',
                isOpen ? 'text-purple-600' : 'text-gray-400'
              )} />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 bg-white rounded-lg border-2 border-gray-200 shadow-xl overflow-hidden"
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div className="max-h-72 overflow-auto py-1">
                {NEW_YEAR_STYLES.map((style) => {
                  const isSelected = style.id === selectedStyle;
                  return (
                    <motion.button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        onSelect(style.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors duration-150',
                        'hover:bg-purple-50',
                        isSelected
                          ? 'bg-purple-50 text-purple-700 font-medium'
                          : 'text-gray-700 hover:text-gray-900'
                      )}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-base">{style.name}</div>
                          <div className={cn(
                            'text-xs mt-0.5 truncate',
                            isSelected ? 'text-purple-600' : 'text-gray-500'
                          )}>
                            {style.description}
                          </div>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex-shrink-0 ml-3"
                          >
                            <Icons.checkCircle className="h-5 w-5 text-purple-600" />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedStyle && selectedStyleData && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-gray-600"
        >
          {selectedStyleData.description}
        </motion.p>
      )}
    </div>
  );
}

