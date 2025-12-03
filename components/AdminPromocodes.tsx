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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">Управление промокодами</h2>
        <p className="text-xs text-slate-500">
          Каждый промокод даёт ограниченное количество бесплатных генераций. Код — 6 символов (латиница и цифры).
        </p>
      </div>

      {/* Форма добавления/редактирования */}
      <div className="mb-6 rounded-lg border bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Промокод</label>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              className="w-full border rounded px-2 py-1.5 text-sm tracking-[0.2em] uppercase"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Макс. активаций</label>
            <input
              type="number"
              min={1}
              value={formMaxUses}
              onChange={(e) => setFormMaxUses(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Активен</label>
            <div className="flex items-center h-9">
              <input
                id="promo-active"
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="promo-active" className="text-xs text-slate-700">
                Можно использовать
              </label>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Истекает (опц.)</label>
            <input
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Комментарий (опц.)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Например, партнёры, январь 2026"
              className="w-full border rounded px-2 py-1.5 text-xs"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохраняем…' : 'Сохранить промокод'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* Список промокодов */}
      <div className="rounded-lg border bg-white">
        {isLoading && (
          <p className="text-sm text-slate-600 p-4">Загружаем промокоды…</p>
        )}
        {!isLoading && promos.length === 0 && (
          <p className="text-sm text-slate-500 p-4">Промокоды пока не созданы.</p>
        )}
        {!isLoading && promos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Код</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Статус</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Макс.</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Использовано</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Осталось</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Создан</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Обновлён</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Истекает</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Комментарий</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promos.map((promo) => (
                  <tr key={promo.code} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-800 tracking-[0.2em] uppercase">
                      {promo.code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {promo.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Недействующий
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-center">
                      {promo.maxUses}
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-center">
                      {promo.usedCount}
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-center">
                      {promo.remainingUses}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatDateTime(promo.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatDateTime(promo.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatDateTime(promo.expiresAt ?? null)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 max-w-xs truncate" title={promo.note || ''}>
                      {promo.note || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap space-x-2">
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
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(promo)}
                        className="text-xs text-slate-600 hover:underline"
                      >
                        {promo.isActive ? 'Выключить' : 'Включить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(promo)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
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


