import React from 'react';
import { cn } from '../lib/utils';
import { NEW_YEAR_STYLES, type NewYearStyleId } from '../lib/newYearConstants';

interface StyleSelectProps {
  selectedStyle: NewYearStyleId | null;
  onSelect: (styleId: NewYearStyleId) => void;
  className?: string;
}

export function StyleSelect({ selectedStyle, onSelect, className }: StyleSelectProps) {
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
      <select
        value={selectedStyle || ''}
        onChange={(e) => {
          if (e.target.value) {
            onSelect(e.target.value as NewYearStyleId);
          }
        }}
        className={cn(
          'w-full px-4 py-3 rounded-lg border-2 transition-all duration-200',
          'bg-white border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
          'text-gray-900 text-base',
          'appearance-none cursor-pointer',
          selectedStyle && 'border-blue-500 bg-blue-50'
        )}
      >
        <option value="" disabled>
          Выберите стиль...
        </option>
        {NEW_YEAR_STYLES.map((style) => (
          <option key={style.id} value={style.id}>
            {style.name}
          </option>
        ))}
      </select>
      {selectedStyle && (
        <p className="mt-2 text-sm text-gray-600">
          {NEW_YEAR_STYLES.find(s => s.id === selectedStyle)?.description}
        </p>
      )}
    </div>
  );
}

