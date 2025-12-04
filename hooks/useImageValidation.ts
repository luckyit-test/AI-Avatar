/**
 * Хук для валидации изображений
 */
import { useState, useEffect } from 'react';
import { evaluateImage, type DetectedGender, type ImageEvaluationResult } from '../services/geminiService';
import { devLog } from '../lib/utils';

const MIN_ANALYSIS_MS = 3000; // Минимальное время показа статуса анализа

interface UseImageValidationOptions {
    imageDataUrl: string | null;
    onValidated: (evaluation: ImageEvaluationResult) => void;
    onError: (error: string) => void;
}

export function useImageValidation({
    imageDataUrl,
    onValidated,
    onError,
}: UseImageValidationOptions) {
    const [isValidatingImage, setIsValidatingImage] = useState<boolean>(false);
    const [validationTimer, setValidationTimer] = useState<number>(0);
    const [validationStatusMessage, setValidationStatusMessage] = useState<string>('Анализируем изображение...');
    const [imageValidationError, setImageValidationError] = useState<string | null>(null);
    const [detectedGender, setDetectedGender] = useState<DetectedGender>('unknown');

    // Таймер для оценки изображения - обратный отсчет от 10 до 1
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (isValidatingImage) {
            setValidationTimer(10);
            intervalId = setInterval(() => {
                setValidationTimer(prev => {
                    if (prev <= 1) {
                        return 1;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setValidationTimer(0);
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isValidatingImage]);

    const validateImage = async (dataUrl: string) => {
        setIsValidatingImage(true);
        setImageValidationError(null);
        setValidationStatusMessage('Анализируем изображение...');
        const analysisStartedAt = Date.now();

        try {
            const evaluation: ImageEvaluationResult = await evaluateImage(dataUrl, (status) => {
                if (status.statusMessage) {
                    setValidationStatusMessage(status.statusMessage);
                }
            });

            devLog.log('Image evaluation result:', evaluation);

            if (!evaluation.isValid) {
                const elapsed = Date.now() - analysisStartedAt;
                const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
                setIsValidatingImage(false);
                setValidationStatusMessage('Анализируем изображение...');
                setImageValidationError(evaluation.errorMessage);
                onError(evaluation.errorMessage);
                return;
            }

            // Изображение валидно
            const elapsed = Date.now() - analysisStartedAt;
            const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
            if (delay > 0) await new Promise(r => setTimeout(r, delay));

            setDetectedGender(evaluation.gender);
            setIsValidatingImage(false);
            setValidationStatusMessage('Анализируем изображение...');
            onValidated(evaluation);
        } catch (err) {
            devLog.error('[useImageValidation] Validation error:', err);
            const elapsed = Date.now() - analysisStartedAt;
            const delay = Math.max(0, MIN_ANALYSIS_MS - elapsed);
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
            setIsValidatingImage(false);
            setValidationStatusMessage('Анализируем изображение...');
            const errorMessage = err instanceof Error ? err.message : 'Не удалось проверить изображение';
            setImageValidationError(errorMessage);
            onError(errorMessage);
        }
    };

    return {
        isValidatingImage,
        validationTimer,
        validationStatusMessage,
        imageValidationError,
        detectedGender,
        validateImage,
        setImageValidationError,
    };
}

