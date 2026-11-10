'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vsm_pwa_banner_dismissed_v1';
const INSTALLED_KEY = 'vsm_pwa_installed_v1';

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function checkIsMobilePhone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = window.innerWidth <= 900;
  return mobileUa && (coarsePointer || smallScreen);
}

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const standalone = checkStandalone();
    setIsStandalone(standalone);
    setIsMobile(checkIsMobilePhone());

    if (standalone) {
      localStorage.setItem(INSTALLED_KEY, '1');
      return;
    }

    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        localStorage.setItem(INSTALLED_KEY, '1');
      }
    };

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (!checkStandalone() && checkIsMobilePhone()) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      localStorage.setItem(INSTALLED_KEY, '1');
    };

    mediaQuery.addEventListener?.('change', onDisplayModeChange);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      mediaQuery.removeEventListener?.('change', onDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  // Mostra APENAS em celulares e NUNCA quando já está aberto dentro do app PWA instalado
  if (!isMobile || isStandalone || dismissed) return null;
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
        setIsStandalone(true);
        localStorage.setItem(INSTALLED_KEY, '1');
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
                Abre direto na tela inicial e funciona mesmo sem internet
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
                  Coloque o aplicativo na tela inicial do celular em 2 passos:
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

            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl ring-1 ring-slate-200">
                <span className="p-2 rounded-lg bg-sky-100 text-sky-700 font-bold">
                  <Share className="w-4 h-4" />
                </span>
                <span>
                  1. Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                </span>
              </li>
              <li className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl ring-1 ring-slate-200">
                <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                  <PlusSquare className="w-4 h-4" />
                </span>
                <span>
                  2. Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-12 rounded-xl bg-slate-900 text-white text-sm font-bold"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
