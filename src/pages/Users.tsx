import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, registerUserSecondary } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users as UsersIcon, Search, Shield, User, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';

export const Users: React.FC = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'petugas'
  });

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const handleOpenModal = () => {
    setFormData({ name: '', email: '', password: '', role: 'petugas' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      // 1. Create User in Auth using secondary app
      const resultUser = await registerUserSecondary(formData.email, formData.password);
      
      // 2. Add User to Firestore Users Collection (this works because we are still logged in as admin in the primary app)
      const userDocRef = doc(db, 'users', resultUser.uid);
      await setDoc(userDocRef, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Gagal menambah pengguna: ' + (err.message || 'Error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, role: string) => {
    if (!isAdmin) return;
    if (role === 'admin') {
      alert('Tidak dapat menghapus akun admin dari sini.');
      return;
    }
    if (!window.confirm('Yakin ingin menghapus data pengguna ini? Catatan: Akses otentikasinya tidak akan dihapus otomatis dari console, harap atur melalui Firebase Console apabila perlu.')) return;
    
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      console.error(err);
      alert('Error deleting user');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">Akses Ditolak. Anda bukan admin.</div>;
  }

  return (
    <div className="flex flex-col h-full w-full">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Pengguna</h1>
        <button 
          onClick={handleOpenModal} 
          className="bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
        >
          <span className="hidden md:inline">+ Tambah Pengguna</span>
          <span className="md:hidden">+ Tambah</span>
        </button>
      </header>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-5xl mx-auto flex flex-col">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari pengguna berdasarkan nama/email..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Daftar Pengguna</h3>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{filteredUsers.length} Users</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Nama Pengguna</th>
                  <th className="px-6 py-4 whitespace-nowrap">Role</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {user.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDelete(user.id, user.role)} 
                        disabled={user.role === 'admin'}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title={user.role === 'admin' ? "Admin tidak dapat dihapus" : "Hapus user"}
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">
                      Tidak ada pengguna yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tambah Pengguna Baru">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
            <input 
              required 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Email (Username)</label>
            <input 
              required 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="contoh@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input 
              required 
              type="password" 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="Minimal 6 karakter"
              minLength={6}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Peran (Role)</label>
            <select 
              required 
              value={formData.role} 
              onChange={e => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="petugas">Petugas (Hanya Input Transaksi)</option>
              <option value="admin">Admin (Akses Penuh)</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-transparent rounded-lg transition-colors">Batal</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-70">
              {isLoading ? 'Menyimpan...' : 'Simpan Pengguna'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
