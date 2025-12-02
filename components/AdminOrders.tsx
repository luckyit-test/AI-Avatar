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
  hasImageData: boolean;
  imagesCount: number;
  failureReason?: string | null;
  retries: number;
}

interface AdminOrdersResponse {
  orders: AdminOrder[];
}

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/admin/orders', {
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

    void fetchOrders();
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

      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
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
                        {order.hasImageData ? 'Да' : 'Нет'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {order.imagesCount > 0 ? `${order.imagesCount} шт.` : '—'}
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
      </main>
    </div>
  );
};

export default AdminOrders;


