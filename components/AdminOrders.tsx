/**
 * Простая админка для просмотра заказов Robokassa.
 * Не защищена авторизацией, использовать только как внутренний инструмент.
 */
import React, { useEffect, useState } from 'react';

interface AdminOrder {
  invId: string;
  status: string;
  amount: string | number;
  createdAt?: number;
  gender?: string | null;
  role?: string | null;
  company?: string | null;
  photoSessionType?: string | null;
  hasImageData: boolean;
  generatedImages?: Record<string, string> | null;
  imagesCount?: number;
  failureReason?: string | null;
  retries: number;
  promoCode?: string | null;
}

interface AdminOrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminOrdersProps {
  embedded?: boolean;
}

const AdminOrders: React.FC<AdminOrdersProps> = ({ embedded }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [previewOrder, setPreviewOrder] = useState<AdminOrder | null>(null);
  const [previewImages, setPreviewImages] = useState<Record<string, string> | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchOrders = async (pageToLoad = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(pageToLoad));
      params.set('limit', String(pageSize));
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from', String(new Date(fromDate).getTime()));
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set('to', String(end.getTime()));
      }

      const url = `/api/admin/orders${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as AdminOrdersResponse;
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setPage(data.page || pageToLoad);
      setPageSize(data.pageSize || pageSize);
    } catch (err) {
      console.error('[AdminOrders] Failed to fetch orders:', err);
      setError('Не удалось загрузить список заказов. Попробуйте обновить страницу.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (ts?: number) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleString('ru-RU');
    } catch {
      return '-';
    }
  };

  const handleDownloadAll = (order: AdminOrder) => {
    const link = document.createElement('a');
    link.href = `/api/admin/orders/${order.invId}/download`;
    link.download = `newava_${order.invId}_portraits.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = async (order: AdminOrder) => {
    try {
      setPreviewOrder(order);
      setPreviewImages(null);
      setPreviewError(null);
      setPreviewLoading(true);

      const response = await fetch(`/api/admin/orders/${order.invId}/images`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { invId: string; images: Record<string, string> };
      setPreviewImages(data.images || {});
    } catch (err) {
      console.error('[AdminOrders] Failed to load order images:', err);
      setPreviewError('Не удалось загрузить портреты этого заказа.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const content = (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="mb-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-end gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Статус</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto min-w-[140px] border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
                >
                  <option value="">Все статусы</option>
                  <option value="created">Создан</option>
                  <option value="paid">Оплачен</option>
                  <option value="processing">Обработка</option>
                  <option value="completed">Завершён</option>
                  <option value="failed">Ошибка</option>
                </select>
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Дата от</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full sm:w-auto min-w-[160px] border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Дата до</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full sm:w-auto min-w-[160px] border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
                />
              </div>
              <button
                onClick={() => void fetchOrders(1)}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Обновить
              </button>
            </div>
          </div>
        </div>
      </div>
      {isLoading && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
          <div className="inline-flex items-center text-slate-600">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Загружаем заказы…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-600">Заказы пока не найдены</p>
          <p className="text-xs text-slate-500 mt-1">Попробуйте изменить фильтры</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">InvId</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Сумма</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap md:hidden">Промокод</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Промокод</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Создан</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Пол</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Роль</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Компания</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Фотосессия</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Исходник</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Портреты</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Ошибка / Повторы</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr key={order.invId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-900 whitespace-nowrap hidden md:table-cell">
                      <span className="font-medium">{order.invId}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        order.status === 'failed' ? 'bg-red-100 text-red-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'paid' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                      {order.amount} ₽
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap md:hidden">
                      {order.promoCode ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 font-mono tracking-[0.1em] uppercase">
                          {order.promoCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      {order.promoCode ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 font-mono tracking-[0.1em] uppercase">
                          {order.promoCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap hidden md:table-cell">
                      {order.gender || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 hidden lg:table-cell">
                      {order.role || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 hidden xl:table-cell">
                      {order.company || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap hidden xl:table-cell">
                      {order.photoSessionType || 'Деловая'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap hidden md:table-cell">
                      {order.hasImageData ? (
                        <span className="inline-flex items-center text-emerald-600">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Да
                        </span>
                      ) : (
                        <span className="text-slate-400">Нет</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(order.imagesCount && order.imagesCount > 0) || order.status === 'completed' ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handlePreview(order)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 transition-colors"
                          >
                            Просмотр
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAll(order)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 transition-colors"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Скачать
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm hidden lg:table-cell">
                      {order.failureReason ? (
                        <div className="max-w-xs">
                          <span className="text-red-600 font-medium">{order.failureReason}</span>
                          <span className="text-slate-500 ml-1">(ретраев: {order.retries || 0})</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">ретраев: {order.retries || 0}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg border border-slate-200 shadow-sm px-4 sm:px-6 py-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">Страница {page}</span>
            <span className="mx-2">из</span>
            <span className="font-medium text-slate-900">{totalPages}</span>
            <span className="mx-2">({total} заказов)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => void fetchOrders(page - 1)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => void fetchOrders(page + 1)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Вперёд
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Модалка предпросмотра */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => {
          setPreviewOrder(null);
          setPreviewImages(null);
          setPreviewError(null);
        }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Портреты заказа <span className="font-mono text-base">{previewOrder.invId}</span>
                </h2>
                {previewLoading && (
                  <p className="text-sm text-slate-500 mt-1">Загружаем изображения…</p>
                )}
                {previewError && (
                  <p className="text-sm text-red-600 mt-1">{previewError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewOrder(null);
                  setPreviewImages(null);
                  setPreviewError(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {previewImages && (
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                  {Object.entries(previewImages).map(([style, url]) => (
                    <div key={style} className="flex flex-col items-center gap-2 group">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        download={`newava_${previewOrder.invId}_${style}.jpg`}
                        className="block w-full aspect-square rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50 hover:border-slate-400 transition-all shadow-sm hover:shadow-md"
                      >
                        <img
                          src={url}
                          alt={style}
                          className="w-full h-full object-cover"
                        />
                      </a>
                      <span className="text-xs font-medium text-slate-700 text-center">
                        {style}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="w-full border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Админка заказов NEWAVA.pro</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Визуальный мониторинг платежей и генерации портретов (Robokassa).
            </p>
          </div>
          <a
            href="/"
            className="text-xs text-slate-500 hover:text-slate-900 underline decoration-dotted"
          >
            Назад к сервису
          </a>
        </div>
      </header>

      <main className="flex-1 w-full">{content}</main>
    </div>
  );
};

export default AdminOrders;



