/**
 * Хук для polling статуса заказа
 */
import { useEffect, useRef, useState } from 'react';
import { fetchOrder, type OrderInfo } from '../services/geminiService';
import { devLog } from '../lib/utils';
import { STYLES } from '../lib/constants';

type ImageStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error';
export interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
}

type AppState = 'idle' | 'image-uploaded' | 'generating' | 'results-shown' | 'failed';

interface UseOrderPollingOptions {
    currentInvId: string | null;
    currentOrder: OrderInfo | null;
    appState: AppState;
    onStatusChange: (order: OrderInfo) => void;
    onCompleted: (order: OrderInfo, images: Record<string, GeneratedImage>) => void;
    onFailed: () => void;
    onProcessing: () => void;
}

export function useOrderPolling({
    currentInvId,
    currentOrder: initialOrder,
    appState,
    onStatusChange,
    onCompleted,
    onFailed,
    onProcessing,
}: UseOrderPollingOptions) {
    const [currentOrder, setCurrentOrder] = useState<OrderInfo | null>(initialOrder);
    const pollDelayRef = useRef<number>(2000);
    const consecutiveErrorsRef = useRef<number>(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setCurrentOrder(initialOrder);
    }, [initialOrder]);

    useEffect(() => {
        if (!currentInvId) return;
        
        // Если currentOrder еще не загружен, не запускаем polling
        if (!currentOrder) return;
        
        // Запускаем polling только для paid или processing
        if (currentOrder.status !== 'processing' && currentOrder.status !== 'paid') return;

        const MIN_POLL_DELAY = 2000;
        const MAX_POLL_DELAY = 30000;
        const BACKOFF_MULTIPLIER = 1.5;
        const MAX_CONSECUTIVE_ERRORS = 5;

        let pollTimeoutId: NodeJS.Timeout | null = null;
        let isPolling = true;
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const pollOrderStatus = async () => {
            if (!isPolling || abortController.signal.aborted) return;

            try {
                if (!currentInvId) return;
                const order = await fetchOrder(currentInvId);

                // Используем функциональное обновление для избежания race conditions
                let statusChanged = false;
                setCurrentOrder(prev => {
                    // Если статус не изменился, возвращаем предыдущее состояние
                    if (prev?.status === order.status && prev?.invId === order.invId) {
                        return prev;
                    }
                    statusChanged = true;
                    return order;
                });

                // Вызываем callback при изменении статуса
                if (statusChanged) {
                    onStatusChange(order);

                    // Если заказ перешел в processing - обновляем UI
                    if (order.status === 'processing' && appState !== 'generating') {
                        onProcessing();
                        // Сбрасываем задержку при изменении статуса
                        pollDelayRef.current = MIN_POLL_DELAY;
                        consecutiveErrorsRef.current = 0;
                    }

                    // Если заказ завершен - обновляем UI и останавливаем polling
                    if (order.status === 'completed' && order.generatedImages) {
                        const images: Record<string, GeneratedImage> = {};
                        STYLES.forEach(style => {
                            if (order.generatedImages && order.generatedImages[style]) {
                                images[style] = { status: 'done', url: order.generatedImages[style] };
                            } else {
                                images[style] = { status: 'error', error: 'Не сгенерировано' };
                            }
                        });
                        onCompleted(order, images);
                        isPolling = false;
                        return;
                    } else if (order.status === 'failed') {
                        onFailed();
                        isPolling = false;
                        return;
                    }
                }

                // Если статус не изменился, увеличиваем задержку (exponential backoff)
                if (!statusChanged) {
                    pollDelayRef.current = Math.min(pollDelayRef.current * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);
                } else {
                    // При изменении статуса сбрасываем задержку
                    pollDelayRef.current = MIN_POLL_DELAY;
                    consecutiveErrorsRef.current = 0;
                }

                // Планируем следующий запрос с учетом backoff
                if (isPolling && !abortController.signal.aborted) {
                    if (pollTimeoutId) {
                        clearTimeout(pollTimeoutId);
                        pollTimeoutId = null;
                    }
                    pollTimeoutId = setTimeout(pollOrderStatus, pollDelayRef.current);
                }
            } catch (err) {
                if (abortController.signal.aborted) return;

                consecutiveErrorsRef.current++;

                if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                    devLog.error('[useOrderPolling] Too many consecutive polling errors, stopping:', err);
                    isPolling = false;
                    return;
                }

                pollDelayRef.current = Math.min(pollDelayRef.current * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);
                if (isPolling && !abortController.signal.aborted) {
                    if (pollTimeoutId) {
                        clearTimeout(pollTimeoutId);
                        pollTimeoutId = null;
                    }
                    pollTimeoutId = setTimeout(pollOrderStatus, pollDelayRef.current);
                }
            }
        };

        pollOrderStatus();

        return () => {
            isPolling = false;
            abortController.abort();
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
            }
        };
    }, [currentInvId, currentOrder, appState, onStatusChange, onCompleted, onFailed, onProcessing]);

    return { currentOrder, setCurrentOrder };
}

