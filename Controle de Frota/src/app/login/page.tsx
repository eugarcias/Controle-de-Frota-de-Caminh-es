'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next');
  const noProfile = params.get('error') === 'sem-perfil';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      setLoading(false);
      setError('E-mail ou senha inválidos.');
      return;
    }

    const role = data.user.app_metadata?.role;
    if (role !== 'ADMIN' && role !== 'DRIVER') {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Seu usuário ainda não tem perfil de acesso. Fale com o administrador.');
      return;
    }

    // Só aceita caminhos internos em ?next= (evita open redirect) e respeita o papel.
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    const home = role === 'ADMIN' ? '/' : '/app/driver';
    const target = role === 'DRIVER' && !(safeNext ?? '').startsWith('/app/driver') ? home : safeNext ?? home;

    // Navegação completa para o middleware enxergar os cookies de sessão recém-criados.
    window.location.assign(target);
  };

  const inputCls =
    'w-full min-h-12 text-base px-4 py-2 rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none';

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
      {(error || noProfile) && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 text-rose-800 ring-1 ring-rose-200 p-3 text-sm">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error ?? 'Seu usuário ainda não tem perfil de acesso. Fale com o administrador.'}</span>
        </div>
      )}

      <label className="block">
        <span className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail</span>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="voce@empresa.com"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-semibold text-slate-300 uppercase mb-1">Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          placeholder="••••••••"
        />
      </label>

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/20 transition active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-slate-950 px-5 py-10">
      <div className="bg-white rounded-2xl px-3 py-2 shadow-lg shadow-sky-500/10">
        <Image src="/logo.png" alt="VSM Garcia" width={950} height={440} priority className="h-16 w-auto" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Gestão de Frota</h1>
        <p className="text-sm text-slate-400 mt-1">Acesse com seu e-mail e senha</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
