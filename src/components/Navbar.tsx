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
  Award,
  Sun,
  Moon,
  User,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { useTheme } from '@/components/ThemeProvider';
import { ProfileModal } from '@/components/ProfileModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [leaving, setLeaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);
  const { theme, toggleTheme } = useTheme();

  React.useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMyProfile(data);
      })
      .catch(() => null);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', short: 'Início', icon: LayoutDashboard },
    { id: 'quick-entry', label: 'Lançar Abastecimento', short: 'Lançar', icon: Fuel },
    { id: 'trips', label: 'Fretes', short: 'Fretes', icon: Navigation },
    { id: 'schedule', label: 'Agenda de Cargas', short: 'Agenda', icon: CalendarClock },
    { id: 'production', label: 'Comissões & Produção', short: 'Comissão', icon: Award },
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
      <header className="sticky top-0 z-50 bg-[#0b111a]/95 backdrop-blur-md text-white shadow-lg shadow-black/40 border-b border-emerald-500/20 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            {/* Logo Oficial VSM Garcia */}
            <button
              type="button"
              onClick={() => go('dashboard')}
              aria-label="VSM Garcia - Ir para início"
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-800/60 transition shrink-0 group"
            >
              <div className="relative h-11 sm:h-14 w-11 sm:w-14 rounded-xl overflow-hidden border border-emerald-500/40 shadow-md shadow-emerald-500/10 bg-[#0f1722]">
                <Image
                  src="/logo.png"
                  alt="VSM Garcia"
                  width={512}
                  height={512}
                  priority
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-base font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent leading-none">
                  VSM GARCIA
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                  Controle de Frota
                </span>
              </div>
            </button>

            {/* Título da aba atual no celular */}
            <span className="lg:hidden flex-1 truncate text-sm font-bold text-slate-200">
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
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              {/* Botão de Modo Escuro / Claro */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                className="p-2 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-800/80 border border-slate-700/80 transition"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-emerald-400" />
                )}
              </button>

              {/* Botão de Perfil do Usuário */}
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title="Meu Perfil"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/30 text-white text-xs font-bold transition"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 border border-emerald-400">
                  {myProfile?.avatarUrl ? (
                    <img
                      src={myProfile.avatarUrl}
                      alt={myProfile.name || 'Perfil'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                </div>
                <span className="hidden sm:inline truncate max-w-[100px]">
                  {myProfile?.name?.split(' ')[0] || 'Perfil'}
                </span>
              </button>

              <Link
                href="/app/driver"
                title="Abrir App do Motorista"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 text-xs font-bold transition"
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0b111a]/95 backdrop-blur-md border-t border-emerald-500/20 pb-[env(safe-area-inset-bottom)]"
        aria-label="Menu móvel"
      >
        <div className="grid grid-cols-7 max-w-2xl mx-auto">
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
                  isActive ? 'text-emerald-400' : 'text-slate-400 active:text-white'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-6 rounded-full transition-colors ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400'
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

      {/* Modal de Perfil */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        initialProfile={myProfile}
        onProfileUpdated={(updated) => setMyProfile(updated)}
      />
    </>
  );
};
