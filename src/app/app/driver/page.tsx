'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Package,
  MapPin,
  Play,
  Flag,
  Plus,
  Utensils,
  Milestone,
  Users,
  Wrench,
  ParkingSquare,
  BedDouble,
  MoreHorizontal,
  ArrowRight,
  Calendar,
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

interface DriverTrip {
  id: string;
  truckId: string;
  driverId?: string;
  origin: string;
  destination: string;
  customerName: string;
  cargoDescription?: string | null;
  cargoWeightKg?: number | null;
  initialKm?: number;
  finalKm?: number | null;
  distanceKm?: number | null;
  status: string;
  startDate?: string;
  tollCosts?: number;
  loadingUnloadingCosts?: number;
  otherExpenses?: number;
  notes?: string | null;
}

interface ScheduledLoadItem {
  id: string;
  truckId?: string | null;
  driverId?: string | null;
  customerName: string;
  origin: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: number;
  pickupDate: string;
  distanceKm: number;
}

interface DriverExpenseItem {
  id: string;
  tripId?: string | null;
  truckId?: string | null;
  date: string;
  category: string;
  amount: number;
  description: string;
  receiptPhotoUrl: string | null;
}

interface DriverFuelItem {
  id: string;
  truckId: string;
  date: string;
  odometer: number;
  liters: number;
  totalAmount: number;
  pricePerLiter?: number;
}

interface Ctx {
  userName: string;
  role?: 'ADMIN' | 'DRIVER';
  driver: { id: string; name: string; cnhExpiry: string | null } | null;
  preferredTruckId?: string | null;
  trucks: DriverTruck[];
  trips: DriverTrip[];
  scheduledLoads?: ScheduledLoadItem[];
  expenses: DriverExpenseItem[];
  recentFuelLogs?: DriverFuelItem[];
}

const CTX_CACHE_KEY = 'vsm.driver.ctx.v4';
const PREF_TRUCK_KEY = 'vsm.driver.preferredTruckId.v2';

const CATEGORIES = [
  { value: 'ALIMENTACAO', label: 'Alimentação', short: 'Refeição', icon: Utensils },
  { value: 'PEDAGIO', label: 'Pedágio', short: 'Pedágio', icon: Milestone },
  { value: 'CHAPA', label: 'Chapa / Ajudante', short: 'Chapa', icon: Users },
  { value: 'BORRACHARIA', label: 'Borracharia / Pneu', short: 'Borracharia', icon: Wrench },
  { value: 'ESTACIONAMENTO', label: 'Estacionamento / Pátio', short: 'Pátio', icon: ParkingSquare },
  { value: 'HOSPEDAGEM', label: 'Pernoite / Hotel', short: 'Pernoite', icon: BedDouble },
  { value: 'OUTROS', label: 'Outros Gastos', short: 'Outros', icon: MoreHorizontal },
];

const QUICK_CARGO_SUGGESTIONS = [
  'Soja em Grãos',
  'Arroz',
  'Milho',
  'Fertilizante / Adubo',
  'Trigo',
  'Calcário',
  'Carga Geral',
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
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<{ queued?: boolean; deduplicated?: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine && method === 'POST') {
    const { deduplicated } = enqueue(url, body);
    return { queued: true, deduplicated };
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isNetworkError(e) && method === 'POST') {
      const { deduplicated } = enqueue(url, body);
      return { queued: true, deduplicated };
    }
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}

type Tab = 'cargo' | 'expense' | 'fuel' | 'odometer';

