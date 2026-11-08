'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vsm_pwa_banner_dismissed_v1';

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    if (isIos) {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <div className="bg-slate-900 text-white border-b border-slate-800 px-3 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Instale o aplicativo VSM Frota no celular
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                Acesso rápido na tela inicial, tela cheia e funcionamento offline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl shadow-sm active:scale-95 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar App</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fechar aviso de instalação"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIosGuide && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Como instalar no iPhone"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border-t-4 border-sky-500 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Instalar no iPhone / iPad</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adicione o VSM Frota à sua Tela de Início em 2 passos:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-700">
              <li className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl ring-1 ring-slate-200">
                <span className="p-2 rounded-lg bg-sky-100 text-sky-700 font-bold">
                  <Share className="w-4 h-4" />
                </span>
                <span>
                  1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.
                </span>
              </li>
              <li className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl ring-1 ring-slate-200">
                <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                  <PlusSquare className="w-4 h-4" />
                </span>
                <span>
                  2. Role para baixo e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-11 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
