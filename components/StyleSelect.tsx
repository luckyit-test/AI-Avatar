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
      <label className="block mb-2">
        <span className="text-base font-semibold text-gray-900">
          2. Выберите стиль фотосессии
        </span>
      </label>
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

