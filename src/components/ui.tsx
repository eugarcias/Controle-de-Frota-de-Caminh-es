'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const inputCls =
  'w-full min-h-11 sm:min-h-10 text-base sm:text-sm px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-zinc-800 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-sky-500 dark:focus:ring-emerald-500 focus:outline-none transition-colors';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-10 bg-sky-500 hover:bg-sky-400 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 dark:text-black text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-sky-500/20 dark:shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50';

export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-10 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-sm font-semibold px-4 py-2 rounded-xl transition-all';

/** Cartão padrão: sem borda, sombra suave */
export const cardCls = 'bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors';

export const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

export function Field({
  label,
  children,
  className = '',
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 w-full sm:max-w-3xl max-h-[92vh] max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl shadow-2xl border-t-4 border-sky-500 dark:border-emerald-500 border-x border-b border-transparent dark:border-zinc-800">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-sm text-slate-500 dark:text-zinc-400 py-10 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900/60">
      {text}
    </div>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'dark';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300',
    green: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    red: 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    dark: 'bg-slate-900 dark:bg-zinc-950 text-sky-300 dark:text-emerald-400 border border-slate-800 dark:border-zinc-800',
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>
  );
}
