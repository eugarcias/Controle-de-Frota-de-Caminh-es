'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard,
  Fuel,
  Wrench,
  Navigation,
  CalendarClock,
  Users,
  LogOut,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [leaving, setLeaving] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', short: 'Início', icon: LayoutDashboard },
    { id: 'quick-entry', label: 'Lançar Abastecimento', short: 'Lançar', icon: Fuel },
    { id: 'trips', label: 'Fretes', short: 'Fretes', icon: Navigation },
    { id: 'schedule', label: 'Agenda de Cargas', short: 'Agenda', icon: CalendarClock },
    { id: 'maintenance', label: 'Oficina', short: 'Oficina', icon: Wrench },
    { id: 'registrations', label: 'Cadastros e Senhas', short: 'Cadastros', icon: Users },
  ];

  const go = (id: string) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logout = async () => {
    if (!confirm('Deseja sair do sistema?')) return;
    setLeaving(true);
    try {
      await createSupabaseBrowser().auth.signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white shadow-md border-b border-zinc-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-20 gap-3">
            {/* Logo */}
            <button
              type="button"
              onClick={() => go('dashboard')}
              aria-label="VSM Garcia - Ir para início"
              className="bg-white rounded-xl px-2 py-1 shrink-0"
            >
              <Image
                src="/logo.png"
                alt="VSM Garcia"
                width={950}
                height={440}
                priority
                className="h-9 sm:h-12 w-auto object-contain"
              />
            </button>

            {/* Título da aba atual no celular */}
            <span className="lg:hidden flex-1 truncate text-sm font-bold text-zinc-200">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>

            {/* Menu Desktop */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Menu principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/app/driver"
                title="Abrir App do Motorista"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold transition"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Modo Motorista</span>
              </Link>

              <button
                type="button"
                onClick={logout}
                disabled={leaving}
                aria-label="Sair do sistema"
                title="Sair do sistema"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-50 text-xs font-bold transition"
              >
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu inferior no celular */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-black border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
        aria-label="Menu móvel"
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
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] px-0.5 text-[10px] font-bold transition-colors ${
                  isActive ? 'text-white' : 'text-zinc-400 active:text-white'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
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