export default function DriverPage() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('cargo');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const applySmartTruckSelection = useCallback((data: Ctx) => {
    if (!data.trucks || data.trucks.length === 0) return;
    try {
      const savedLocal = localStorage.getItem(PREF_TRUCK_KEY);
      const validSaved =
        savedLocal && data.trucks.some((t) => t.id === savedLocal) ? savedLocal : null;
      const bestId =
        validSaved ||
        (data.preferredTruckId && data.trucks.some((t) => t.id === data.preferredTruckId)
          ? data.preferredTruckId
          : data.trucks[0].id);
      setSelectedTruckId((curr) =>
        curr && data.trucks.some((t) => t.id === curr) ? curr : bestId
      );
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
    { id: 'cargo', label: 'Carga Atual', icon: Package },
    { id: 'expense', label: 'Despesa Diária', icon: Receipt },
    { id: 'fuel', label: 'Abastecer', icon: Fuel },
    { id: 'odometer', label: 'Hodômetro', icon: Gauge },
  ];

  const currentTruck =
    ctx?.trucks.find((t) => t.id === selectedTruckId) ?? ctx?.trucks[0] ?? null;

  // Carga em andamento do caminhão selecionado ou do motorista
  const activeTrip = useMemo(() => {
    if (!ctx?.trips) return null;
    return (
      ctx.trips.find((t) => t.status === 'EM_VIAGEM' && t.truckId === currentTruck?.id) ??
      ctx.trips.find((t) => t.status === 'EM_VIAGEM') ??
      null
    );
  }, [ctx?.trips, currentTruck?.id]);

  // Cálculos de despesas diárias do motorista
  const expenseSummary = useMemo(() => {
    const list = ctx?.expenses ?? [];
    const todayStr = today();
    let todayTotal = 0;
    let activeTripTotal = 0;
    let monthTotal = 0;
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    for (const e of list) {
      const val = Number(e.amount) || 0;
      const dStr = (e.date || '').slice(0, 10);
      if (dStr === todayStr) {
        todayTotal += val;
      }
      if (activeTrip && e.tripId === activeTrip.id) {
        activeTripTotal += val;
      }
      const dObj = new Date(e.date);
      if (dObj.getMonth() === curMonth && dObj.getFullYear() === curYear) {
        monthTotal += val;
      }
    }

    return { todayTotal, activeTripTotal, monthTotal };
  }, [ctx?.expenses, activeTrip]);

  return (
    <div className="min-h-[100dvh] bg-zinc-100 text-zinc-900 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      {/* Header com contraste máximo */}
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
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  online ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider leading-none">
                {online ? 'Motorista Online' : 'Modo Offline'}
              </p>
            </div>
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
          className="fixed top-16 inset-x-4 z-40 mx-auto max-w-md flex items-center gap-2.5 rounded-xl p-3.5 text-sm font-bold shadow-lg border bg-black text-white border-zinc-700"
        >
          {toast.ok ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
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
            {/* Barra de Caminhão + Resumo Rápido da Carga Atual e Gasto do Dia */}
            <TruckAndStatusHeader
              trucks={ctx.trucks}
              selectedTruck={currentTruck}
              activeTrip={activeTrip}
              todayExpenseTotal={expenseSummary.todayTotal}
              onSelectTruck={handleSelectTruck}
              onGoToCargo={() => setTab('cargo')}
              onGoToExpense={() => setTab('expense')}
            />

            {tab === 'cargo' && (
              <CargoTabView
                ctx={ctx}
                truck={currentTruck}
                activeTrip={activeTrip}
                activeTripExpenseTotal={expenseSummary.activeTripTotal}
                onDone={(msg, newOdo) => {
                  if (newOdo) updateLocalOdometer(currentTruck.id, newOdo);
                  notify(true, msg);
                  load();
                }}
                onError={(m) => notify(false, m)}
                onOpenExpense={() => setTab('expense')}
              />
            )}

            {tab === 'expense' && (
              <ExpenseTabView
                ctx={ctx}
                truck={currentTruck}
                activeTrip={activeTrip}
                summary={expenseSummary}
                onDone={(m) => {
                  notify(true, m);
                  load();
                }}
                onError={(m) => notify(false, m)}
              />
            )}

            {tab === 'fuel' && (
              <FuelForm
                truck={currentTruck}
                recentLogs={
                  ctx.recentFuelLogs?.filter((f) => f.truckId === currentTruck.id) ?? []
                }
                onDone={(msg, newOdo) => {
                  if (newOdo) updateLocalOdometer(currentTruck.id, newOdo);
                  notify(true, msg);
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
          </>
        )}
      </main>

      {/* Navegação inferior (4 abas diretas e claras) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-zinc-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
        aria-label="Ações do motorista"
      >
        {tabs.map(({ id, label: l, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[58px] py-2 text-[11px] font-bold transition ${
                active
                  ? 'text-black bg-zinc-100 border-t-2 border-black'
                  : 'text-zinc-500 active:bg-zinc-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-full px-1">{l}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- Cabeçalho: Caminhão + Carga Atual + Despesa do Dia ---------------- */

function TruckAndStatusHeader({
  trucks,
  selectedTruck,
  activeTrip,
  todayExpenseTotal,
  onSelectTruck,
  onGoToCargo,
  onGoToExpense,
}: {
  trucks: DriverTruck[];
  selectedTruck: DriverTruck;
  activeTrip: DriverTrip | null;
  todayExpenseTotal: number;
  onSelectTruck: (id: string) => void;
  onGoToCargo: () => void;
  onGoToExpense: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Linha do Caminhão */}
      <div className="p-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-black text-white shrink-0">
            <TruckIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Caminhão Atual
            </p>
            <p className="text-base font-extrabold text-black truncate">
              {selectedTruck.plate} — {selectedTruck.model}
            </p>
            <p className="text-xs text-zinc-600 font-semibold">
              Painel: {selectedTruck.currentOdometer.toLocaleString('pt-BR')} km
            </p>
          </div>
        </div>

        {trucks.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-black border border-zinc-300 shrink-0"
          >
            {open ? 'Fechar' : 'Trocar'}
          </button>
        )}
      </div>

      {/* Lista de troca de caminhão */}
      {open && trucks.length > 1 && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-100 space-y-1.5">
          <p className="text-xs text-zinc-600 font-medium">
            Selecione o caminhão que está com você:
          </p>
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

      {/* Faixa Inferior de Status: Carga Atual & Despesa Hoje */}
      <div className="bg-zinc-50 border-t border-zinc-200 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={onGoToCargo}
          className="flex items-center gap-2 min-w-0 text-left flex-1"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              activeTrip ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
            }`}
          />
          <div className="min-w-0">
            {activeTrip ? (
              <>
                <span className="font-extrabold text-black block truncate">
                  Carga: {activeTrip.cargoDescription || 'Frete em Andamento'}
                </span>
                <span className="text-[11px] text-zinc-600 font-medium block truncate">
                  {activeTrip.origin} → {activeTrip.destination}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-zinc-800 block">Sem carga ativa informada</span>
                <span className="text-[11px] text-zinc-500 underline">
                  Toque para informar sua carga atual
                </span>
              </>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToExpense}
          className="shrink-0 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-right hover:border-black transition"
        >
          <span className="text-[10px] font-bold uppercase text-zinc-500 block leading-none">
            Gasto Hoje
          </span>
          <span className="text-xs font-extrabold text-black">
            {formatBRL(todayExpenseTotal)}
          </span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- ABA 1: CARGA ATUAL (O que o motorista está realizando) ---------------- */

function CargoTabView({
  ctx,
  truck,
  activeTrip,
  activeTripExpenseTotal,
  onDone,
  onError,
  onOpenExpense,
}: {
  ctx: Ctx;
  truck: DriverTruck;
  activeTrip: DriverTrip | null;
  activeTripExpenseTotal: number;
  onDone: (msg: string, newOdo?: number) => void;
  onError: (msg: string) => void;
  onOpenExpense: () => void;
}) {
  const [showNewForm, setShowNewForm] = useState(!activeTrip);
  const [finishing, setFinishing] = useState(false);
  const [finalKm, setFinalKm] = useState('');
  const [busy, setBusy] = useState(false);

  // Campos para informar nova carga atual
  const [cargoDescription, setCargoDescription] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [weightTons, setWeightTons] = useState('');
  const [initialKm, setInitialKm] = useState(
    truck.currentOdometer > 0 ? String(truck.currentOdometer) : ''
  );

  useEffect(() => {
    setShowNewForm(!activeTrip);
  }, [activeTrip]);

  const startScheduledLoad = async (sched: ScheduledLoadItem) => {
    if (busy) return;
    setBusy(true);
    try {
      await postDriverAction('/api/driver/cargo', {
        scheduleId: sched.id,
        truckId: truck.id,
        origin: sched.origin,
        destination: sched.destination,
        customerName: sched.customerName,
        cargoDescription: sched.cargoDescription,
        cargoWeightKg: sched.cargoWeightKg,
        initialKm: truck.currentOdometer,
      });
      onDone(`Carga "${sched.cargoDescription}" iniciada!`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao iniciar carga.');
    } finally {
      setBusy(false);
    }
  };

  const startPlannedTrip = async (trip: DriverTrip) => {
    if (busy) return;
    setBusy(true);
    try {
      await postDriverAction('/api/driver/cargo', {
        tripId: trip.id,
        truckId: truck.id,
        origin: trip.origin,
        destination: trip.destination,
        cargoDescription: trip.cargoDescription || 'Carga Geral',
        initialKm: truck.currentOdometer,
      });
      onDone('Viagem iniciada com sucesso!');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao iniciar viagem.');
    } finally {
      setBusy(false);
    }
  };

  const submitNewCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!cargoDescription.trim()) {
      onError('Informe qual carga você está carregando.');
      return;
    }
    if (!origin.trim() || !destination.trim()) {
      onError('Informe a cidade de saída e o destino.');
      return;
    }

    setBusy(true);
    try {
      const numKm = Number(initialKm) || truck.currentOdometer;
      const numWeightKg = weightTons ? Math.round(Number(weightTons) * 1000) : null;

      const res = await postDriverAction('/api/driver/cargo', {
        id: crypto.randomUUID(),
        truckId: truck.id,
        origin: origin.trim(),
        destination: destination.trim(),
        customerName: customerName.trim(),
        cargoDescription: cargoDescription.trim(),
        cargoWeightKg: numWeightKg,
        initialKm: numKm,
      });

      setCargoDescription('');
      setOrigin('');
      setDestination('');
      setCustomerName('');
      setWeightTons('');
      setShowNewForm(false);

      if (res.queued) {
        onDone('Carga atual salva no aparelho.', numKm);
      } else {
        onDone('Carga atual registrada com sucesso!', numKm);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao informar carga.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || busy) return;
    const numFinal = Number(finalKm) || 0;
    if (numFinal > 0 && activeTrip.initialKm && numFinal < activeTrip.initialKm) {
      onError(`O KM final não pode ser menor que o KM inicial (${activeTrip.initialKm} km).`);
      return;
    }

    setBusy(true);
    try {
      await postDriverAction(
        '/api/driver/cargo',
        {
          tripId: activeTrip.id,
          status: 'CONCLUIDO',
          finalKm: numFinal > 0 ? numFinal : undefined,
        },
        'PATCH'
      );
      setFinishing(false);
      setFinalKm('');
      onDone('Entrega concluída com sucesso!', numFinal > 0 ? numFinal : undefined);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao concluir carga.');
    } finally {
      setBusy(false);
    }
  };

  const plannedTrips = (ctx.trips ?? []).filter((t) => t.status === 'PLANEJADO');
  const scheduledLoads = ctx.scheduledLoads ?? [];

  return (
    <div className="space-y-3.5">
      {/* Cartão da Carga em Andamento */}
      {activeTrip && (
        <div className="bg-white rounded-xl border-2 border-black p-4 shadow-sm space-y-3.5">
          <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black text-white text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Carga em Andamento
              </span>
              <h2 className="text-lg font-extrabold text-black mt-2">
                {activeTrip.cargoDescription || 'Frete em Trânsito'}
              </h2>
              {activeTrip.customerName && (
                <p className="text-xs font-semibold text-zinc-600">
                  Cliente: {activeTrip.customerName}
                </p>
              )}
            </div>
            {activeTrip.cargoWeightKg ? (
              <span className="bg-zinc-100 text-black font-extrabold text-xs px-2.5 py-1 rounded-lg border border-zinc-200">
                {(activeTrip.cargoWeightKg / 1000).toFixed(1).replace('.', ',')} t
              </span>
            ) : null}
          </div>

          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <MapPin className="w-4 h-4 shrink-0 text-zinc-700" />
              <span>{activeTrip.origin}</span>
              <ArrowRight className="w-4 h-4 shrink-0 text-zinc-400" />
              <span>{activeTrip.destination}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs text-zinc-600 pt-1 border-t border-zinc-200/70">
              <span>
                KM Saída:{' '}
                <strong className="text-black">
                  {(activeTrip.initialKm || truck.currentOdometer).toLocaleString('pt-BR')} km
                </strong>
              </span>
              <span>
                Despesas na viagem:{' '}
                <strong className="text-black">{formatBRL(activeTripExpenseTotal)}</strong>
              </span>
            </div>
          </div>

          {!finishing ? (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenExpense}
                className="h-12 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-300"
              >
                <Receipt className="w-4 h-4" />
                <span>+ Despesa da Carga</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinishing(true);
                  setFinalKm('');
                }}
                className="h-12 rounded-xl bg-black hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Flag className="w-4 h-4" />
                <span>Finalizar Entrega</span>
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleFinishCargo}
              className="bg-zinc-100 rounded-xl p-3.5 space-y-3 border border-zinc-300"
            >
              <p className="text-xs font-extrabold text-black uppercase">
                Confirmar Entrega / Conclusão da Carga
              </p>
              <div>
                <label className={labelCls}>KM Final no Painel (Opcional)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={fieldCls}
                  value={finalKm}
                  onChange={(e) => setFinalKm(e.target.value)}
                  placeholder={`Maior que ${(activeTrip.initialKm || truck.currentOdometer).toLocaleString('pt-BR')} km`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFinishing(false)}
                  className="flex-1 h-11 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-700"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 h-11 rounded-xl bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirmar Entrega</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Cargas Agendadas ou Planejadas pela Administração */}
      {(plannedTrips.length > 0 || scheduledLoads.length > 0) && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
              Cargas Programadas pela Empresa
            </h3>
            <span className="text-[11px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">
              {plannedTrips.length + scheduledLoads.length} disponível(is)
            </span>
          </div>

          <div className="space-y-2">
            {plannedTrips.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-black truncate">
                    {t.cargoDescription || 'Carga Programada'} • {t.customerName}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">
                    {t.origin} → {t.destination}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startPlannedTrip(t)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-black text-white text-xs font-bold"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar</span>
                </button>
              </div>
            ))}

            {scheduledLoads.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-black truncate">
                    {s.cargoDescription} • {s.customerName}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">
                    {s.origin} → {s.destination}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startScheduledLoad(s)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-black text-white text-xs font-bold"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão para abrir formulário caso já exista uma carga ativa mas ele queira trocar */}
      {activeTrip && !showNewForm && (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full h-12 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-800 flex items-center justify-center gap-2 hover:border-black transition"
        >
          <Plus className="w-4 h-4" />
          <span>Informar Outra Carga / Nova Viagem</span>
        </button>
      )}

      {/* Formulário para o Motorista dizer qual carga está realizando no momento */}
      {showNewForm && (
        <form
          onSubmit={submitNewCargo}
          className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3.5 shadow-sm"
        >
          <div className="border-b border-zinc-100 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-black">
                Qual carga você está realizando?
              </h2>
              <p className="text-xs text-zinc-500">
                Informe o produto e o trajeto atual
              </p>
            </div>
            {activeTrip && (
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="text-xs font-bold text-zinc-500 hover:text-black"
              >
                Fechar
              </button>
            )}
          </div>

          {/* Sugestões rápidas de tipo de carga */}
          <div>
            <label className={labelCls}>O que está carregando? *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_CARGO_SUGGESTIONS.map((item) => {
                const selected = cargoDescription === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCargoDescription(item)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                      selected
                        ? 'bg-black text-white border-black'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <input
              required
              className={fieldCls}
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
              placeholder="Digite o produto ou carga"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cidade de Saída (Origem) *</label>
              <input
                required
                className={fieldCls}
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Onde carregou"
              />
            </div>
            <div>
              <label className={labelCls}>Cidade de Entrega (Destino) *</label>
              <input
                required
                className={fieldCls}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Onde vai descarregar"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Peso em Toneladas (Opcional)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                className={fieldCls}
                value={weightTons}
                onChange={(e) => setWeightTons(e.target.value)}
                placeholder="Toneladas"
              />
            </div>
            <div>
              <label className={labelCls}>KM de Saída no Painel</label>
              <input
                type="number"
                inputMode="numeric"
                className={fieldCls}
                value={initialKm}
                onChange={(e) => setInitialKm(e.target.value)}
                placeholder={String(truck.currentOdometer || '')}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Cliente / Empresa (Opcional)</label>
            <input
              className={fieldCls}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente ou cooperativa"
            />
          </div>

          <button type="submit" disabled={busy} className={submitBtnCls}>
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Package className="w-5 h-5" />
            )}
            <span>{busy ? 'Salvando…' : 'CONFIRMAR CARGA ATUAL'}</span>
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------------- ABA 2: DESPESA DIÁRIA INTEGRADA DO MOTORISTA ---------------- */

function ExpenseTabView({
  ctx,
  truck,
  activeTrip,
  summary,
  onDone,
  onError,
}: {
  ctx: Ctx;
  truck: DriverTruck;
  activeTrip: DriverTrip | null;
  summary: { todayTotal: number; activeTripTotal: number; monthTotal: number };
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [recordId, setRecordId] = useState(() => crypto.randomUUID());
  const [tripId, setTripId] = useState(activeTrip?.id ?? ctx.trips[0]?.id ?? '');
  const [category, setCategory] = useState('ALIMENTACAO');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (activeTrip?.id) {
      setTripId(activeTrip.id);
    }
  }, [activeTrip?.id]);

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
        onDone('Despesa diária salva no aparelho.');
      } else {
        onDone('Despesa diária integrada com sucesso!');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar despesa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Resumo Financeiro Diário do Motorista */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-xl border border-zinc-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Despesas de Hoje
          </span>
          <span className="text-lg font-extrabold text-black mt-0.5 block">
            {formatBRL(summary.todayTotal)}
          </span>
          <span className="text-[11px] text-zinc-500">Acumulado no dia</span>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            {activeTrip ? 'Gasto na Carga Atual' : 'Acumulado no Mês'}
          </span>
          <span className="text-lg font-extrabold text-black mt-0.5 block">
            {formatBRL(activeTrip ? summary.activeTripTotal : summary.monthTotal)}
          </span>
          <span className="text-[11px] text-zinc-500 truncate block">
            {activeTrip
              ? `${activeTrip.origin} → ${activeTrip.destination}`
              : 'Total registrado no mês'}
          </span>
        </div>
      </div>

      {/* Formulário de Lançamento Rápido de Despesa Diária */}
      <form
        onSubmit={submit}
        className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3.5 shadow-sm"
      >
        <div className="border-b border-zinc-100 pb-2">
          <h2 className="text-base font-extrabold text-black">Lançar Despesa Diária</h2>
          <p className="text-xs text-zinc-500">
            Integrado direto ao acerto da viagem e ao painel da empresa
          </p>
        </div>

        {/* Seleção rápida por botões com ícone */}
        <div>
          <label className={labelCls}>Escolha o Tipo de Gasto</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const selected = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition ${
                    selected
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-full">{c.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vínculo com a Carga Atual */}
        {ctx.trips.length > 0 && (
          <div>
            <label className={labelCls}>Vincular à Carga / Viagem</label>
            <select
              className={fieldCls}
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
            >
              {ctx.trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.cargoDescription ? `${t.cargoDescription}: ` : ''}
                  {t.origin} → {t.destination}
                </option>
              ))}
              <option value="">Sem vínculo com carga específica (Despesa Avulsa)</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Valor (R$) *</label>
            <input
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className={fieldCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
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
          <label className={labelCls}>Observação / Local (Opcional)</label>
          <input
            className={fieldCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição rápida (opcional)"
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
          <span>{busy ? 'Gravando…' : 'SALVAR DESPESA DIÁRIA'}</span>
        </button>
      </form>

      {/* Histórico de despesas diárias do motorista */}
      {ctx.expenses.length > 0 && (
        <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
              Suas Últimas Despesas Lançadas
            </h3>
            <span className="text-[11px] font-bold text-zinc-500">
              {ctx.expenses.length} registro(s)
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {ctx.expenses.slice(0, 12).map((e) => {
              const linkedTrip = ctx.trips.find((t) => t.id === e.tripId);
              return (
                <div
                  key={e.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-black block">{catLabel(e.category)}</span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {formatDate(e.date)}
                      {e.description ? ` • ${e.description}` : ''}
                      {linkedTrip ? ` • ${linkedTrip.origin} → ${linkedTrip.destination}` : ''}
                    </span>
                  </div>
                  <strong className="text-sm font-extrabold text-black shrink-0">
                    {formatBRL(e.amount)}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- ABA 3: ABASTECIMENTO ---------------- */

function nowLocalInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function FuelForm({
  truck,
  recentLogs,
  onDone,
  onError,
}: {
  truck: DriverTruck;
  recentLogs: DriverFuelItem[];
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
    <div className="space-y-3.5">
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
            placeholder="KM no painel"
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
              placeholder="Quantidade (L)"
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
              placeholder="0,00"
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

      {recentLogs.length > 0 && (
        <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 shadow-sm">
          <h3 className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
            Últimos Abastecimentos ({truck.plate})
          </h3>
          <div className="divide-y divide-zinc-100">
            {recentLogs.slice(0, 5).map((f) => (
              <div key={f.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-black">
                    {Number(f.liters).toLocaleString('pt-BR')} L •{' '}
                    {Number(f.odometer).toLocaleString('pt-BR')} km
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {formatDate(f.date)}
                  </span>
                </div>
                <strong className="text-sm font-extrabold text-black">
                  {formatBRL(f.totalAmount)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- ABA 4: HODÔMETRO ---------------- */

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
          placeholder="Digite o KM atual"
        />
      </div>

      <button type="submit" disabled={busy} className={submitBtnCls}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gauge className="w-5 h-5" />}
        <span>{busy ? 'Gravando…' : 'CONFIRMAR KM'}</span>
      </button>
    </form>
  );
}
