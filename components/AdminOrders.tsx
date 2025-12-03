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
  failureReason?: string | null;
  retries: number;
}

interface AdminOrdersResponse {
  orders: AdminOrder[];
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

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
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
    } catch (err) {
      console.error('[AdminOrders] Failed to fetch orders:', err);
      setError('Не удалось загрузить список заказов. Попробуйте обновить страницу.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
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

  const renderThumbnails = (order: AdminOrder) => {
    if (!order.generatedImages) return '—';
    const entries = Object.entries(order.generatedImages);
    if (entries.length === 0) return '—';

    return (
      <div className="flex items-center gap-1">
        {entries.map(([style, url]) => (
          <a
            key={style}
            href={url}
            target="_blank"
            rel="noreferrer"
            download={`newava_${order.invId}_${style}.png`}
            className="block w-8 h-8 rounded-md overflow-hidden border border-slate-200 bg-slate-100"
            title={style}
          >
            <img
              src={url}
              alt={style}
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    );
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
                onClick={() => void fetchOrders()}
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
                    {renderThumbnails(order)}
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



