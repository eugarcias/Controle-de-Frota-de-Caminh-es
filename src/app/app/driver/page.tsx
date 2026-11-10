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

const CTX_CACHE_KEY = 'vsm.driver.ctx.v3';
const PREF_TRUCK_KEY = 'vsm.driver.preferredTruckId.v2';

const CATEGORIES = [
  { value: 'ALIMENTACAO', label: 'Alimentação / Refeição' },
  { value: 'PEDAGIO', label: 'Pedágio' },
  { value: 'CHAPA', label: 'Chapa / Ajudante' },
  { value: 'BORRACHARIA', label: 'Borracharia / Pneu' },
  { value: 'ESTACIONAMENTO', label: 'Estacionamento' },
  { value: 'HOSPEDAGEM', label: 'Hospedagem' },
  { value: 'OUTROS', label: 'Outros' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const today = () => new Date().toISOString().slice(0, 10);
const fieldCls =
  'w-full h-12 sm:h-14 text-base font-semibold px-4 rounded-xl bg-white text-black border-2 border-zinc-300 placeholder:text-zinc-400 focus:border-black focus:outline-none transition-colors';
const labelCls = 'block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5';
const submitBtnCls =
  'w-full h-12 sm:h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-sm sm:text-base font-bold shadow-md active:scale-[0.99] transition disabled:opacity-40';

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

  const applySmartTruckSelection = useCallback((data: Ctx) => {
    if (!data.trucks || data.trucks.length === 0) return;
    try {
      const savedLocal = localStorage.getItem(PREF_TRUCK_KEY);
      const validSaved = savedLocal && data.trucks.some((t) => t.id === savedLocal) ? savedLocal : null;
      const bestId =
        validSaved ||
        (data.preferredTruckId && data.trucks.some((t) => t.id === data.preferredTruckId)
          ? data.preferredTruckId
          : data.trucks[0].id);
      setSelectedTruckId((curr) => (curr && data.trucks.some((t) => t.id === curr) ? curr : bestId));
    } catch {
      setSelectedTruckId(data.trucks[0].id);
    }
  }, []);

  const load = useCallback(async () => {
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
      try {
        localStorage.setItem(CTX_CACHE_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
      applySmartTruckSelection(data);
    } catch (e) {
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
    setTimeout(() => setToast(null), 4500);
  };

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

  const handleSelectTruck = (truckId: string) => {
    setSelectedTruckId(truckId);
    try {
      localStorage.setItem(PREF_TRUCK_KEY, truckId);
    } catch {
      /* ignore */
    }
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
        notify(true, `${synced} lançamento(s) sincronizado(s) com sucesso.`);
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

  const logout = async () => {
    if (!confirm('Deseja sair da sua conta?')) return;
    await createSupabaseBrowser().auth.signOut();
    window.location.assign('/login');
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'fuel', label: 'Abastecer', icon: Fuel },
    { id: 'expense', label: 'Despesas', icon: Receipt },
    { id: 'odometer', label: 'Hodômetro', icon: Gauge },
  ];

  const currentTruck =
    ctx?.trucks.find((t) => t.id === selectedTruckId) ?? ctx?.trucks[0] ?? null;

  return (
    <div className="min-h-[100dvh] bg-zinc-100 text-zinc-900 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header com contraste máximo (preto e branco) */}
      <header className="sticky top-0 z-30 bg-black text-white px-4 py-3 flex items-center justify-between border-b border-zinc-800 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg px-2 py-0.5 shrink-0">
            <Image
              src="/logo.png"
              alt="VSM Garcia"
              width={950}
              height={440}
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider leading-none">
              Motorista
            </p>
            <p className="text-sm font-bold truncate mt-0.5 text-white">
              {ctx?.driver?.name ?? ctx?.userName ?? 'Carregando…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {ctx?.role === 'ADMIN' && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Painel</span>
            </Link>
          )}
          <button
            onClick={logout}
            aria-label="Sair"
            title="Sair"
            className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Alerta de confirmação */}
      {toast && (
        <div
          role="status"
          className={`fixed top-16 inset-x-4 z-40 mx-auto max-w-md flex items-center gap-2.5 rounded-xl p-3.5 text-sm font-bold shadow-lg border ${
            toast.ok
              ? 'bg-black text-white border-zinc-800'
              : 'bg-zinc-900 text-white border-zinc-700'
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-zinc-300" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <main className="w-full max-w-md mx-auto p-3.5 sm:p-4 space-y-3.5">
        {(!online || pending > 0) && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl bg-zinc-200 border border-zinc-300 p-3 text-xs font-semibold text-zinc-900"
          >
            <WifiOff className="w-4 h-4 shrink-0 text-black" />
            <span>
              {!online ? 'Sem internet no momento. ' : ''}
              {pending > 0
                ? `${pending} lançamento(s) aguardando sincronização.`
                : 'Seus lançamentos ficam salvos no celular e são enviados quando o sinal voltar.'}
            </span>
          </div>
        )}

        {loadError && !ctx && (
          <div
            role="alert"
            className="rounded-xl bg-white border border-zinc-300 p-4 text-xs font-semibold text-zinc-900 space-y-2"
          >
            <p>{loadError}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 font-bold underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        {!ctx && !loadError && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-700">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-xs font-semibold">Carregando…</span>
          </div>
        )}

        {ctx && ctx.trucks.length === 0 && (
          <div className="rounded-xl bg-white border border-zinc-300 p-4 text-xs font-medium text-zinc-800">
            Nenhum caminhão ativo liberado. Fale com a administração da frota.
          </div>
        )}

        {ctx && currentTruck && (
          <>
            {/* Seletor direto do Caminhão (alto contraste) */}
            <TruckSelectorBar
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

            {/* Lista compacta de despesas */}
            {tab === 'expense' && ctx.expenses.length > 0 && (
              <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
                <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Últimas despesas lançadas
                </h3>
                <div className="divide-y divide-zinc-100">
                  {ctx.expenses.slice(0, 8).map((e) => (
                    <div
                      key={e.id}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-black">{catLabel(e.category)}</span>
                        <span className="block text-[11px] text-zinc-500">
                          {formatDate(e.date)}
                          {e.description ? ` • ${e.description}` : ''}
                        </span>
                      </div>
                      <strong className="text-sm font-bold text-black">{formatBRL(e.amount)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Navegação inferior (3 botões grandes, contraste máximo) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-zinc-200 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]"
        aria-label="Ações do motorista"
      >
        {tabs.map(({ id, label: l, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-xs font-bold transition ${
                active
                  ? 'text-black bg-zinc-100 border-t-2 border-black'
                  : 'text-zinc-500 active:bg-zinc-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{l}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- Componentes e Formulários ---------------- */

function TruckSelectorBar({
  trucks,
  selectedTruck,
  onSelectTruck,
}: {
  trucks: DriverTruck[];
  selectedTruck: DriverTruck;
  onSelectTruck: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-zinc-100 text-black shrink-0">
            <TruckIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Caminhão Selecionado
            </p>
            <p className="text-base font-extrabold text-black truncate">
              {selectedTruck.plate} — {selectedTruck.model}
            </p>
            <p className="text-xs text-zinc-600 font-semibold">
              Hodômetro: {selectedTruck.currentOdometer.toLocaleString('pt-BR')} km
            </p>
          </div>
        </div>

        {trucks.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-black border border-zinc-300"
          >
            {open ? 'Fechar' : 'Trocar'}
          </button>
        )}
      </div>

      {open && trucks.length > 1 && (
        <div className="pt-2 border-t border-zinc-100 space-y-1.5">
          <p className="text-xs text-zinc-600 font-medium">Selecione o caminhão que está com você:</p>
          <div className="grid grid-cols-1 gap-1.5">
            {trucks.map((t) => {
              const active = t.id === selectedTruck.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTruck(t.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-xs font-bold border transition ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-zinc-50 text-black border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <span>
                    {t.plate} — {t.model}
                  </span>
                  <span className={active ? 'text-zinc-300' : 'text-zinc-600'}>
                    {t.currentOdometer.toLocaleString('pt-BR')} km
                  </span>
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
      onError('Digite o KM do painel do caminhão.');
      return;
    }
    if (numLiters <= 0 || numTotal <= 0) {
      onError('Informe a quantidade de litros e o valor total.');
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
        onDone('Abastecimento salvo no aparelho.', numOdo);
      } else {
        onDone('Abastecimento registrado com sucesso.', numOdo);
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
      className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3.5 shadow-sm"
    >
      <div className="border-b border-zinc-100 pb-2">
        <h2 className="text-base font-extrabold text-black">Abastecimento</h2>
        <p className="text-xs text-zinc-500">Dados do cupom fiscal e painel</p>
      </div>

      <div>
        <label className={labelCls}>
          KM Atual no Painel (último: {truck.currentOdometer.toLocaleString('pt-BR')} km)
        </label>
        <input
          required
          type="number"
          inputMode="numeric"
          min={truck.currentOdometer > 0 ? truck.currentOdometer : 1}
          className={fieldCls}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={truck.currentOdometer > 0 ? `Ex: ${truck.currentOdometer + 400}` : 'Ex: 220000'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Litros</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            className={fieldCls}
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            placeholder="Ex: 500"
          />
        </div>
        <div>
          <label className={labelCls}>Valor Total (R$)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            className={fieldCls}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="Ex: 3000,00"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Foto do Cupom (Opcional)</label>
        {preview ? (
          <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2.5 border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Recibo"
              className="w-14 h-14 object-cover rounded-lg border border-zinc-300"
            />
            <span className="flex-1 text-xs font-semibold text-zinc-800">Foto anexada</span>
            <button
              type="button"
              onClick={() => pick(null)}
              aria-label="Remover foto"
              className="p-2 text-zinc-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex h-12 sm:h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-xs sm:text-sm font-bold text-zinc-700 hover:border-black active:bg-zinc-100 transition">
            <Camera className="w-4 h-4 text-black" />
            <span>Tirar Foto do Cupom</span>
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
        <label className={labelCls}>Data e Hora</label>
        <input
          required
          type="datetime-local"
          className={fieldCls}
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />
      </div>

      {unitPrice > 0 && (
        <div className="p-3 bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex justify-between items-center">
          <span>Preço calculado:</span>
          <span>R$ {unitPrice.toFixed(2).replace('.', ',')} / Litro</span>
        </div>
      )}

      <button type="submit" disabled={busy} className={submitBtnCls}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fuel className="w-5 h-5" />}
        <span>{busy ? 'Gravando…' : 'CONFIRMAR ABASTECIMENTO'}</span>
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
        onDone('Despesa salva no aparelho.');
      } else {
        onDone('Despesa registrada com sucesso.');
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
      className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3.5 shadow-sm"
    >
      <div className="border-b border-zinc-100 pb-2">
        <h2 className="text-base font-extrabold text-black">Despesa de Viagem</h2>
        <p className="text-xs text-zinc-500">Pedágio, refeição, chapa ou borracharia</p>
      </div>

      {ctx.trips.length > 0 && (
        <div>
          <label className={labelCls}>Frete em Andamento</label>
          <select className={fieldCls} value={tripId} onChange={(e) => setTripId(e.target.value)}>
            {ctx.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.origin} → {t.destination} ({t.customerName})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>Tipo de Despesa</label>
        <select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Valor (R$)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            className={fieldCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex: 50,00"
          />
        </div>
        <div>
          <label className={labelCls}>Data</label>
          <input
            required
            type="date"
            max={today()}
            className={fieldCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Descrição (Opcional)</label>
        <input
          className={fieldCls}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Almoço posto"
        />
      </div>

      <div>
        <label className={labelCls}>Foto do Comprovante (Opcional)</label>
        {preview ? (
          <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2.5 border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Comprovante"
              className="w-14 h-14 object-cover rounded-lg border border-zinc-300"
            />
            <span className="flex-1 text-xs font-semibold text-zinc-800">Foto anexada</span>
            <button
              type="button"
              onClick={() => pick(null)}
              aria-label="Remover foto"
              className="p-2 text-zinc-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <label className="flex h-12 sm:h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-xs sm:text-sm font-bold text-zinc-700 hover:border-black active:bg-zinc-100 transition">
            <Camera className="w-4 h-4 text-black" />
            <span>Tirar Foto do Recibo</span>
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

      <button type="submit" disabled={busy} className={submitBtnCls}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
        <span>{busy ? 'Gravando…' : 'CONFIRMAR DESPESA'}</span>
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
        onDone('Hodômetro salvo no aparelho.', numOdo);
      } else {
        onDone('Hodômetro atualizado com sucesso.', numOdo);
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
      className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3.5 shadow-sm"
    >
      <div className="border-b border-zinc-100 pb-2">
        <h2 className="text-base font-extrabold text-black">Atualizar Hodômetro</h2>
        <p className="text-xs text-zinc-500">Quilometragem atual no painel</p>
      </div>

      <div className="p-3 bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex justify-between items-center">
        <span>Último registrado:</span>
        <span className="text-sm font-extrabold text-black">
          {truck.currentOdometer.toLocaleString('pt-BR')} km
        </span>
      </div>

      <div>
        <label className={labelCls}>Novo KM no Painel</label>
        <input
          required
          type="number"
          inputMode="numeric"
          min={truck.currentOdometer > 0 ? truck.currentOdometer : 1}
          className={fieldCls}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={truck.currentOdometer > 0 ? `Ex: ${truck.currentOdometer + 200}` : 'Ex: 220000'}
        />
      </div>

      <button type="submit" disabled={busy} className={submitBtnCls}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gauge className="w-5 h-5" />}
        <span>{busy ? 'Gravando…' : 'CONFIRMAR KM'}</span>
      </button>
    </form>
  );
}
