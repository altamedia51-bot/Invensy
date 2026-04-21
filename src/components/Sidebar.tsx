import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowRightLeft, FileText, LogOut, Users, MapPin, Moon, Sun } from 'lucide-react';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'petugas'] },
  { name: 'Master Ruangan', path: '/rooms', icon: MapPin, roles: ['admin', 'petugas'] },
  { name: 'Master Data', path: '/items', icon: Package, roles: ['admin', 'petugas'] },
  { name: 'Transaksi', path: '/transactions', icon: ArrowRightLeft, roles: ['admin', 'petugas'] },
  { name: 'Laporan', path: '/reports', icon: FileText, roles: ['admin', 'petugas'] },
  { name: 'Pengguna', path: '/users', icon: Users, roles: ['admin'] },
];

export const Sidebar: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  return (
    <aside className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-200 transition-colors">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">I</div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Invensy</span>
        </div>
        <button 
          onClick={toggleTheme} 
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
        {navItems.filter(item => item.roles.includes(userData?.role || '')).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => cn(
                "px-4 py-2.5 rounded-lg flex items-center gap-3 font-medium transition-colors",
                isActive 
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" 
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-4 flex flex-col gap-4 shadow-sm border border-transparent dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 dark:bg-slate-800 flex items-center justify-center font-bold uppercase shrink-0">
              {userData?.name?.substring(0, 2) || 'AD'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{userData?.name}</p>
              <p className="text-xs text-slate-400 capitalize truncate">{userData?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 dark:bg-slate-900 text-slate-300 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2 shrink-0" />
            Logout Account
          </button>
        </div>
      </div>
    </aside>
  );
};
