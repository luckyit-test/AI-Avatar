import React, { useState } from 'react';
import AdminOrders from './AdminOrders';
import AdminPromocodes from './AdminPromocodes';

interface AdminDashboardProps {
  initialTab?: 'orders' | 'promos';
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab = 'orders' }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'promos'>(initialTab);

  const handleTabChange = (tab: 'orders' | 'promos') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('admin', tab === 'orders' ? '1' : 'promo');
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="w-full border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Админка NEWAVA.pro</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Управление заказами, генерациями и промокодами.
            </p>
          </div>
          <a
            href="/"
            className="text-xs text-slate-500 hover:text-slate-900 underline decoration-dotted"
          >
            Назад к сервису
          </a>
        </div>
        <div className="border-t bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex space-x-4">
              <button
                type="button"
                onClick={() => handleTabChange('orders')}
                className={`py-2 px-3 text-sm border-b-2 ${
                  activeTab === 'orders'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                Заказы
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('promos')}
                className={`py-2 px-3 text-sm border-b-2 ${
                  activeTab === 'promos'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                Промокоды
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {activeTab === 'orders' ? <AdminOrders embedded /> : <AdminPromocodes />}
      </main>
    </div>
  );
};

export default AdminDashboard;


