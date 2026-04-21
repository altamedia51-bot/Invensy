import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, Bell, Download, Upload, Folder, ArrowLeft, Package } from 'lucide-react';
import Papa from 'papaparse';
import { Modal } from '../components/Modal';

interface Item {
  id: string;
  name: string;
  code: string;
  category: string;
  stock: number;
  location: string;
  condition?: string;
}

export const Items: React.FC = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '', code: '', category: '', stock: 0, location: '', condition: 'Baik'
  });
  
  const [rooms, setRooms] = useState<{id: string, name: string}[]>([]);
  const [filterRoom, setFilterRoom] = useState('');
  const [viewMode, setViewMode] = useState<'rooms' | 'items'>('rooms');

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribeItems = onSnapshot(q, (querySnapshot) => {
      const itemsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(itemsList);
    });
    
    // Fetch rooms
    const qRooms = query(collection(db, 'rooms'));
    const unsubscribeRooms = onSnapshot(qRooms, (qs) => {
      setRooms(qs.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    return () => {
      unsubscribeItems();
      unsubscribeRooms();
    };
  }, []);

  const handleOpenModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name, code: item.code, category: item.category, stock: item.stock, location: item.location, condition: item.condition || 'Baik'
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', code: '', category: '', stock: 0, location: '', condition: 'Baik' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingItem) {
        const itemRef = doc(db, 'items', editingItem.id);
        await updateDoc(itemRef, {
          ...formData,
          stock: Number(formData.stock),
          updatedAt: serverTimestamp()
        });
      } else {
        const newItemRef = doc(collection(db, 'items'));
        await setDoc(newItemRef, {
          ...formData,
          stock: Number(formData.stock),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error saving item');
    }
  };

  const confirmDelete = async () => {
    if (!isAdmin || !itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'items', itemToDelete.id));
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Error deleting item');
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "KODE_BARANG,NAMA_BARANG,KATEGORI,JUMLAH_AWAL,LOKASI,KONDISI\nBRG-001,Laptop Asus,Elektronik,10,Gudang A,Baik";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_barang.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          for (const row of data) {
            if (!row.KODE_BARANG || !row.NAMA_BARANG) continue;

            const newItemRef = doc(collection(db, 'items'));
            await setDoc(newItemRef, {
              code: row.KODE_BARANG.substring(0, 50),
              name: row.NAMA_BARANG.substring(0, 150),
              category: (row.KATEGORI || '').substring(0, 50),
              stock: Math.max(0, Number(row.JUMLAH_AWAL || row.STOK_AWAL) || 0),
              location: (row.LOKASI || '').substring(0, 100),
              condition: (row.KONDISI || 'Baik').substring(0, 50),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          alert(`Selesai memproses ${data.length} baris dari CSV!`);
        } catch (error) {
          console.error("Bulk upload err:", error);
          alert("Gagal mengunggah data CSV.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        alert("Gagal membaca file CSV. Pastikan format benar.");
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const filteredItems = items.filter(item => 
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterRoom === '' || item.location === filterRoom)
  );

  // Auto-switch to items view when searching
  useEffect(() => {
    if (searchTerm.length > 0 && viewMode === 'rooms') {
      setViewMode('items');
      setFilterRoom('');
    }
  }, [searchTerm]);

  const roomStats = useMemo(() => {
    const stats: Record<string, { types: number, stock: number }> = {};
    const initStat = (name: string) => { if (!stats[name]) stats[name] = { types: 0, stock: 0 }; };
    
    rooms.forEach(r => initStat(r.name));
    initStat('Semua Ruangan');
    initStat('Tanpa Ruangan');

    items.forEach(item => {
      const loc = item.location && stats[item.location] ? item.location : 'Tanpa Ruangan';
      if (!stats[loc]) initStat(loc);
      
      stats[loc].types += 1;
      stats[loc].stock += item.stock;
      
      stats['Semua Ruangan'].types += 1;
      stats['Semua Ruangan'].stock += item.stock;
    });
    
    return stats;
  }, [items, rooms]);

  const uniqueCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean))).sort();

  return (
    <div className="flex flex-col h-full w-full">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Master Data</h1>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="relative hidden md:block">
            <Bell className="w-6 h-6 text-slate-400" />
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDownloadTemplate}
                className="hidden md:flex bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors items-center gap-2"
                title="Download Template CSV"
              >
                <Download className="w-4 h-4" />
                Template
              </button>

              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="hidden md:flex bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-colors items-center gap-2 disabled:opacity-70"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Proses...' : 'Upload CSV'}
              </button>

              <button 
                onClick={() => handleOpenModal()} 
                className="bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4 md:hidden" />
                <span className="hidden md:inline">+ Tambah</span>
                <span className="md:hidden">Tambah</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama, kode, atau kategori..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
          </div>
          <div className="relative">
             <select 
                value={filterRoom} 
                onChange={e => {
                  setFilterRoom(e.target.value);
                  setViewMode('items');
                }}
                className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Semua Ruangan</option>
                <option value="Tanpa Ruangan">Tanpa Ruangan</option>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
             </div>
          </div>
        </div>

        {viewMode === 'rooms' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
            <div 
              onClick={() => { setFilterRoom(''); setViewMode('items'); }}
              className="bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 p-6 rounded-2xl cursor-pointer transition-colors group flex flex-col"
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-105 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">Semua Barang</h3>
              <div className="text-sm text-slate-500 flex justify-between mt-auto">
                <span>{roomStats['Semua Ruangan']?.types || 0} Jenis</span>
                <span className="font-semibold text-indigo-600">{roomStats['Semua Ruangan']?.stock || 0} Total Stok</span>
              </div>
            </div>

            {rooms.map(room => (
              <div 
                key={room.id}
                onClick={() => { setFilterRoom(room.name); setViewMode('items'); }}
                className="bg-white hover:bg-slate-50 border border-slate-200 p-6 rounded-2xl cursor-pointer transition-colors shadow-sm group flex flex-col"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1 truncate" title={room.name}>{room.name}</h3>
                <div className="text-sm text-slate-500 flex justify-between mt-auto">
                  <span>{roomStats[room.name]?.types || 0} Jenis</span>
                  <span className="font-semibold text-slate-700">{roomStats[room.name]?.stock || 0} Total Stok</span>
                </div>
              </div>
            ))}

            <div 
              onClick={() => { setFilterRoom('Tanpa Ruangan'); setViewMode('items'); }}
              className="bg-white hover:bg-slate-50 border border-slate-200 border-dashed p-6 rounded-2xl cursor-pointer transition-colors group flex flex-col"
            >
              <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed flex items-center justify-center text-slate-400 mb-4 group-hover:bg-slate-100 transition-colors">
                <Folder className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-600 text-lg mb-1">Belum Dialokasikan</h3>
              <div className="text-sm text-slate-500 flex justify-between mt-auto">
                <span>{roomStats['Tanpa Ruangan']?.types || 0} Jenis</span>
                <span className="font-semibold text-slate-600">{roomStats['Tanpa Ruangan']?.stock || 0} Total Stok</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setViewMode('rooms'); setSearchTerm(''); setFilterRoom(''); }}
                  className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  title="Kembali ke Mode Ruangan"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {filterRoom === '' ? 'Semua Ruangan' : filterRoom === 'Tanpa Ruangan' ? 'Belum Dialokasikan' : filterRoom}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Melihat daftar rincian barang</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">{filteredItems.length} Item Ditampilkan</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Barang & Kode</th>
                  <th className="px-6 py-4 whitespace-nowrap">Kategori</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Jumlah</th>
                  <th className="px-6 py-4 whitespace-nowrap">Kondisi</th>
                  <th className="px-6 py-4 whitespace-nowrap">Lokasi</th>
                  {isAdmin && <th className="px-6 py-4 whitespace-nowrap text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{item.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{item.category}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-base font-bold text-slate-900">{item.stock}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.condition?.toLowerCase().includes('rusak') 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                          : item.condition?.toLowerCase() === 'kurang baik' || item.condition?.toLowerCase().includes('perbaikan')
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {item.condition || 'Baik'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.location}</td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setItemToDelete({id: item.id, name: item.name})} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-slate-500">
                      Tidak ada data barang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Barang" : "Tambah Barang"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Kode Barang</label>
              <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: BRG-001" disabled={!!editingItem} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Kategori</label>
              <input required type="text" list="category-options" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Elektronik" />
              <datalist id="category-options">
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nama Barang</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Jumlah Awal</label>
              <input required type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" disabled={!!editingItem} title={editingItem ? "Gunakan fitur transaksi untuk mengubah jumlah barang" : ""} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Lokasi Penyimpanan</label>
              <div className="relative">
                <select 
                  required 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                >
                  <option value="" disabled>Pilih Ruangan...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Kondisi Barang</label>
            <div className="relative">
              <select 
                required 
                value={formData.condition || 'Baik'} 
                onChange={e => setFormData({...formData, condition: e.target.value})} 
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
              >
                <option value="Baik">Baik</option>
                <option value="Kurang Baik">Kurang Baik</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak Berat">Rusak Berat</option>
                <option value="Perlu Perbaikan">Perlu Perbaikan</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Simpan</button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} title="Konfirmasi Hapus">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Yakin ingin menghapus master data <strong>{itemToDelete?.name}</strong>?
          </p>
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs leading-relaxed">
            <strong>Peringatan!</strong> Menghapus master data barang dapat mempengaruhi riwayat transaksi yang merujuk pada barang ini. Operasi ini tidak dapat dibatalkan.
          </div>
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setItemToDelete(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm">
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
