'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, Truck, Shield } from 'lucide-react';
import { createSupabaseBrowser, normalizeLoginIdentifier } from '@/lib/supabase/browser';

type LoginMode = 'DRIVER' | 'ADMIN';

const SAVED_USER_KEY = 'vsm.lastLoginUser.v2';
const SAVED_MODE_KEY = 'vsm.lastLoginMode.v2';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next');
  const noProfile = params.get('error') === 'sem-perfil';

  const [mode, setMode] = useState<LoginMode>('DRIVER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(SAVED_USER_KEY);
      const savedMode = localStorage.getItem(SAVED_MODE_KEY) as LoginMode | null;
      if (savedUser) setUsername(savedUser);
      if (savedMode === 'ADMIN' || savedMode === 'DRIVER') setMode(savedMode);
    } catch {
      /* ignore */
    }
  }, []);

  const handleModeChange = (newMode: LoginMode) => {
    setMode(newMode);
    setError(null);
    try {
      localStorage.setItem(SAVED_MODE_KEY, newMode);
    } catch {
      /* ignore */
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Preencha seu usuário e senha.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const email = normalizeLoginIdentifier(cleanUser);
      const supabase = createSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.user) {
        setLoading(false);
        setError('Usuário ou senha incorretos.');
        return;
      }

      const role = (data.user.app_metadata?.role || data.user.user_metadata?.role) as
        | 'ADMIN'
        | 'DRIVER'
        | undefined;

      if (!role) {
        await supabase.auth.signOut();
        setLoading(false);
        setError('Usuário sem perfil de acesso liberado.');
        return;
      }

      // Verificação explícita do modo selecionado
      if (mode === 'ADMIN' && role !== 'ADMIN') {
        await supabase.auth.signOut();
        setLoading(false);
        setError('Este usuário é de motorista. Clique no botão "Motorista" acima para entrar.');
        return;
      }

      try {
        localStorage.setItem(SAVED_USER_KEY, cleanUser);
        localStorage.setItem(SAVED_MODE_KEY, mode);
      } catch {
        /* ignore */
      }

      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      const target =
        role === 'ADMIN'
          ? mode === 'DRIVER'
            ? '/app/driver'
            : safeNext ?? '/'
          : '/app/driver';

      window.location.assign(target);
    } catch {
      setLoading(false);
      setError('Sem conexão com a internet. Verifique seu sinal e tente novamente.');
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md bg-[#111926]/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-950/50 p-5 sm:p-7 text-slate-100">
      {/* Botões explícitos: Motorista vs Administrador */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b111a] border border-slate-800 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => handleModeChange('DRIVER')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-extrabold transition-all ${
            mode === 'DRIVER'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Motorista</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('ADMIN')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-extrabold transition-all ${
            mode === 'ADMIN'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span>Administrador</span>
        </button>
      </div>

      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {mode === 'DRIVER' ? 'Entrar como Motorista' : 'Entrar como Administrador'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {mode === 'DRIVER'
            ? 'Acesso direto ao lançamento de abastecimento, cargas e despesas'
            : 'Acesso completo ao painel financeiro e gestão de fretes'}
        </p>
      </div>

      {(error || noProfile) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 p-3.5 mb-5 text-xs font-semibold"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
          <span>{error ?? 'Usuário sem perfil liberado no sistema.'}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-username" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Usuário
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-12 sm:h-14 text-base font-semibold px-4 rounded-xl bg-[#0b111a] text-white border border-slate-700 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            placeholder="Digite seu usuário"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Senha
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 sm:h-14 text-base font-semibold px-4 pr-20 rounded-xl bg-[#0b111a] text-white border border-slate-700 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              placeholder="Digite sua senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
            >
              {showPassword ? (
                <span className="flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" /> Ocultar
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Ver
                </span>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full h-12 sm:h-14 mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-sm sm:text-base font-extrabold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          <span>
            {loading
              ? 'Entrando…'
              : mode === 'DRIVER'
              ? 'ENTRAR NO APP DO MOTORISTA'
              : 'ENTRAR COMO ADMINISTRADOR'}
          </span>
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#0b111a] relative overflow-hidden px-4 py-8">
      {/* Glow Esmeralda de fundo inspirado na logo VSM Garcia */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-emerald-500/15 blur-[110px]"
        aria-hidden="true"
      />

      {/* Nova Logo Oficial VSM Garcia */}
      <div className="relative mb-5">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl shadow-emerald-500/20 bg-[#111926]">
          <Image
            src="/logo.png"
            alt="VSM Garcia - Controle de Frota"
            width={512}
            height={512}
            priority
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="relative text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-white bg-clip-text text-transparent">
          VSM Garcia • Controle de Frota
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Selecione seu perfil e acesse o sistema
        </p>
      </div>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <footer className="relative mt-8 text-center text-[11px] text-slate-500">
        VSM Garcia • Gestão Inteligente de Frota
      </footer>
    </main>
  );
}
