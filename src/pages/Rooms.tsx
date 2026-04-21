import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Search, Edit2, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';

interface Room {
  id: string;
  name: string;
  description: string;
  manager: string;
}

export const Rooms: React.FC = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<{ id: string, name: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', manager: '' });

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'rooms'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const roomList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomList);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const handleOpenModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setFormData({ 
        name: room.name, 
        description: room.description, 
        manager: room.manager || '' 
      });
    } else {
      setEditingRoom(null);
      setFormData({ name: '', description: '', manager: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingRoom) {
        const roomRef = doc(db, 'rooms', editingRoom.id);
        await updateDoc(roomRef, {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        const newRoomRef = doc(collection(db, 'rooms'));
        await setDoc(newRoomRef, {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error saving room');
    }
  };

  const confirmDelete = async () => {
    if (!isAdmin || !roomToDelete) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomToDelete.id));
      setRoomToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Error deleting room');
    }
  };

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    room.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.manager || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">Akses Ditolak. Anda bukan admin.</div>;
  }

  return (
    <div className="flex flex-col h-full w-full">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Master Ruangan</h1>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
        >
          <span className="hidden md:inline">+ Tambah Ruangan</span>
          <span className="md:hidden">+ Tambah</span>
        </button>
      </header>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-5xl mx-auto flex flex-col">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama atau keterangan..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Daftar Ruangan</h3>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{filteredRooms.length} Ruangan</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Nama Ruangan</th>
                  <th className="px-6 py-4 whitespace-nowrap">Penanggung Jawab</th>
                  <th className="px-6 py-4 whitespace-nowrap">Keterangan</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRooms.map(room => (
                  <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold flex items-center gap-2 text-slate-900">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        {room.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{room.manager || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{room.description || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenModal(room)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRoomToDelete(room)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRooms.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">
                      Tidak ada data ruangan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRoom ? "Edit Ruangan" : "Tambah Ruangan"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nama Ruangan</label>
            <input 
              required 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Cth: Gudang A"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Penanggung Jawab</label>
            <input 
              required 
              type="text" 
              value={formData.manager} 
              onChange={e => setFormData({...formData, manager: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Cth: Budi Santoso"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Keterangan (Opsional)</label>
            <textarea 
              rows={3}
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
              placeholder="Cth: Tempat penyimpanan barang elektronik..."
            />
          </div>
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Simpan</button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!roomToDelete} onClose={() => setRoomToDelete(null)} title="Konfirmasi Hapus">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Yakin ingin menghapus ruangan <strong>{roomToDelete?.name}</strong>?
          </p>
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs leading-relaxed">
            <strong>Peringatan!</strong> Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada barang yang terkait dengan ruangan ini sebelum menghapusnya.
          </div>
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setRoomToDelete(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm">
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
