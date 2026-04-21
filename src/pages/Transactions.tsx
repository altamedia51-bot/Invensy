import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, writeBatch, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowDownLeft, ArrowUpRight, Search, Bell } from 'lucide-react';
import { Modal } from '../components/Modal';
import { format } from 'date-fns';

interface Item {
  id: string;
  name: string;
  code: string;
  stock: number;
}

interface Transaction {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: any;
  user: string;
  userId: string;
  description: string;
  borrowerName?: string;
  borrowerUnit?: string;
}

export const Transactions: React.FC = () => {
  const { userData } = useAuth();
  
  const [transactions, setTransactions] = useState<(Transaction & { itemName?: string })[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<'IN' | 'OUT'>('IN');
  const [formData, setFormData] = useState({
    itemId: '', quantity: 1, description: '', borrowerName: '', borrowerUnit: ''
  });

  useEffect(() => {
    // Fetch Items early for mapping names
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snapshot) => {
      const itemsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(itemsList);
    });

    const unsubTx = onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
      const txList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txList);
    });

    return () => { unsubItems(); unsubTx(); };
  }, []);

  const handleOpenModal = (type: 'IN' | 'OUT') => {
    setFormType(type);
    setFormData({ itemId: '', quantity: 1, description: '', borrowerName: '', borrowerUnit: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    if (!formData.itemId) {
      alert('Pilih barang!');
      return;
    }

    try {
      const itemRef = doc(db, 'items', formData.itemId);
      const itemSnap = await getDoc(itemRef);
      if (!itemSnap.exists()) throw new Error('Item not found');
      
      const currentStock = itemSnap.data().stock;
      const qty = Number(formData.quantity);
      
      if (formType === 'OUT' && currentStock < qty) {
        alert(`Jumlah tidak mencukupi! Sisa jumlah: ${currentStock}`);
        return;
      }

      const newStock = formType === 'IN' ? currentStock + qty : currentStock - qty;

      const batch = writeBatch(db);
      
      // Update Item Stock
      batch.update(itemRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });

      // Create Transaction Record
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, {
        itemId: formData.itemId,
        type: formType,
        quantity: qty,
        date: serverTimestamp(),
        user: userData.name,
        userId: userData.uid,
        description: formData.description,
        ...(formType === 'OUT' && {
          borrowerName: formData.borrowerName,
          borrowerUnit: formData.borrowerUnit
        })
      });

      await batch.commit();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses transaksi.');
    }
  };

  const enrichedTransactions = transactions.map(tx => {
    const item = items.find(i => i.id === tx.itemId);
    return { ...tx, itemName: item?.name || 'Barang Terhapus', itemCode: item?.code || '-' };
  });

  const filteredTx = enrichedTransactions.filter(tx => 
    tx.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Transaksi</h1>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="relative mr-2 hidden md:block">
            <Bell className="w-6 h-6 text-slate-400" />
          </div>
          <button 
            onClick={() => handleOpenModal('IN')} 
            className="flex items-center gap-1 md:gap-2 bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <ArrowDownLeft className="w-4 h-4" /> <span className="hidden md:inline">Masuk</span><span className="md:hidden">IN</span>
          </button>
          <button 
            onClick={() => handleOpenModal('OUT')} 
            className="flex items-center gap-1 md:gap-2 bg-rose-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" /> <span className="hidden md:inline">Keluar</span><span className="md:hidden">OUT</span>
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari transaksi by user, barang, kode..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Riwayat Transaksi Terkini</h3>
            <span className="flex items-center gap-2 text-xs text-emerald-500 font-semibold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Barang & Kode</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Tipe</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Jumlah</th>
                  <th className="px-6 py-4 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 whitespace-nowrap">Petugas</th>
                  <th className="px-6 py-4 whitespace-nowrap">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{tx.itemName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.itemCode}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tx.type === 'IN' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold">
                      <span className={tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                        {tx.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {tx.date ? format(tx.date.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{tx.user}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                  </tr>
                ))}
                {filteredTx.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Belum ada data transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formType === 'IN' ? "Input Barang Masuk" : "Input Barang Keluar"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Pilih Barang</label>
            <select 
              required 
              value={formData.itemId} 
              onChange={e => setFormData({...formData, itemId: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="" disabled>-- Pilih Barang --</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  [{item.code}] {item.name} (Tersisa: {item.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Jumlah {formType === 'IN' ? 'Masuk' : 'Keluar'}</label>
            <input 
              required 
              type="number" 
              min="1" 
              value={formData.quantity} 
              onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          {formType === 'OUT' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Nama Peminjam</label>
                <input 
                  required 
                  type="text" 
                  value={formData.borrowerName} 
                  onChange={e => setFormData({...formData, borrowerName: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Cth: Budi"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Unit / Kelas</label>
                <input 
                  required 
                  type="text" 
                  value={formData.borrowerUnit} 
                  onChange={e => setFormData({...formData, borrowerUnit: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Cth: Kelas 10A"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Keterangan / Tujuan Penggunaan</label>
            <textarea 
              required 
              rows={3}
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
              placeholder={formType === 'OUT' ? "Digunakan untuk..." : "Dari supplier..."}
            />
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button type="submit" className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm ${formType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              Simpan Transaksi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
