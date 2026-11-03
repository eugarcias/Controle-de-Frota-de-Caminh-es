'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { LayoutDashboard, Fuel, Wrench, Navigation, CalendarClock, Users, LogOut, Loader2 } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [leaving, setLeaving] = useState(false);

  // `short` é o rótulo do menu inferior no celular (6 itens precisam caber em ~360px)
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', short: 'Início', icon: LayoutDashboard },
    { id: 'quick-entry', label: 'Lançamento Rápido', short: 'Lançar', icon: Fuel },
    { id: 'trips', label: 'Fretes', short: 'Fretes', icon: Navigation },
    { id: 'schedule', label: 'Agenda de Cargas', short: 'Agenda', icon: CalendarClock },
    { id: 'maintenance', label: 'Manutenção', short: 'Manut.', icon: Wrench },
    { id: 'registrations', label: 'Cadastros', short: 'Cadastros', icon: Users },
  ];

  const go = (id: string) => {
    setActiveTab(id);
    window.scrollTo({ top: 0 });
  };

  const logout = async () => {
    if (!confirm('Sair do sistema?')) return;
    setLeaving(true);
    try {
      await createSupabaseBrowser().auth.signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white shadow-lg border-b-2 border-sky-500 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-20 gap-3">
            {/* Logo */}
            <button
              type="button"
              onClick={() => go('dashboard')}
              aria-label="VSM Garcia - ir para o dashboard"
              className="bg-white rounded-lg sm:rounded-xl px-1.5 py-0.5 sm:px-2 sm:py-1 shrink-0 shadow-md shadow-sky-500/20"
            >
              <Image
                src="/logo.png"
                alt="VSM Garcia"
                width={950}
                height={440}
                priority
                className="h-10 sm:h-14 w-auto"
              />
            </button>

            {/* Título da aba atual (só no celular, onde o menu fica embaixo) */}
            <span className="lg:hidden flex-1 truncate text-sm font-bold text-sky-300">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>

            {/* Menu Desktop */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-sky-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              aria-label="Sair"
              title="Sair"
              className="shrink-0 inline-flex items-center gap-2 p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-zinc-900 disabled:opacity-50"
            >
              {leaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              <span className="hidden xl:inline text-sm font-semibold">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Menu inferior (celular / tablet), no estilo de aplicativo */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-black border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
        aria-label="Principal (mobile)"
      >
        <div className="grid grid-cols-6 max-w-xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center gap-1 min-h-16 px-0.5 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-sky-400' : 'text-slate-400 active:text-slate-200'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-11 h-7 rounded-full transition-colors ${
                    isActive ? 'bg-sky-500/20' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="truncate max-w-full">{item.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
