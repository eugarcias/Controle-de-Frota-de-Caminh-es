'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { createSupabaseBrowser, normalizeLoginIdentifier } from '@/lib/supabase/browser';

const SAVED_USER_KEY = 'vsm.lastLoginUser.v1';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next');
  const noProfile = params.get('error') === 'sem-perfil';

  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_USER_KEY);
    if (saved) setLoginInput(saved);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeLoginIdentifier(loginInput);
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.user) {
        setLoading(false);
        setError('Usuário ou senha incorretos. Confira o que digitou e tente novamente.');
        return;
      }

      const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
      if (role !== 'ADMIN' && role !== 'DRIVER') {
        await supabase.auth.signOut();
        setLoading(false);
        setError('Seu usuário ainda não está liberado. Peça ajuda ao administrador.');
        return;
      }

      // Guarda o usuário para facilitar futuros acessos neste aparelho
      localStorage.setItem(SAVED_USER_KEY, loginInput.trim());

      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      const home = role === 'ADMIN' ? '/' : '/app/driver';
      const target = role === 'DRIVER' && !(safeNext ?? '').startsWith('/app/driver') ? home : safeNext ?? home;

      window.location.assign(target);
    } catch {
      setLoading(false);
      setError('Sem conexão com a internet no momento. Verifique seu sinal e tente novamente.');
    }
  };

  const inputCls =
    'w-full min-h-14 text-lg font-medium px-4 py-3 rounded-2xl bg-white text-slate-900 shadow-sm ring-2 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none';

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5"
      noValidate
    >
      {(error || noProfile) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-4 text-sm font-medium"
        >
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-rose-600" />
          <span>{error ?? 'Seu usuário ainda não está liberado. Peça ajuda ao administrador.'}</span>
        </div>
      )}

      <div>
        <label htmlFor="login-user" className="block text-sm font-bold text-slate-200 mb-1.5">
          Seu Usuário ou E-mail
        </label>
        <input
          id="login-user"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={loginInput}
          onChange={(e) => setLoginInput(e.target.value)}
          className={inputCls}
          placeholder="Ex: carlos ou email@frota.com"
        />
      </div>

      <div>
        <label htmlFor="login-pass" className="block text-sm font-bold text-slate-200 mb-1.5">
          Sua Senha
        </label>
        <div className="relative">
          <input
            id="login-pass"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-24`}
            placeholder="Digite sua senha"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
          >
            {showPassword ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Ocultar</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Ver</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 rounded-xl px-3.5 py-2.5">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Seu login fica salvo automaticamente neste celular/computador.</span>
      </div>

      <button
        type="submit"
        disabled={loading || !loginInput.trim() || !password}
        className="w-full min-h-14 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-lg font-extrabold shadow-lg shadow-emerald-500/25 transition active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
        {loading ? 'Entrando no sistema…' : 'ENTRAR'}
      </button>

      <div className="pt-2 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Acesso exclusivo da equipe VSM Garcia.</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Esqueceu a senha? Solicite uma nova ao administrador da frota.
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-8">
      <div className="bg-white rounded-2xl px-4 py-2.5 shadow-lg shadow-sky-500/10">
        <Image src="/logo.png" alt="VSM Garcia" width={950} height={440} priority className="h-16 w-auto" />
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Controle de Frota</h1>
        <p className="text-sm text-slate-300">Digite seu usuário e senha para entrar</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
