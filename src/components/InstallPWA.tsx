import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export const InstallPWA: React.FC = () => {
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
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also check if we can show it for iOS users
    if (ios && !standalone) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert('Untuk menginstal di iOS:\n1. Klik tombol "Share" (kotak dengan panah ke atas) di bawah\n2. Gulir ke bawah dan klik "Add to Home Screen" atau "Tambah ke Layar Utama"');
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable || isStandalone) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm mb-2"
    >
      <Download className="w-4 h-4 mr-2 shrink-0" />
      Install App
    </button>
  );
};
