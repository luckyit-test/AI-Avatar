/**
 * Админка промокодов NEWAVA.pro
 * Управление промокодами: список, создание/редактирование, удаление.
 */
import React, { useEffect, useState } from 'react';

interface AdminPromo {
  code: string;
  isActive: boolean;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number | null;
  note?: string | null;
}

interface AdminPromosResponse {
  promos: AdminPromo[];
}

const AdminPromocodes: React.FC = () => {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [formCode, setFormCode] = useState<string>('');
  const [formMaxUses, setFormMaxUses] = useState<string>('10');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formExpiresAt, setFormExpiresAt] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);

  const fetchPromos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/promocodes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as AdminPromosResponse;
      setPromos(data.promos || []);
    } catch (err) {
      console.error('[AdminPromocodes] Failed to fetch promo codes:', err);
      setError('Не удалось загрузить список промокодов. Попробуйте обновить страницу.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPromos();
  }, []);

  const handleSave = async () => {
    const code = formCode.trim().toUpperCase();
    if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
      setError('Промокод должен состоять из 6 символов: латинские буквы и цифры.');
      return;
    }
    const maxUsesNum = Number(formMaxUses) || 0;
    if (maxUsesNum <= 0) {
      setError('Максимальное количество активаций должно быть больше 0.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const body: any = {
        code,
        maxUses: maxUsesNum,
        isActive: formIsActive,
        note: formNote || undefined,
      };
      if (formExpiresAt) {
        const ts = new Date(formExpiresAt).getTime();
        if (!Number.isNaN(ts)) {
          body.expiresAt = ts;
        }
      }

      const response = await fetch('/api/admin/promocodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      await fetchPromos();
      // очищаем только примечание и активность, код и maxUses оставляем — удобно создавать похожие коды
      setFormNote('');
    } catch (err) {
      console.error('[AdminPromocodes] Failed to save promo code:', err);
      setError('Не удалось сохранить промокод. Проверьте данные и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: AdminPromo) => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/promocodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promo.code,
          maxUses: promo.maxUses,
          isActive: !promo.isActive,
          expiresAt: promo.expiresAt || undefined,
          note: promo.note || undefined,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }
      await fetchPromos();
    } catch (err) {
      console.error('[AdminPromocodes] Failed to toggle promo code:', err);
      setError('Не удалось изменить статус промокода.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo: AdminPromo) => {
    if (!window.confirm(`Удалить промокод ${promo.code}?`)) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/promocodes/${promo.code}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }
      await fetchPromos();
    } catch (err) {
      console.error('[AdminPromocodes] Failed to delete promo code:', err);
      setError('Не удалось удалить промокод.');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (ts?: number | null) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('ru-RU');
    } catch {
      return '—';
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Управление промокодами</h2>
        <p className="text-sm text-slate-600">
          Каждый промокод даёт ограниченное количество бесплатных генераций. Код — 6 символов (латиница и цифры).
        </p>
      </div>

      {/* Форма добавления/редактирования */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Создать / Редактировать промокод</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-2">Промокод</label>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm tracking-[0.2em] uppercase font-mono focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-2">Макс. активаций</label>
            <input
              type="number"
              min={1}
              value={formMaxUses}
              onChange={(e) => setFormMaxUses(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-2">Статус</label>
            <div className="flex items-center h-10">
              <label htmlFor="promo-active" className="flex items-center cursor-pointer">
                <input
                  id="promo-active"
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-slate-700">
                  Активен
                </span>
              </label>
            </div>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-2">Истекает (опц.)</label>
            <input
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-2">Комментарий (опц.)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Например, партнёры"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-red-600 font-medium">
                {error}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Сохраняем…
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Сохранить промокод
              </>
            )}
          </button>
        </div>
      </div>

      {/* Список промокодов */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900">Список промокодов</h3>
        </div>
        {isLoading && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center text-slate-600">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Загружаем промокоды…</span>
            </div>
          </div>
        )}
        {!isLoading && promos.length === 0 && (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <p className="text-sm font-medium text-slate-600">Промокоды пока не созданы</p>
            <p className="text-xs text-slate-500 mt-1">Создайте первый промокод с помощью формы выше</p>
          </div>
        )}
        {!isLoading && promos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Код</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Макс.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Использовано</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Осталось</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Создан</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Обновлён</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Истекает</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Комментарий</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {promos.map((promo) => (
                  <tr key={promo.code} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-bold text-slate-900 tracking-[0.2em] uppercase">
                        {promo.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {promo.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Неактивен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center hidden md:table-cell">
                      <span className="font-medium">{promo.maxUses}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-center hidden md:table-cell">
                      <span className="font-medium">{promo.usedCount}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        promo.remainingUses > 0 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {promo.remainingUses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">
                      {formatDateTime(promo.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap hidden xl:table-cell">
                      {formatDateTime(promo.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap hidden xl:table-cell">
                      {formatDateTime(promo.expiresAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate hidden lg:table-cell" title={promo.note || ''}>
                      {promo.note || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormCode(promo.code);
                            setFormMaxUses(String(promo.maxUses));
                            setFormIsActive(promo.isActive);
                            setFormNote(promo.note || '');
                            setFormExpiresAt(
                              promo.expiresAt ? new Date(promo.expiresAt).toISOString().substring(0, 10) : ''
                            );
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-blue-700 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Редакт.
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(promo)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          {promo.isActive ? 'Выкл.' : 'Вкл.'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(promo)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-red-700 hover:text-red-900 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPromocodes;


