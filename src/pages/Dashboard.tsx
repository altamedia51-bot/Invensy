import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowDownLeft, ArrowUpRight, LifeBuoy, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7));
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('date', '>=', sevenDaysAgo), orderBy('date', 'desc')), 
      (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );
    return () => { unsubItems(); unsubTx(); };
  }, []);

  const totalStock = items.reduce((sum, item) => sum + Number(item.stock || 0), 0);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  
  const todayTransactions = transactions.filter(tx => {
    if (!tx.date) return false;
    const txDate = tx.date.toDate();
    return txDate >= todayStart && txDate <= todayEnd;
  });

  const inToday = todayTransactions.filter(tx => tx.type === 'IN').reduce((sum, tx) => sum + Number(tx.quantity), 0);
  const outToday = todayTransactions.filter(tx => tx.type === 'OUT').reduce((sum, tx) => sum + Number(tx.quantity), 0);
  const out7Days = transactions.filter(tx => tx.type === 'OUT').reduce((sum, tx) => sum + Number(tx.quantity), 0);
  const totalTxCountToday = todayTransactions.length;

  const chartData = useMemo(() => {
    const data: Record<string, { IN: number, OUT: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'MMM dd');
      data[dateStr] = { IN: 0, OUT: 0 };
    }
    transactions.forEach(tx => {
      if (!tx.date) return;
      const dateStr = format(tx.date.toDate(), 'MMM dd');
      if (data[dateStr]) {
        if (tx.type === 'IN') data[dateStr].IN += Number(tx.quantity);
        else data[dateStr].OUT += Number(tx.quantity);
      }
    });

    return Object.keys(data).map(key => ({
      name: key,
      Masuk: data[key].IN,
      Keluar: data[key].OUT
    }));
  }, [transactions]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            {out7Days > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full"></span>
            )}
            <Bell className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col">
        {/* Statistics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Total Item</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900 px-1">{totalStock}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Masuk (Hari Ini)</p>
              <p className="text-xl md:text-2xl font-bold text-slate-900 px-1">{inToday}</p>
            </div>
          </div>

          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Keluar (Hari Ini)</p>
              <p className="text-xl md:text-2xl font-bold text-indigo-600 px-1">{outToday}</p>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-100 p-4 md:p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-bold text-rose-500 uppercase tracking-wider mb-1 px-1 truncate">Total Item Keluar</p>
              <p className="text-xl md:text-2xl font-bold text-rose-700 px-1">{out7Days}</p>
            </div>
          </div>
        </section>

        {/* Desktop View: Split Layout */}
        <section className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 lg:min-h-[400px]">
          {/* Main Chart Area */}
          <div className="flex-[3] bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Aktivitas 7 Hari Terakhir</h3>
              <span className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-emerald-500 font-semibold">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="hidden md:inline">LIVE MONITORING</span>
                <span className="md:hidden">LIVE</span>
              </span>
            </div>
            <div className="flex-1 p-4 md:p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Masuk" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Keluar" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sidemenu Items */}
          <div className="flex-1 flex flex-col gap-6 w-full lg:w-80">
            {/* Notification List */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-y-auto">
              <h3 className="font-bold text-slate-900 mb-4 tracking-tight">Notifikasi Barang Keluar</h3>
              <div className="space-y-4">
                {transactions.filter(tx => tx.type === 'OUT').length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">Belum ada barang keluar.</p>
                ) : (
                  transactions.filter(tx => tx.type === 'OUT').slice(0, 5).map(tx => {
                    const item = items.find(i => i.id === tx.itemId);
                    return (
                      <div key={tx.id} className="flex gap-3 items-start">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item?.name || 'Barang Terhapus'}</p>
                          <p className="text-xs text-slate-500">{tx.date ? new Date(tx.date.toDate()).toLocaleDateString('id-ID') : ''} - Sebanyak: {tx.quantity}</p>
                        </div>
                      </div>
                    )
                  })
                )}
                {transactions.filter(tx => tx.type === 'OUT').length > 5 && (
                  <p className="text-xs text-slate-500 mt-2 font-medium">+{transactions.filter(tx => tx.type === 'OUT').length - 5} riwayat keluar lainnya</p>
                )}
              </div>
            </div>

            {/* Support Box */}
            <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-bold mb-2">Pusat Bantuan</h3>
              <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                Ada kendala dalam sistem pencatatan Invensy? Hubungi administrator atau IT Support sekarang.
              </p>
              <button className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg w-fit">
                 <LifeBuoy className="w-4 h-4" />
                 Hubungi Support
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
