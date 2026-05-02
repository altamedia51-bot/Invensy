import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowRightLeft, FileText, MapPin, Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface BottomNavProps {
  onMenuClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick }) => {
  const { userData } = useAuth();
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'petugas'] },
    { name: 'Inventory', path: '/items', icon: Package, roles: ['admin', 'petugas'] },
    { name: 'Ruangan', path: '/rooms', icon: MapPin, roles: ['admin', 'petugas'] },
    { name: 'Laporan', path: '/reports', icon: FileText, roles: ['admin', 'petugas'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(userData?.role || ''));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1 z-40 transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isSpecial = item.name === 'Ruangan';

          if (isSpecial) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center -mt-8 mx-1 z-10",
                  "transition-all duration-300 transform active:scale-95"
                )}
              >
                {({ isActive }) => (
                  <>
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all",
                      "border-4 border-white dark:border-slate-900",
                      isActive 
                        ? "bg-indigo-600 text-white scale-110" 
                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold mt-1 tracking-tight text-center uppercase",
                      isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {item.name}
                    </span>
                  </>
                )}
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all grow",
                isActive 
                  ? "text-indigo-600 dark:text-indigo-400" 
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", "transition-transform duration-200")} />
              <span className="text-[10px] font-medium transition-colors tracking-tight text-center">
                {item.name}
              </span>
            </NavLink>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all grow text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <MenuIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium transition-colors tracking-tight text-center">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
};
