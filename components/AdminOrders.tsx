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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Статус</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded px-2 py-1 text-xs text-slate-700 bg-white"
                >
                  <option value="">Все</option>
                  <option value="created">created</option>
                  <option value="paid">paid</option>
                  <option value="processing">processing</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Дата от</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded px-2 py-1 text-xs text-slate-700 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Дата до</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded px-2 py-1 text-xs text-slate-700 bg-white"
                />
              </div>
              <button
                onClick={() => void fetchOrders(1)}
                className="inline-flex items-center px-3 py-1.5 text-xs rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Обновить
              </button>
            </div>
          </div>
          {isLoading && (
            <p className="text-sm text-slate-600 mb-4">Загружаем заказы…</p>
          )}
          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          {!isLoading && !error && orders.length === 0 && (
            <p className="text-sm text-slate-500">Заказы пока не найдены.</p>
          )}

      {orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">InvId</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Статус</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Сумма</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Создан</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Пол</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Роль</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Компания</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Вид фотосессии</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Исходник</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Портреты</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Ошибка / Повторы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.invId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                    {order.invId}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.status}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.amount} ₽
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.gender || '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {order.role || '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {order.company || '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.photoSessionType || 'Деловая фотосессия'}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.hasImageData ? 'Да' : 'Нет'}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {order.imagesCount && order.imagesCount > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePreview(order)}
                          className="px-2 py-1 text-[11px] rounded border border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                        >
                          Просмотр
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAll(order)}
                          className="px-2 py-1 text-[11px] rounded border border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                        >
                          Скачать все
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {order.failureReason ? (
                      <span className="text-red-600">
                        {order.failureReason} (ретраев: {order.retries || 0})
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        ретраев: {order.retries || 0}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-600">
        <div>
          Страница {page} из {totalPages} ({total} заказов)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => void fetchOrders(page - 1)}
            className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40"
          >
            ‹ Назад
          </button>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => void fetchOrders(page + 1)}
            className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40"
          >
            Вперёд ›
          </button>
        </div>
      </div>

      {/* Модалка предпросмотра */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Портреты заказа {previewOrder.invId}
                </h2>
                {previewLoading && (
                  <p className="text-[11px] text-slate-500 mt-1">Загружаем изображения…</p>
                )}
                {previewError && (
                  <p className="text-[11px] text-red-600 mt-1">{previewError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewOrder(null);
                  setPreviewImages(null);
                  setPreviewError(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Закрыть
              </button>
            </div>

            {previewImages && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(previewImages).map(([style, url]) => (
                  <div key={style} className="flex flex-col items-center gap-1">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      download={`newava_${previewOrder.invId}_${style}.jpg`}
                      className="block w-28 h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={url}
                        alt={style}
                        className="w-full h-full object-cover"
                      />
                    </a>
                    <span className="text-[11px] text-slate-700 text-center truncate max-w-[7rem]">
                      {style}
                    </span>
                  </div>
                ))}
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



