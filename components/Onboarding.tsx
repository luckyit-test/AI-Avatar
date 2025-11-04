import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  target: string; // CSS selector для элемента
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'upload',
    target: '[data-onboarding="upload"]',
    title: 'Загрузите ваше фото',
    description: 'Выберите четкое изображение лица анфас для лучшего результата',
    position: 'bottom'
  },
  {
    id: 'gender',
    target: '[data-onboarding="gender"]',
    title: 'Выберите пол',
    description: 'Система может определить пол автоматически, но вы можете выбрать вручную',
    position: 'bottom'
  },
  {
    id: 'role',
    target: '[data-onboarding="role"]',
    title: 'Укажите должность',
    description: 'Выберите вашу роль в IT - это поможет создать портрет в соответствующем стиле',
    position: 'bottom'
  },
  {
    id: 'company',
    target: '[data-onboarding="company"]',
    title: 'Тип компании',
    description: 'Выберите тип компании, в которой вы работаете',
    position: 'bottom'
  },
  {
    id: 'generate',
    target: '[data-onboarding="generate"]',
    title: 'Сгенерируйте портреты',
    description: 'Нажмите кнопку, чтобы создать 6 профессиональных портретов в разных стилях',
    position: 'top'
  }
];

const ONBOARDING_STORAGE_KEY = 'newava_onboarding_completed';

export function useOnboarding() {
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  });

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(!isCompleted);

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
    setIsCompleted(true);
    setIsActive(false);
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skip = () => {
    completeOnboarding();
  };

  return {
    isActive,
    currentStep,
    steps: ONBOARDING_STEPS,
    nextStep,
    prevStep,
    skip,
    completeOnboarding
  };
}

interface OnboardingProps {
  isActive: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function Onboarding({ isActive, currentStep, steps, onNext, onPrev, onSkip }: OnboardingProps) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isActive || currentStep >= steps.length) return;

    const updatePosition = () => {
      const step = steps[currentStep];
      const element = document.querySelector(step.target);

      // Если элемент не найден, пропускаем этот шаг
      if (!element) {
        // Для элементов, которые появляются после загрузки изображения,
        // просто не показываем онбординг до их появления
        if (step.id === 'gender' || step.id === 'role' || step.id === 'company' || step.id === 'generate') {
          return;
        }
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        setPosition({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
          height: rect.height
        });

        // Вычисляем позицию тултипа с учетом размера тултипа
        let tooltipTop = 0;
        let tooltipLeft = 0;

        // Примерные размеры тултипа (будет использоваться для позиционирования)
        const tooltipWidth = 384; // max-w-sm = 384px
        const tooltipHeight = 200; // примерная высота

        switch (step.position) {
          case 'top':
            tooltipTop = rect.top + scrollY - tooltipHeight - 20;
            tooltipLeft = rect.left + scrollX + rect.width / 2;
            break;
          case 'bottom':
            tooltipTop = rect.bottom + scrollY + 20;
            tooltipLeft = rect.left + scrollX + rect.width / 2;
            break;
          case 'left':
            tooltipTop = rect.top + scrollY + rect.height / 2;
            tooltipLeft = rect.left + scrollX - tooltipWidth - 20;
            break;
          case 'right':
            tooltipTop = rect.top + scrollY + rect.height / 2;
            tooltipLeft = rect.right + scrollX + 20;
            break;
        }

        setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
      }
    };

    updatePosition();
    
    // Проверяем, существует ли элемент перед добавлением слушателей
    const element = document.querySelector(steps[currentStep].target);
    if (!element && (steps[currentStep].id === 'gender' || steps[currentStep].id === 'role' || steps[currentStep].id === 'company' || steps[currentStep].id === 'generate')) {
      // Элемент еще не появился, не показываем онбординг
      return;
    }

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    // Прокручиваем к элементу
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(updatePosition, 500);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, currentStep, steps]);

  if (!isActive || currentStep >= steps.length || !position || !tooltipPosition) {
    return null;
  }

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Определяем позицию стрелки
  const arrowStyle: React.CSSProperties = {};
  let arrowClass = '';

  switch (step.position) {
    case 'top':
      arrowClass = 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent';
      break;
    case 'bottom':
      arrowClass = 'top-[-8px] left-1/2 -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent';
      break;
    case 'left':
      arrowClass = 'right-[-8px] top-1/2 -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent';
      break;
    case 'right':
      arrowClass = 'left-[-8px] top-1/2 -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent';
      break;
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onSkip}
      />

      {/* Highlight box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed z-50 pointer-events-none"
        style={{
          top: position.top - 4,
          left: position.left - 4,
          width: position.width + 8,
          height: position.height + 8,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 0 4px #3b82f6'
        }}
      />

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-50 bg-gray-800 text-white rounded-lg shadow-xl max-w-sm p-6"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: step.position === 'left' || step.position === 'right' 
            ? `translateY(-50%) ${step.position === 'left' ? 'translateX(-100%)' : ''}`
            : `translateX(-50%) ${step.position === 'top' ? 'translateY(-100%)' : ''}`
        }}
      >
        {/* Arrow */}
        <div className={`absolute w-0 h-0 ${arrowClass}`} style={{ borderWidth: '8px' }} />

        <div className="relative">
          <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
          <p className="text-sm text-gray-300 mb-4">{step.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Назад
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Пропустить
              </button>
              <button
                onClick={onNext}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                {isLast ? 'Начать' : 'Далее'}
              </button>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-4 flex items-center justify-center gap-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-6 bg-blue-500'
                    : index < currentStep
                    ? 'w-1.5 bg-blue-500/50'
                    : 'w-1.5 bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

