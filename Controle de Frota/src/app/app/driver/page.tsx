'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Fuel,
  Receipt,
  Gauge,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Camera,
  X,
  WifiOff,
  LayoutDashboard,
  Star,
  Truck as TruckIcon,
  RefreshCw,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { formatBRL, formatDate } from '@/components/ui';
import {
  compressImageToDataUrl,
  enqueue,
  flushQueue,
  isNetworkError,
  queueSize,
} from '@/lib/offlineQueue';

interface DriverTruck {
  id: string;
  plate: string;
  model: string;
  brand?: string;
  currentOdometer: number;
  isPreferred?: boolean;
  isLastUsed?: boolean;
  usageCount?: number;
}

interface Ctx {
  userName: string;
  role?: 'ADMIN' | 'DRIVER';
  driver: { id: string; name: string; cnhExpiry: string | null } | null;
  preferredTruckId?: string | null;
  trucks: DriverTruck[];
  trips: {
    id: string;
    truckId: string;
    origin: string;
    destination: string;
    customerName: string;
    status: string;
  }[];
  expenses: {
    id: string;
    date: string;
    category: string;
    amount: number;
    description: string;
    receiptPhotoUrl: string | null;
  }[];
}

const CTX_CACHE_KEY = 'vsm.driver.ctx.v2';
const PREF_TRUCK_KEY = 'vsm.driver.preferredTruckId.v1';

