import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, FileText, Table as TableIcon, Bell } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const Reports: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchItem, setSearchItem] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTx = onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubItems(); unsubTx(); };
  }, []);

  const enrichedTransactions = transactions.map(tx => {
    const item = items.find(i => i.id === tx.itemId);
    return { ...tx, itemName: item?.name || 'Unknown', itemCode: item?.code || '-' };
  });

  const filteredData = enrichedTransactions.filter(tx => {
    let match = true;
    
    if (filterType !== 'ALL' && tx.type !== filterType) match = false;
    
    if (searchItem) {
      const term = searchItem.toLowerCase();
      if (!tx.itemName.toLowerCase().includes(term) && !tx.itemCode.toLowerCase().includes(term)) {
        match = false;
      }
    }
    
    if (startDate && tx.date) {
      const txDate = tx.date.toDate();
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (txDate < start) match = false;
    }
    
    if (endDate && tx.date) {
      const txDate = tx.date.toDate();
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (txDate > end) match = false;
    }
    
    return match;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Transaksi Inventaris', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 22);

    const tableColumn = ["Tanggal", "Tipe", "Kode", "Nama Barang", "Jumlah", "PIC", "Peminjam", "Unit", "Keterangan"];
    const tableRows = filteredData.map(tx => [
      tx.date ? format(tx.date.toDate(), 'dd/MM/yyyy HH:mm') : '-',
      tx.type === 'IN' ? 'Masuk' : 'Keluar',
      tx.itemCode,
      tx.itemName,
      tx.quantity.toString(),
      tx.user,
      tx.borrowerName || '-',
      tx.borrowerUnit || '-',
      tx.description
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });
    
    doc.save(`laporan-transaksi-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleExportExcel = () => {
    const excelData = filteredData.map(tx => ({
      'Tanggal': tx.date ? format(tx.date.toDate(), 'dd/MM/yyyy HH:mm') : '-',
      'Tipe': tx.type === 'IN' ? 'Barang Masuk' : 'Barang Keluar',
      'Kode Barang': tx.itemCode,
      'Nama Barang': tx.itemName,
      'Jumlah': tx.quantity,
      'PIC (User)': tx.user,
      'Peminjam': tx.borrowerName || '-',
      'Unit/Kelas': tx.borrowerUnit || '-',
      'Keterangan': tx.description
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
    
    const wscols = [
      { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 40 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `laporan-transaksi-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-900 truncate pr-4">Laporan</h1>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Bell className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      </header>
      
      <div className="p-4 md:p-8 flex-1 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col space-y-6">
        {/* Filter Panel */}
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Filter Laporan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Mulai Tanggal</label>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Sampai Tanggal</label>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Tipe Transaksi</label>
              <select 
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
              >
                <option value="ALL">Semua Transaksi</option>
                <option value="IN">Barang Masuk</option>
                <option value="OUT">Barang Keluar</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Cari Barang</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Nama / Kode" 
                  value={searchItem}
                  onChange={e => setSearchItem(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data View */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Hasil Pencarian</h3>
              <p className="text-sm text-slate-500">Menampilkan <span className="font-bold text-indigo-600">{filteredData.length}</span> transaksi</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportPDF} className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm">
                <FileText className="w-4 h-4" /> Export PDF
              </button>
              <button onClick={handleExportExcel} className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
                <TableIcon className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Tanggal</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Tipe</th>
                  <th className="px-6 py-4 whitespace-nowrap">Barang</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Jumlah</th>
                  <th className="px-6 py-4 whitespace-nowrap">User</th>
                  <th className="px-6 py-4 whitespace-nowrap">Peminjam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap font-medium">
                      {tx.date ? format(tx.date.toDate(), 'dd MMM yyyy, HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tx.type === 'IN' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{tx.itemName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.itemCode}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {tx.quantity}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {tx.user}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {tx.type === 'OUT' ? (
                        <div>
                          <div className="font-semibold text-slate-900">{tx.borrowerName || '-'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{tx.borrowerUnit || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Tidak ada data transaksi yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
