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
      <header className="w-full border-b bg-white shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Админка NEWAVA.pro</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Управление заказами, генерациями и промокодами
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors underline decoration-dotted underline-offset-2"
            >
              ← Назад к сервису
            </a>
          </div>
        </div>
        <div className="border-t bg-slate-50/50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto -mb-px">
              <button
                type="button"
                onClick={() => handleTabChange('orders')}
                className={`py-3 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Заказы
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('promos')}
                className={`py-3 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'promos'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
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