const CATEGORIES = [
  { value: 'ALIMENTACAO', label: 'Alimentação / Refeição' },
  { value: 'PEDAGIO', label: 'Pedágio' },
  { value: 'CHAPA', label: 'Chapa / Ajudante' },
  { value: 'BORRACHARIA', label: 'Borracharia / Pneu' },
  { value: 'ESTACIONAMENTO', label: 'Estacionamento / Pátio' },
  { value: 'HOSPEDAGEM', label: 'Hospedagem / Pernoite' },
  { value: 'OUTROS', label: 'Outros gastos' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const today = () => new Date().toISOString().slice(0, 10);
const field =
  'w-full min-h-14 text-lg font-medium px-4 py-2.5 rounded-2xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none';
const label = 'block text-xs font-extrabold text-slate-700 uppercase tracking-wide mb-1.5';
const submitBtn =
  'w-full min-h-14 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-extrabold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition disabled:opacity-50';

async function postDriverAction(
  url: string,
  body: Record<string, unknown>
): Promise<{ queued?: boolean; deduplicated?: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const { deduplicated } = enqueue(url, body);
    return { queued: true, deduplicated };
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isNetworkError(e)) {
      const { deduplicated } = enqueue(url, body);
      return { queued: true, deduplicated };
    }
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}

type Tab = 'fuel' | 'expense' | 'odometer';

export default function DriverPage() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('fuel');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  // Escolhe o caminhão inicial de forma inteligente (localStorage -> preferido do banco -> 1º da lista)
  const applySmartTruckSelection = useCallback((data: Ctx) => {
    if (!data.trucks || data.trucks.length === 0) return;
    const savedLocal = localStorage.getItem(PREF_TRUCK_KEY);
    const validSaved = savedLocal && data.trucks.some((t) => t.id === savedLocal) ? savedLocal : null;
    const bestId =
      validSaved ||
      (data.preferredTruckId && data.trucks.some((t) => t.id === data.preferredTruckId)
        ? data.preferredTruckId
        : data.trucks[0].id);
    setSelectedTruckId((curr) => (curr && data.trucks.some((t) => t.id === curr) ? curr : bestId));
  }, []);

  const load = useCallback(async () => {
    // 1. Carrega cache local imediatamente para abrir sem internet em 0ms
    try {
      const cachedRaw = localStorage.getItem(CTX_CACHE_KEY);
      if (cachedRaw) {
        const cachedData = JSON.parse(cachedRaw) as Ctx;
        setCtx((prev) => prev ?? cachedData);
        applySmartTruckSelection(cachedData);
      }
    } catch {
      /* ignore */
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const res = await fetch('/api/driver/context', { cache: 'no-store' });
      const data = (await res.json()) as Ctx & { error?: string };
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar dados.');
      setCtx(data);
      setLoadError(null);
      localStorage.setItem(CTX_CACHE_KEY, JSON.stringify(data));
      applySmartTruckSelection(data);
    } catch (e) {
      // Se já temos cache local salvo, não trava a tela do motorista
      setCtx((current) => {
        if (!current) {
          setLoadError(e instanceof Error ? e.message : 'Sem conexão no momento.');
        }
        return current;
      });
    }
  }, [applySmartTruckSelection]);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setToast(null), 5000);
  };

  // Atualiza odômetro localmente mesmo quando offline para que a tela reflita na hora
  const updateLocalOdometer = (truckId: string, newOdometer: number) => {
    setCtx((prev) => {
      if (!prev) return prev;
      const updated: Ctx = {
        ...prev,
        trucks: prev.trucks.map((t) =>
          t.id === truckId && newOdometer > t.currentOdometer
            ? { ...t, currentOdometer: newOdometer }
            : t
        ),
      };
      try {
        localStorage.setItem(CTX_CACHE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  };

  // Quando o motorista seleciona um caminhão, salva como preferido no celular e no banco
  const handleSelectTruck = (truckId: string) => {
    setSelectedTruckId(truckId);
    localStorage.setItem(PREF_TRUCK_KEY, truckId);
    if (navigator.onLine) {
      fetch('/api/driver/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(queueSize());

    const sync = async () => {
      const { synced } = await flushQueue();
      setPending(queueSize());
      if (synced > 0) {
        notify(true, `${synced} lançamento(s) enviado(s) automaticamente!`);
        load();
      }
    };
    const goOnline = () => {
      setOnline(true);
      sync();
      load();
    };
    const goOffline = () => setOnline(false);
    const onQueue = () => setPending(queueSize());

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('vsm-queue-change', onQueue);
    sync();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('vsm-queue-change', onQueue);
    };
  }, [load]);

  const cnhAlert = (() => {
    const exp = ctx?.driver?.cnhExpiry;
    if (!exp) return null;
    const days = Math.floor((new Date(exp).getTime() - Date.now()) / 86400000);
    return days <= 60 ? { days, expired: days < 0 } : null;
  })();

  const logout = async () => {
    if (!confirm('Deseja realmente sair do aplicativo?')) return;
    await createSupabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  // Apenas as 3 abas essenciais (removida a aba "Problema")
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'fuel', label: 'Abastecer', icon: Fuel },
    { id: 'expense', label: 'Despesa', icon: Receipt },
    { id: 'odometer', label: 'Hodômetro', icon: Gauge },
  ];

  const currentTruck =
    ctx?.trucks.find((t) => t.id === selectedTruckId) ?? ctx?.trucks[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <header className="sticky top-0 z-30 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-md border-b-2 border-sky-500">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg px-1.5 py-0.5 shrink-0">
            <Image src="/logo.png" alt="VSM Garcia" width={950} height={440} className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider leading-none">
              Motorista Conectado
            </p>
            <p className="text-sm font-bold truncate mt-0.5">
              {ctx?.driver?.name ?? ctx?.userName ?? 'Carregando…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ctx?.role === 'ADMIN' && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-xs font-bold"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Painel Admin</span>
            </Link>
          )}
          <button
            onClick={logout}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="p-2.5 rounded-xl text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className={`fixed top-16 inset-x-4 z-40 mx-auto max-w-md flex items-center gap-2.5 rounded-2xl p-4 text-sm font-bold shadow-xl ring-2 ${
            toast.ok
              ? 'bg-emerald-600 text-white ring-emerald-400'
              : 'bg-rose-600 text-white ring-rose-400'
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="w-6 h-6 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <main className="max-w-md mx-auto p-4 space-y-4">
        {(!online || pending > 0) && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl bg-amber-50 text-amber-950 ring-1 ring-amber-300 p-3.5 text-xs font-semibold"
          >
            <WifiOff className="w-5 h-5 shrink-0 text-amber-600" />
            <span>
              {!online ? 'Você está sem internet no momento. ' : ''}
              {pending > 0
                ? `${pending} lançamento(s) guardado(s) no celular — serão enviados sozinhos assim que o sinal voltar.`
                : 'Pode lançar normalmente! Tudo fica salvo no celular e sincroniza depois.'}
            </span>
          </div>
        )}

        {cnhAlert && (
          <div
            role="alert"
            className={`flex items-start gap-2.5 rounded-2xl p-3.5 text-xs font-semibold ring-1 ${
              cnhAlert.expired
                ? 'bg-rose-50 text-rose-900 ring-rose-200'
                : 'bg-amber-50 text-amber-900 ring-amber-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {cnhAlert.expired
                ? `Sua CNH venceu há ${-cnhAlert.days} dia(s). Avise o escritório.`
                : `Sua CNH vence em ${cnhAlert.days} dia(s).`}
            </span>
          </div>
        )}

        {loadError && !ctx && (
          <div
            role="alert"
            className="rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-4 text-sm space-y-2"
          >
            <p className="font-semibold">{loadError}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 font-bold text-rose-800 underline"
            >
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </button>
          </div>
        )}

        {!ctx && !loadError && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-sky-700">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-semibold">Carregando seu caminhão…</span>
          </div>
        )}

        {ctx && ctx.trucks.length === 0 && (
          <div className="rounded-2xl bg-amber-50 text-amber-900 ring-1 ring-amber-200 p-4 text-sm font-medium">
            Nenhum caminhão ativo cadastrado no sistema. Peça ao administrador para cadastrar.
          </div>
        )}

        {ctx && currentTruck && (
          <>
            {/* Card Inteligente do Caminhão Selecionado (evita que o motorista precise escolher toda vez) */}
            <SmartTruckBar
              trucks={ctx.trucks}
              selectedTruck={currentTruck}
              onSelectTruck={handleSelectTruck}
            />

            {tab === 'fuel' && (
              <FuelForm
                truck={currentTruck}
                onDone={(msg, newOdo) => {
                  if (newOdo) updateLocalOdometer(currentTruck.id, newOdo);
                  notify(true, msg);
                  load();
                }}
                onError={(m) => notify(false, m)}
              />
            )}

            {tab === 'expense' && (
              <ExpenseForm
                ctx={ctx}
                truck={currentTruck}
                onDone={(m) => {
                  notify(true, m);
                  load();
                }}
                onError={(m) => notify(false, m)}
              />
            )}

            {tab === 'odometer' && (
              <OdometerForm
                truck={currentTruck}
                onDone={(msg, newOdo) => {
                  if (newOdo) updateLocalOdometer(currentTruck.id, newOdo);
                  notify(true, msg);
                  load();
                }}
                onError={(m) => notify(false, m)}
              />
            )}

            {tab === 'expense' && ctx.expenses.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-2.5">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                  Minhas últimas despesas lançadas
                </h3>
                {ctx.expenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 pb-2.5 last:pb-0"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{catLabel(e.category)}</span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(e.date)}
                        {e.description ? ` • ${e.description}` : ''}
                        {e.receiptPhotoUrl ? ' • 📎 Com foto' : ''}
                      </span>
                    </div>
                    <strong className="text-rose-600 text-base">{formatBRL(e.amount)}</strong>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Navegação inferior com 3 botões grandes e fáceis de tocar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-slate-200 grid grid-cols-3 pb-[env(safe-area-inset-bottom)] shadow-lg"
        aria-label="Menu do motorista"
      >
        {tabs.map(({ id, label: l, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-3.5 text-xs font-extrabold transition ${
                active ? 'text-emerald-600 bg-emerald-50/60' : 'text-slate-500 active:bg-slate-100'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span>{l}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SmartTruckBar({
  trucks,
  selectedTruck,
  onSelectTruck,
}: {
  trucks: DriverTruck[];
  selectedTruck: DriverTruck;
  onSelectTruck: (id: string) => void;
}) {
  const [changing, setChanging] = useState(false);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md ring-1 ring-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <TruckIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                Seu Caminhão Atual
              </span>
            </div>
            <div className="text-lg font-extrabold tracking-tight truncate">
              {selectedTruck.plate} — {selectedTruck.model}
            </div>
            <div className="text-xs text-slate-400">
              Hodômetro atual: <strong className="text-slate-200">{selectedTruck.currentOdometer.toLocaleString('pt-BR')} km</strong>
            </div>
          </div>
        </div>

        {trucks.length > 1 && (
          <button
            type="button"
            onClick={() => setChanging((v) => !v)}
            className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold border border-slate-700"
          >
            {changing ? 'Fechar' : 'Trocar'}
          </button>
        )}
      </div>

      {changing && trucks.length > 1 && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-300 font-semibold">
            Toque no caminhão que você está dirigindo hoje (ele ficará salvo como seu preferido):
          </p>
          <div className="grid grid-cols-1 gap-2">
            {trucks.map((t) => {
              const isSelected = t.id === selectedTruck.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTruck(t.id);
                    setChanging(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-bold transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <div>
                    <span className="text-base">{t.plate}</span> — {t.model}
                    <span className="block text-xs font-normal opacity-80">
                      {t.currentOdometer.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-xs bg-white/20 px-2.5 py-1 rounded-lg">Selecionado</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function nowLocalInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function FuelForm({
  truck,
  onDone,
  onError,
}: {
  truck: DriverTruck;
  onDone: (msg: string, newOdometer?: number) => void;
  onError: (msg: string) => void;
}) {
  const [recordId, setRecordId] = useState(() => crypto.randomUUID());
  const [dateTime, setDateTime] = useState(nowLocalInput);
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
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

  const numLiters = Number(liters) || 0;
  const numTotal = Number(totalAmount) || 0;
  const unitPrice = numLiters > 0 && numTotal > 0 ? numTotal / numLiters : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const numOdo = Number(odometer);
    if (!numOdo || numOdo <= 0) {
      onError('Digite o KM (odômetro) que está no painel do caminhão.');
      return;
    }
    if (numLiters <= 0 || numTotal <= 0) {
      onError('Informe os litros e o valor total do abastecimento.');
      return;
    }

    setBusy(true);
    try {
      let receiptPhotoUrl: string | null = null;
      let offlinePhotoDataUrl: string | undefined;

      if (file) {
        if (navigator.onLine) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            const up = await fetch('/api/driver/upload', { method: 'POST', body: fd });
            if (up.ok) {
              const upData = await up.json().catch(() => ({}));
              receiptPhotoUrl = upData.path ?? null;
            }
          } catch {
            offlinePhotoDataUrl = await compressImageToDataUrl(file).catch(() => undefined);
          }
        } else {
          offlinePhotoDataUrl = await compressImageToDataUrl(file).catch(() => undefined);
        }
      }

      const isoDate = dateTime ? new Date(dateTime).toISOString() : new Date().toISOString();

      const res = await postDriverAction('/api/driver/fuel', {
        id: recordId,
        truckId: truck.id,
        date: isoDate,
        odometer: numOdo,
        liters: numLiters,
        totalAmount: Number(numTotal.toFixed(2)),
        pricePerLiter: Number((numTotal / numLiters).toFixed(3)),
        receiptPhotoUrl,
        ...(offlinePhotoDataUrl ? { _offlinePhotoDataUrl: offlinePhotoDataUrl } : {}),
      });

      setRecordId(crypto.randomUUID());
      setDateTime(nowLocalInput());
      setOdometer('');
      setLiters('');
      setTotalAmount('');
      pick(null);

      if (res.queued) {
        onDone('Abastecimento salvo no celular! Será enviado quando a internet voltar.', numOdo);
      } else {
        onDone('Abastecimento registrado com sucesso!', numOdo);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar abastecimento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4"
    >
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Lançar Abastecimento</h2>
        <p className="text-xs text-slate-500">
          Preencha os números da bomba e do painel do caminhão.
        </p>
      </div>

      <div>
        <label className={label}>
          KM no Painel (Odômetro) — último: {truck.currentOdometer.toLocaleString('pt-BR')} km
        </label>
        <input
          required
          type="number"
          inputMode="numeric"
          min={truck.currentOdometer > 0 ? truck.currentOdometer : 1}
          className={field}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={truck.currentOdometer > 0 ? `Ex: ${truck.currentOdometer + 450}` : 'Ex: 228500'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Litros</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            className={field}
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            placeholder="Ex: 550"
          />
        </div>
        <div>
          <label className={label}>Valor Total (R$)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            className={field}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="Ex: 3250,00"
          />
        </div>
      </div>

      <div>
        <label className={label}>Foto da Nota / Cupom (Opcional)</label>
        {preview ? (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Recibo de abastecimento"
              className="w-16 h-16 object-cover rounded-xl"
            />
            <span className="flex-1 text-xs font-semibold text-emerald-700">
              Foto anexada com sucesso
            </span>
            <button
              type="button"
              onClick={() => pick(null)}
              aria-label="Remover foto"
              className="p-2 text-slate-500 hover:text-rose-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/50 text-sm font-bold text-sky-900 active:bg-sky-100">
            <Camera className="w-5 h-5 text-sky-600" />
            Tirar Foto do Cupom
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      <div>
        <label className={label}>Data e Hora</label>
        <input
          required
          type="datetime-local"
          className={field}
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-slate-900 text-white p-4">
        <div>
          <span className="text-xs text-slate-400 block">Total do Abastecimento</span>
          {unitPrice > 0 && (
            <span className="text-xs text-emerald-400 font-semibold">
              Preço por litro: R$ {unitPrice.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
        <strong className="text-2xl text-emerald-400">{formatBRL(numTotal)}</strong>
      </div>

      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Fuel className="w-6 h-6" />}
        {busy ? 'SALVANDO…' : 'CONFIRMAR ABASTECIMENTO'}
      </button>
    </form>
  );
}

function ExpenseForm({
  ctx,
  truck,
  onDone,
  onError,
}: {
  ctx: Ctx;
  truck: DriverTruck;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [recordId, setRecordId] = useState(() => crypto.randomUUID());
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      onError('Informe o valor da despesa.');
      return;
    }

    setBusy(true);
    try {
      let receiptPhotoUrl: string | null = null;
      let offlinePhotoDataUrl: string | undefined;

      if (file) {
        if (navigator.onLine) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            const up = await fetch('/api/driver/upload', { method: 'POST', body: fd });
            if (up.ok) {
              const upData = await up.json().catch(() => ({}));
              receiptPhotoUrl = upData.path ?? null;
            }
          } catch {
            offlinePhotoDataUrl = await compressImageToDataUrl(file).catch(() => undefined);
          }
        } else {
          offlinePhotoDataUrl = await compressImageToDataUrl(file).catch(() => undefined);
        }
      }

      const res = await postDriverAction('/api/driver/expense', {
        id: recordId,
        tripId: tripId || null,
        truckId: truck.id,
        date: `${date}T12:00:00.000Z`,
        category,
        amount: numAmount,
        description: description.trim(),
        receiptPhotoUrl,
        ...(offlinePhotoDataUrl ? { _offlinePhotoDataUrl: offlinePhotoDataUrl } : {}),
      });

      setRecordId(crypto.randomUUID());
      setAmount('');
      setDescription('');
      pick(null);

      if (res.queued) {
        onDone('Despesa salva no celular! Será enviada quando a internet voltar.');
      } else {
        onDone('Despesa registrada com sucesso!');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar despesa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4"
    >
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Lançar Despesa de Viagem</h2>
        <p className="text-xs text-slate-500">
          Registre gastos com pedágio, refeição, chapa ou borracharia.
        </p>
      </div>

      {ctx.trips.length > 0 && (
        <div>
          <label className={label}>Viagem / Frete</label>
          <select className={field} value={tripId} onChange={(e) => setTripId(e.target.value)}>
            {ctx.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.origin} → {t.destination} ({t.customerName})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={label}>Tipo de Gasto</label>
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Valor (R$)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            className={field}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex: 45,00"
          />
        </div>
        <div>
          <label className={label}>Data</label>
          <input
            required
            type="date"
            max={today()}
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={label}>Observação (Opcional)</label>
        <input
          className={field}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Almoço no posto"
        />
      </div>

      <div>
        <label className={label}>Foto do Comprovante (Opcional)</label>
        {preview ? (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Recibo" className="w-16 h-16 object-cover rounded-xl" />
            <span className="flex-1 text-xs font-semibold text-emerald-700">
              Foto anexada com sucesso
            </span>
            <button
              type="button"
              onClick={() => pick(null)}
              aria-label="Remover foto"
              className="p-2 text-slate-500 hover:text-rose-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/50 text-sm font-bold text-sky-900 active:bg-sky-100">
            <Camera className="w-5 h-5 text-sky-600" />
            Tirar Foto do Comprovante
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Receipt className="w-6 h-6" />}
        {busy ? 'SALVANDO…' : 'CONFIRMAR DESPESA'}
      </button>
    </form>
  );
}

function OdometerForm({
  truck,
  onDone,
  onError,
}: {
  truck: DriverTruck;
  onDone: (msg: string, newOdometer?: number) => void;
  onError: (msg: string) => void;
}) {
  const [odometer, setOdometer] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const numOdo = Number(odometer);
    if (!numOdo || numOdo <= 0) {
      onError('Digite o KM atual do painel.');
      return;
    }

    setBusy(true);
    try {
      const res = await postDriverAction('/api/driver/odometer', {
        truckId: truck.id,
        odometer: numOdo,
      });
      setOdometer('');
      if (res.queued) {
        onDone('Hodômetro salvo no celular! Será sincronizado assim que a internet voltar.', numOdo);
      } else {
        onDone('Hodômetro atualizado com sucesso!', numOdo);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar hodômetro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-4"
    >
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Atualizar Hodômetro (KM)</h2>
        <p className="text-xs text-slate-500">
          Informe o KM que aparece agora no painel do caminhão.
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 text-sm text-slate-600 flex items-center justify-between">
        <span>Último KM registrado:</span>
        <strong className="text-base text-slate-900">
          {truck.currentOdometer.toLocaleString('pt-BR')} km
        </strong>
      </div>

      <div>
        <label className={label}>Novo KM no Painel</label>
        <input
          required
          type="number"
          inputMode="numeric"
          min={truck.currentOdometer > 0 ? truck.currentOdometer : 1}
          className={field}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={truck.currentOdometer > 0 ? `Ex: ${truck.currentOdometer + 300}` : 'Ex: 150000'}
        />
      </div>

      <button type="submit" disabled={busy} className={submitBtn}>
        {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Gauge className="w-6 h-6" />}
        {busy ? 'SALVANDO…' : 'CONFIRMAR KM'}
      </button>
    </form>
  );
}
