import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, writeBatch, serverTimestamp, orderBy, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowDownLeft, ArrowUpRight, Search, Bell, Trash2 } from 'lucide-react';
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
  const isAdmin = userData?.role === 'admin';
  
  const [transactions, setTransactions] = useState<(Transaction & { itemName?: string })[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [formType, setFormType] = useState<'IN' | 'OUT'>('IN');
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    itemId: '', quantity: 1, description: '', borrowerName: '', borrowerUnit: ''
  });

  const activeLoans = useMemo(() => {
    const loans = new Map<string, { itemId: string, borrowerName: string, borrowerUnit: string, quantityOut: number, quantityIn: number, item?: Item }>();
    
    // Sort transactions oldest to newest to replay
    const sortedTx = [...transactions].sort((a,b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));
    
    for (const tx of sortedTx) {
       if (tx.type === 'OUT' && tx.borrowerName) {
           const key = `${tx.itemId}_${tx.borrowerName.toLowerCase()}_${(tx.borrowerUnit || '').toLowerCase()}`;
           if (!loans.has(key)) {
               loans.set(key, { itemId: tx.itemId, borrowerName: tx.borrowerName, borrowerUnit: tx.borrowerUnit || '', quantityOut: 0, quantityIn: 0, item: items.find(i => i.id === tx.itemId) });
           }
           loans.get(key)!.quantityOut += tx.quantity;
       } else if (tx.type === 'IN' && tx.borrowerName) {
           const key = `${tx.itemId}_${tx.borrowerName.toLowerCase()}_${(tx.borrowerUnit || '').toLowerCase()}`;
           if (loans.has(key)) {
               loans.get(key)!.quantityIn += tx.quantity;
           }
       }
    }

    // Return only those with quantityOut > quantityIn
    return Array.from(loans.values()).filter(l => l.quantityOut > l.quantityIn).map(l => ({
        ...l,
        remaining: l.quantityOut - l.quantityIn
    }));
  }, [transactions, items]);

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
    setSearchItemQuery('');
    setIsDropdownOpen(false);
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
        ...(formData.borrowerName && {
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

  const handleConfirmDeleteTx = async () => {
    if (!isAdmin || !txToDelete) return;
    try {
      await deleteDoc(doc(db, 'transactions', txToDelete));
      setTxToDelete(null);
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus riwayat transaksi.");
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
                  <th className="px-6 py-4 whitespace-nowrap">Peminjam</th>
                  <th className="px-6 py-4 whitespace-nowrap">Petugas</th>
                  <th className="px-6 py-4 whitespace-nowrap">Keterangan</th>
                  {isAdmin && <th className="px-6 py-4 whitespace-nowrap text-center">Aksi</th>}
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
                        {tx.type === 'IN' ? 'Kembali' : 'Dipinjam'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold">
                      <span className={tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {tx.date ? format(tx.date.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {tx.borrowerName ? (
                        <div>
                          <div className="font-medium text-slate-800">{tx.borrowerName}</div>
                          {tx.borrowerUnit && <div className="text-xs text-slate-500">{tx.borrowerUnit}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{tx.user}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setTxToDelete(tx.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Hapus Riwayat">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredTx.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-slate-500">
                      Belum ada data transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formType === 'IN' ? "Barang Kembali (Masuk)" : "Barang Keluar (Pinjam)"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 relative">
            <label className="text-sm font-medium text-slate-700">Pilih Barang</label>
            <div className="relative">
              <input 
                type="text" 
                required={!formData.itemId}
                placeholder={formType === 'IN' ? "Cari nama peminjam atau barang..." : "Cari nama atau kode barang..."} 
                value={searchItemQuery} 
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => { 
                  setSearchItemQuery(e.target.value); 
                  setIsDropdownOpen(true); 
                  if (formData.itemId) setFormData({...formData, itemId: ''}); 
                }}
                className={`w-full px-3 py-2 border ${formData.itemId ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white'} rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none`}
              />
              {formData.itemId && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                  ✓ Terpilih
                </div>
              )}
            </div>
            
            {isDropdownOpen && (
              <div 
                className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto"
                style={{ top: '100%' }}
              >
                {formType === 'IN' && activeLoans
                  .filter(l => (l.item?.name || '').toLowerCase().includes(searchItemQuery.toLowerCase()) || l.borrowerName.toLowerCase().includes(searchItemQuery.toLowerCase()) || (l.item?.code || '').toLowerCase().includes(searchItemQuery.toLowerCase()))
                  .map(loan => (
                    <div 
                      key={`${loan.itemId}_${loan.borrowerName}_${loan.borrowerUnit}`} 
                      onClick={() => {
                        setFormData({...formData, itemId: loan.itemId, borrowerName: loan.borrowerName, borrowerUnit: loan.borrowerUnit, quantity: loan.remaining});
                        setSearchItemQuery(`[${loan.item?.code || '-'}] ${loan.item?.name || '-'} - ${loan.borrowerName}`);
                        setIsDropdownOpen(false);
                      }}
                      className="p-3 cursor-pointer border-b border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-sm text-amber-900">
                             {loan.borrowerName} {loan.borrowerUnit && <span className="text-xs font-normal">({loan.borrowerUnit})</span>}
                          </div>
                          <div className="text-sm text-slate-800 mt-0.5">{loan.item?.name}</div>
                        </div>
                        <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 flex-shrink-0">
                           Dipinjam: {loan.remaining}
                        </div>
                      </div>
                      <div className="text-xs text-amber-700 font-mono mt-1">{loan.item?.code}</div>
                    </div>
                ))}
                {items
                  .filter(i => (i.name + i.code).toLowerCase().includes(searchItemQuery.toLowerCase()))
                  .map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          if (formType === 'OUT' && item.stock <= 0) return;
                          setFormData({...formData, itemId: item.id});
                          setSearchItemQuery(`[${item.code}] ${item.name}`);
                          setIsDropdownOpen(false);
                        }}
                        className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${
                          formType === 'OUT' && item.stock <= 0 
                          ? 'opacity-50 cursor-not-allowed bg-slate-50' 
                          : 'hover:bg-indigo-50 bg-white'
                        }`}
                      >
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-sm text-slate-800">{item.name}</div>
                        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {item.stock > 0 ? `Stok: ${item.stock}` : 'Kosong'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{item.code}</div>
                    </div>
                ))}
                {items.filter(i => (i.name + i.code).toLowerCase().includes(searchItemQuery.toLowerCase())).length === 0 && (
                  formType !== 'IN' || activeLoans.filter(l => (l.item?.name || '').toLowerCase().includes(searchItemQuery.toLowerCase()) || l.borrowerName.toLowerCase().includes(searchItemQuery.toLowerCase())).length === 0
                ) && (
                  <div className="p-4 text-sm text-slate-500 text-center italic">Barang tidak ditemukan</div>
                )}
              </div>
            )}
            
            {/* Hidden overlay to close dropdown when clicking outside */}
            {isDropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Jumlah {formType === 'IN' ? 'Kembali' : 'Dipinjam'}</label>
            <input 
              required 
              type="number" 
              min="1" 
              value={formData.quantity} 
              onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nama Peminjam</label>
              <input 
                required={formType === 'OUT'} 
                type="text" 
                value={formData.borrowerName} 
                onChange={e => setFormData({...formData, borrowerName: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder={formType === 'IN' ? "Peminjam yang mengembalikan..." : "Cth: Budi"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Unit / Kelas</label>
              <input 
                required={formType === 'OUT'} 
                type="text" 
                value={formData.borrowerUnit} 
                onChange={e => setFormData({...formData, borrowerUnit: e.target.value})} 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Cth: Kelas 10A"
              />
            </div>
          </div>

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

      <Modal isOpen={!!txToDelete} onClose={() => setTxToDelete(null)} title="Hapus Riwayat Transaksi">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Yakin ingin menghapus baris riwayat transaksi ini?
          </p>
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs leading-relaxed">
            <strong>Peringatan!</strong> Menghapus histori hanya akan membersihkan rekam jejak pada tabel ini (tindakan tidak mengembalikan stok). Fitur ini ditujukan untuk membersihkan log transaksi yang sudah tidak valid/selesai.
          </div>
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setTxToDelete(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button onClick={handleConfirmDeleteTx} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm">
              Hapus Riwayat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
