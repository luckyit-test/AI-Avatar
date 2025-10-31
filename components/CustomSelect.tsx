import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

interface CustomSelectProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  description?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  className,
  label,
  description,
}) => {
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

  const selectedOption = options.find(opt => opt === value) || placeholder;

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          {label}
        </label>
      )}
      {description && (
        <p className="text-xs text-gray-500 mb-3">{description}</p>
      )}
      <div ref={selectRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full px-4 py-3 text-left text-sm rounded-lg border transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
            'hover:border-blue-300 hover:shadow-sm',
            isOpen
              ? 'border-blue-400 bg-blue-50 shadow-sm ring-2 ring-blue-100'
              : 'border-gray-200 bg-white'
          )}
          style={{
            background: isOpen 
              ? '#eff6ff' 
              : '#ffffff',
          }}
        >
          <div className="flex items-center justify-between">
            <span className={cn(
              'truncate',
              value ? 'text-gray-900 font-medium' : 'text-gray-400'
            )}>
              {selectedOption}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 ml-2"
            >
              <Icons.chevronDown className="h-5 w-5 text-gray-400" />
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
              className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden"
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div className="max-h-60 overflow-auto py-1">
                {options.map((option, index) => {
                  const isSelected = option === value;
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange(option);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
                        'hover:bg-blue-50',
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:text-gray-900'
                      )}
                      style={{
                        background: isSelected
                          ? '#eff6ff'
                          : 'transparent',
                      }}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex-shrink-0 ml-2"
                          >
                            <Icons.checkCircle className="h-4 w-4 text-blue-600" />
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
    </div>
  );
};

