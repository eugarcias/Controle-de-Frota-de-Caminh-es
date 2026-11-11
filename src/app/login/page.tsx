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
    <div className="w-full max-w-sm sm:max-w-md bg-white border border-zinc-200 rounded-2xl shadow-xl p-5 sm:p-7 text-zinc-900">
      {/* Botões explícitos: Motorista vs Administrador */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => handleModeChange('DRIVER')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all ${
            mode === 'DRIVER'
              ? 'bg-black text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-200/60'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Motorista</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('ADMIN')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold transition-all ${
            mode === 'ADMIN'
              ? 'bg-black text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-200/60'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span>Administrador</span>
        </button>
      </div>

      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-black tracking-tight">
          {mode === 'DRIVER' ? 'Entrar como Motorista' : 'Entrar como Administrador'}
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {mode === 'DRIVER'
            ? 'Acesso direto ao lançamento de abastecimento e despesas'
            : 'Acesso completo ao painel financeiro e gestão de fretes'}
        </p>
      </div>

      {(error || noProfile) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 p-3.5 mb-5 text-xs font-semibold"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-black" />
          <span>{error ?? 'Usuário sem perfil liberado no sistema.'}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-username" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
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
            className="w-full h-12 sm:h-14 text-base font-semibold px-4 rounded-xl bg-white text-black border-2 border-zinc-300 placeholder:text-zinc-400 focus:border-black focus:outline-none transition-colors"
            placeholder="Digite seu usuário"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
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
              className="w-full h-12 sm:h-14 text-base font-semibold px-4 pr-20 rounded-xl bg-white text-black border-2 border-zinc-300 placeholder:text-zinc-400 focus:border-black focus:outline-none transition-colors"
              placeholder="Digite sua senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:text-black hover:bg-zinc-100"
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
          className="w-full h-12 sm:h-14 mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white hover:bg-zinc-800 text-sm sm:text-base font-bold shadow-md transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
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
    <main className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-zinc-950 px-4 py-8">
      {/* Logo com alto contraste e moldura limpa */}
      <div className="bg-white rounded-2xl px-5 py-3 shadow-md mb-6">
        <Image
          src="/logo.png"
          alt="VSM Garcia"
          width={950}
          height={440}
          priority
          className="h-12 sm:h-14 w-auto object-contain"
        />
      </div>

      <div className="text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          Controle de Frota
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Selecione seu perfil e digite seu usuário e senha
        </p>
      </div>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <footer className="mt-8 text-center text-[11px] text-zinc-500">
        VSM Garcia • Controle de Frota
      </footer>
    </main>
  );
}
