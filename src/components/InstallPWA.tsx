import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface InstallPWAProps {
  variant?: 'sidebar' | 'dashboard';
}

export const InstallPWA: React.FC<InstallPWAProps> = ({ variant = 'sidebar' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed/standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('PWA: beforeinstallprompt fired');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, we can show it if not standalone
    if (ios && !standalone) {
      setIsInstallable(true);
    }

    // DEBUG: On some browsers it might not fire immediately
    // or meeting PWA criteria might take a few seconds
    const timeout = setTimeout(() => {
      if (ios && !standalone) setIsInstallable(true);
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert('Untuk menginstal di iOS:\n1. Klik tombol "Share" (kotak dengan panah ke atas) di bawah\n2. Gulir ke bawah dan klik "Add to Home Screen" atau "Tambah ke Layar Utama"');
      return;
    }

    if (!deferredPrompt) {
      alert('Fitur instalasi belum siap atau tidak didukung oleh browser Anda. Pastikan Anda menggunakan Chrome/Edge dan sudah login.');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (isStandalone) {
    return null;
  }

  if (variant === 'dashboard') {
    return (
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 text-sm font-bold bg-white text-indigo-600 hover:bg-indigo-50 transition-colors px-4 py-2 rounded-lg w-fit shadow-md mt-2 uppercase"
      >
        <Download className="w-4 h-4 shrink-0" />
        Instal Aplikasi
      </button>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm mb-2 uppercase tracking-tight"
    >
      <Download className="w-4 h-4 mr-2 shrink-0" />
      Instal Aplikasi
    </button>
  );
};
