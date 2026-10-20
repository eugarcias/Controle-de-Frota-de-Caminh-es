'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Fuel, Receipt, Gauge, LogOut, Loader2, CheckCircle2, AlertTriangle, Camera, X } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { formatBRL, formatDate } from '@/components/ui';

interface Ctx {
  userName: string;
  driver: { id: string; name: string } | null;
  trucks: { id: string; plate: string; model: string; currentOdometer: number }[];
  trips: { id: string; truckId: string; origin: string; destination: string; customerName: string; status: string }[];
  expenses: { id: string; date: string; category: string; amount: number; description: string; receiptPhotoUrl: string | null }[];
}

const CATEGORIES = [
  { value: 'ALIMENTACAO', label: 'Alimentação' },
  { value: 'ESTACIONAMENTO', label: 'Estacionamento' },
  { value: 'CHAPA', label: 'Chapa' },
  { value: 'HOSPEDAGEM', label: 'Hospedagem' },
  { value: 'OUTROS', label: 'Outros' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const today = () => new Date().toISOString().slice(0, 10);
const field =
  'w-full min-h-12 text-base px-4 py-2 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none';
const label = 'block text-xs font-bold text-slate-600 uppercase mb-1';
const submitBtn =
  'w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md active:scale-[0.98] transition disabled:opacity-50';

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir. Tente novamente.');
  return data as T;
}

type Tab = 'fuel' | 'expense' | 'odometer';

export default function DriverPage() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('fuel');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/context', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar.');
      setCtx(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  const logout = async () => {
    await createSupabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'fuel', label: 'Abastecer', icon: Fuel },
    { id: 'expense', label: 'Despesa', icon: Receipt },
    { id: 'odometer', label: 'Hodômetro', icon: Gauge },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-md border-b-2 border-sky-500">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg px-1.5 py-0.5 shrink-0">
            <Image src="/logo.png" alt="VSM Garcia" width={950} height={440} className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 leading-none">Motorista</p>
            <p className="text-sm font-semibold truncate">{ctx?.driver?.name ?? ctx?.userName ?? '…'}</p>
          </div>
        </div>
        <button onClick={logout} aria-label="Sair" className="p-2.5 rounded-xl text-slate-300 hover:bg-slate-800">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {toast && (
        <div
          role="status"
          className={`fixed top-16 inset-x-4 z-40 mx-auto max-w-md flex items-center gap-2 rounded-xl p-3 text-sm shadow-lg ring-1 ${
            toast.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-rose-50 text-rose-900 ring-rose-200'
          }`}
        >
          {toast.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      <main className="max-w-md mx-auto p-4 space-y-4">
        {loadError && (
          <div role="alert" className="rounded-xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-4 text-sm">
            {loadError}
            <button onClick={load} className="block mt-2 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}

        {!ctx && !loadError && (
          <div className="flex justify-center py-16 text-sky-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {ctx && ctx.trucks.length === 0 && (
          <div className="rounded-xl bg-amber-50 text-amber-900 ring-1 ring-amber-200 p-4 text-sm">
            Nenhum caminhão liberado para você ainda. Peça ao administrador para vincular um caminhão ou criar um frete.
          </div>
        )}

        {ctx && ctx.trucks.length > 0 && (
          <>
            {tab === 'fuel' && <FuelForm ctx={ctx} onDone={(m) => { notify(true, m); load(); }} onError={(m) => notify(false, m)} />}
            {tab === 'expense' && <ExpenseForm ctx={ctx} onDone={(m) => { notify(true, m); load(); }} onError={(m) => notify(false, m)} />}
            {tab === 'odometer' && <OdometerForm ctx={ctx} onDone={(m) => { notify(true, m); load(); }} onError={(m) => notify(false, m)} />}

            {tab === 'expense' && ctx.expenses.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-2">
                <h3 className="text-sm font-bold text-slate-800">Minhas últimas despesas</h3>
                {ctx.expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                    <div>
                      <span className="font-medium text-slate-800">{catLabel(e.category)}</span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(e.date)}
                        {e.description ? ` • ${e.description}` : ''}
                        {e.receiptPhotoUrl ? ' • 📎 recibo' : ''}
                      </span>
                    </div>
                    <strong className="text-rose-600">{formatBRL(e.amount)}</strong>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Navegação inferior (polegar) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]" aria-label="Seções">
        {tabs.map(({ id, label: l, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-3 text-xs font-semibold ${tab === id ? 'text-emerald-600' : 'text-slate-500'}`}
          >
            <Icon className="w-6 h-6" />
            {l}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type FormProps = { ctx: Ctx; onDone: (msg: string) => void; onError: (msg: string) => void };

function TruckSelect({ ctx, value, onChange }: { ctx: Ctx; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={label}>Caminhão</label>
      <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
        {ctx.trucks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.plate} — {t.model}
          </option>
        ))}
      </select>
    </div>
  );
}

function FuelForm({ ctx, onDone, onError }: FormProps) {
  const [truckId, setTruckId] = useState(ctx.trucks[0].id);
  const truck = ctx.trucks.find((t) => t.id === truckId) ?? ctx.trucks[0];
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [full, setFull] = useState(true);
  const [busy, setBusy] = useState(false);

  const total = (Number(liters) || 0) * (Number(price) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/api/driver/fuel', {
        truckId,
        date: new Date().toISOString(),
        odometer: Number(odometer),
        liters: Number(liters),
        pricePerLiter: Number(price),
        totalAmount: Number(total.toFixed(2)),
        isFullTank: full,
        gasStationName: station,
      });
      setOdometer(''); setLiters(''); setPrice(''); setStation('');
      onDone('Abastecimento registrado!');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Lançar abastecimento</h2>
      <TruckSelect ctx={ctx} value={truckId} onChange={setTruckId} />
      <div>
        <label className={label}>KM no painel (último: {truck.currentOdometer.toLocaleString('pt-BR')})</label>
        <input required type="number" inputMode="numeric" min={truck.currentOdometer} className={field} value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Litros</label>
          <input required type="number" inputMode="decimal" step="0.01" min="1" className={field} value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>
        <div>
          <label className={label}>R$ / litro</label>
          <input required type="number" inputMode="decimal" step="0.001" min="0.1" className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>Posto</label>
        <input required className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="Nome do posto / cidade" />
      </div>
      <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
        <span className="text-sm font-semibold text-slate-800">Completou o tanque?</span>
        <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="w-6 h-6 accent-emerald-600" />
      </label>
      <div className="flex items-center justify-between rounded-xl bg-slate-900 text-white p-3.5">
        <span className="text-xs text-slate-400">Total</span>
        <strong className="text-xl text-emerald-400">{formatBRL(total)}</strong>
      </div>
      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fuel className="w-5 h-5" />}
        Confirmar abastecimento
      </button>
    </form>
  );
}

function ExpenseForm({ ctx, onDone, onError }: FormProps) {
  const [tripId, setTripId] = useState(ctx.trips[0]?.id ?? '');
  const [category, setCategory] = useState('ALIMENTACAO');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  if (ctx.trips.length === 0)
    return (
      <div className="rounded-xl bg-amber-50 text-amber-900 ring-1 ring-amber-200 p-4 text-sm">
        Você não tem frete em aberto. Despesas só podem ser lançadas em um frete planejado ou em viagem.
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let receiptPhotoUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch('/api/driver/upload', { method: 'POST', body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData?.error || 'Falha ao enviar o recibo.');
        receiptPhotoUrl = upData.path;
      }
      await post('/api/driver/expense', {
        tripId,
        date: `${date}T12:00:00.000Z`,
        category,
        amount: Number(amount),
        description,
        receiptPhotoUrl,
      });
      setAmount(''); setDescription(''); pick(null);
      onDone('Despesa registrada!');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Lançar despesa de viagem</h2>
      <div>
        <label className={label}>Frete</label>
        <select className={field} value={tripId} onChange={(e) => setTripId(e.target.value)}>
          {ctx.trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.origin} → {t.destination} ({t.customerName})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Categoria</label>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Valor (R$)</label>
          <input required type="number" inputMode="decimal" step="0.01" min="0.01" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>Data</label>
        <input required type="date" max={today()} className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className={label}>Descrição (opcional)</label>
        <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: almoço em Registro-SP" />
      </div>

      <div>
        <label className={label}>Foto do recibo</label>
        {preview ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Recibo" className="w-16 h-16 object-cover rounded-lg" />
            <span className="flex-1 text-xs text-slate-600 truncate">{file?.name}</span>
            <button type="button" onClick={() => pick(null)} aria-label="Remover foto" className="p-2 text-slate-400 hover:text-rose-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-600 active:bg-slate-100">
            <Camera className="w-5 h-5 text-sky-600" />
            Tirar foto ou escolher imagem
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>

      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
        Registrar despesa
      </button>
    </form>
  );
}

function OdometerForm({ ctx, onDone, onError }: FormProps) {
  const [truckId, setTruckId] = useState(ctx.trucks[0].id);
  const truck = ctx.trucks.find((t) => t.id === truckId) ?? ctx.trucks[0];
  const [odometer, setOdometer] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/api/driver/odometer', { truckId, odometer: Number(odometer) });
      setOdometer('');
      onDone('Hodômetro atualizado!');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Atualizar hodômetro</h2>
      <TruckSelect ctx={ctx} value={truckId} onChange={setTruckId} />
      <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200 text-sm text-slate-600">
        KM atual registrado: <strong className="text-slate-900">{truck.currentOdometer.toLocaleString('pt-BR')} km</strong>
      </div>
      <div>
        <label className={label}>Novo KM no painel</label>
        <input required type="number" inputMode="numeric" min={truck.currentOdometer + 1} className={field} value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gauge className="w-5 h-5" />}
        Atualizar hodômetro
      </button>
    </form>
  );
}
