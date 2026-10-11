'use client';

import React from 'react';
import Image from 'next/image';
import { LayoutDashboard, Fuel, Wrench, Navigation, CalendarClock, Users } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quick-entry', label: 'Lançamento Rápido', icon: Fuel },
    { id: 'trips', label: 'Fretes', icon: Navigation },
    { id: 'schedule', label: 'Agenda de Cargas', icon: CalendarClock },
    { id: 'maintenance', label: 'Manutenção', icon: Wrench },
    { id: 'registrations', label: 'Cadastros', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black text-white shadow-lg border-b-2 border-sky-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            aria-label="VSM Garcia - ir para o dashboard"
            className="bg-white rounded-xl px-2 py-1 shrink-0 shadow-md shadow-sky-500/20"
          >
            <Image
              src="/logo.png"
              alt="VSM Garcia"
              width={950}
              height={440}
              priority
              className="h-14 w-auto"
            />
          </button>

          {/* Menu Desktop */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
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

          <div className="hidden sm:flex items-center gap-2 text-xs text-sky-300 bg-zinc-900 border border-sky-800 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            <span className="font-medium">Frota VSM Garcia</span>
          </div>
        </div>

        {/* Menu Mobile / Tablet */}
        <div className="lg:hidden flex overflow-x-auto py-2 border-t border-zinc-800 gap-2" aria-label="Principal (mobile)">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'bg-sky-500 text-slate-950' : 'text-slate-300 bg-zinc-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
