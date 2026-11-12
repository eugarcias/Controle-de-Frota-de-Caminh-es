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
  CalendarClock,
  BellRing,
  Pencil,
  MessageSquare,
  Clock,
  Sun,
  Moon,
  Award,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ProfileModal } from '@/components/ProfileModal';
import { getDriverRank, DRIVER_RANKS } from '@/lib/gamification';
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
  endDate?: string | null;
  /** Comissão do motorista na viagem (R$) */
  commission?: number;
  /** true = calculada pelo % padrão; false = definida pelo admin */
  commissionIsEstimate?: boolean;
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
  deliveryDate?: string | null;
  distanceKm: number;
  status?: string;
  notes?: string | null;
  commission?: number;
  commissionIsEstimate?: boolean;
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
  avatarUrl?: string | null;
  canChangeTruck?: boolean;
  role?: 'ADMIN' | 'DRIVER';
  driver: {
    id: string;
    name: string;
    cnhExpiry: string | null;
    commissionPercent?: number;
    avatarUrl?: string | null;
  } | null;
  preferredTruckId?: string | null;
  trucks: DriverTruck[];
  trips: DriverTrip[];
  recentTrips?: DriverTrip[];
  tripHistory?: DriverTrip[];
  scheduledLoads?: ScheduledLoadItem[];
  expenses: DriverExpenseItem[];
  recentFuelLogs?: DriverFuelItem[];
}

const CTX_CACHE_KEY = 'vsm.driver.ctx.v4';
const PREF_TRUCK_KEY = 'vsm.driver.preferredTruckId.v2';
const SEEN_SCHEDULES_KEY = 'vsm.driver.seenSchedules.v1';

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

type Tab = 'home' | 'cargo' | 'agenda' | 'expense' | 'fuel' | 'odometer';

export default function DriverPage() {
  const { theme, toggleTheme } = useTheme();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [seenScheduleIds, setSeenScheduleIds] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_SCHEDULES_KEY);
      if (raw) setSeenScheduleIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const markScheduleSeen = (ids: string[]) => {
    setSeenScheduleIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      try {
        localStorage.setItem(SEEN_SCHEDULES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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
    const timer = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        load();
      }
    }, 25000);
    return () => clearInterval(timer);
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

  const activeSchedules = useMemo(
    () => (ctx?.scheduledLoads ?? []).filter((s) => (s.status ?? 'AGENDADA') === 'AGENDADA'),
    [ctx?.scheduledLoads]
  );

  const unseenSchedules = useMemo(
    () => activeSchedules.filter((s) => !seenScheduleIds.includes(s.id)),
    [activeSchedules, seenScheduleIds]
  );

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: 'Início', icon: LayoutDashboard },
    { id: 'cargo', label: 'Carga', icon: Package },
    {
      id: 'agenda',
      label: 'Agenda',
      icon: CalendarClock,
      badge: activeSchedules.length > 0 ? activeSchedules.length : undefined,
    },
    { id: 'expense', label: 'Despesa', icon: Receipt },
    { id: 'fuel', label: 'Abastecer', icon: Fuel },
    { id: 'odometer', label: 'KM', icon: Gauge },
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
    <div className="min-h-[100dvh] bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-[calc(5.25rem+env(safe-area-inset-bottom))] transition-colors">
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
          {/* Alternar Tema Escuro / Claro */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {/* Botão de Perfil do Motorista com Avatar */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Perfil do Motorista"
            title="Meu Perfil e Foto"
            className="p-1 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-900 transition relative"
          >
            {ctx?.avatarUrl || ctx?.driver?.avatarUrl ? (
              <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/60 shrink-0">
                <Image
                  src={ctx.avatarUrl || ctx.driver?.avatarUrl || ''}
                  alt={ctx.userName}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200">
                {(ctx?.userName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
          </button>

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

      {/* Modal de Perfil */}
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        initialProfile={
          ctx
            ? {
                id: ctx.driver?.id || 'profile',
                name: ctx.driver?.name || ctx.userName,
                email: ctx.userName,
                role: ctx.role || 'DRIVER',
                avatarUrl: ctx.avatarUrl || ctx.driver?.avatarUrl,
                canChangeTruck: ctx.canChangeTruck ?? true,
                driver: ctx.driver
                  ? {
                      id: ctx.driver.id,
                      name: ctx.driver.name,
                      phone: '',
                      avatarUrl: ctx.avatarUrl || ctx.driver.avatarUrl,
                    }
                  : null,
                truck: currentTruck
                  ? {
                      plate: currentTruck.plate,
                      model: currentTruck.model,
                      brand: currentTruck.brand || '',
                    }
                  : null,
              }
            : null
        }
        onProfileUpdated={(upd) => {
          setCtx((prev) =>
            prev
              ? {
                  ...prev,
                  avatarUrl: upd.avatarUrl,
                  userName: upd.name || prev.userName,
                  driver: prev.driver
                    ? { ...prev.driver, name: upd.name || prev.driver.name, avatarUrl: upd.avatarUrl }
                    : null,
                }
              : null
          );
          notify(true, 'Perfil e foto atualizados!');
        }}
      />

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
            {/* Notificação ao vivo quando o Admin agenda uma nova carga para o motorista */}
            {unseenSchedules.length > 0 && (
              <div
                role="alert"
                className="rounded-2xl bg-black text-white p-4 border-2 border-emerald-400 shadow-lg space-y-2.5 animate-in fade-in"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                    <BellRing className="w-4 h-4 animate-bounce shrink-0" />
                    <span>Nova Carga Agendada pela Administração!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => markScheduleSeen(unseenSchedules.map((s) => s.id))}
                    className="text-zinc-400 hover:text-white p-1"
                    aria-label="Fechar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {unseenSchedules.slice(0, 2).map((s) => {
                  const dt = new Date(s.pickupDate).toLocaleString('pt-BR', {
                    timeZone: 'UTC',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-emerald-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {dt}
                        </span>
                        <span className="text-zinc-300 font-bold truncate">{s.customerName}</span>
                      </div>
                      <p className="text-sm font-extrabold text-white">
                        {s.origin} → {s.destination}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-zinc-300">
                          Carga: <strong className="text-white">{s.cargoDescription}</strong>
                        </p>
                        {Number(s.commission) > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
                            Comissão: {formatBRL(Number(s.commission))}
                          </span>
                        )}
                      </div>
                      {s.notes && (
                        <div className="bg-amber-500/20 border border-amber-400/40 text-amber-200 rounded-lg px-2.5 py-1.5 font-bold">
                          ⚠️ Obs. da Administração: {s.notes}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      markScheduleSeen(unseenSchedules.map((s) => s.id));
                      setTab('agenda');
                    }}
                    className="flex-1 h-10 rounded-xl bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <CalendarClock className="w-4 h-4" />
                    <span>Abrir Minha Agenda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => markScheduleSeen(unseenSchedules.map((s) => s.id))}
                    className="px-3 h-10 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-xs"
                  >
                    Ciente
                  </button>
                </div>
              </div>
            )}

            {/* Barra de Caminhão + Resumo Rápido da Carga Atual e Gasto do Dia */}
            <TruckAndStatusHeader
              trucks={ctx.trucks}
              selectedTruck={currentTruck}
              activeTrip={activeTrip}
              todayExpenseTotal={expenseSummary.todayTotal}
              canChangeTruck={ctx.canChangeTruck ?? true}
              onSelectTruck={handleSelectTruck}
              onGoToCargo={() => setTab('cargo')}
              onGoToExpense={() => setTab('expense')}
            />

            {tab === 'home' && (
              <DriverDashboardView
                ctx={ctx}
                activeTrip={activeTrip}
                monthExpenseTotal={expenseSummary.monthTotal}
                onGoTo={(t) => setTab(t)}
              />
            )}

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
                onOpenAgenda={() => setTab('agenda')}
              />
            )}

            {tab === 'agenda' && (
              <AgendaTabView
                ctx={ctx}
                truck={currentTruck}
                onStartSuccess={(msg) => {
                  notify(true, msg);
                  setTab('cargo');
                  load();
                }}
                onError={(m) => notify(false, m)}
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

      {/* Navegação inferior (6 abas diretas e claras) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-6 pb-[env(safe-area-inset-bottom)] transition-colors"
        aria-label="Ações do motorista"
      >
        {tabs.map(({ id, label: l, icon: Icon, badge }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[58px] py-2 text-[10px] sm:text-[11px] font-bold transition ${
                active
                  ? 'text-black dark:text-emerald-400 bg-zinc-100 dark:bg-zinc-800/80 border-t-2 border-black dark:border-emerald-400'
                  : 'text-zinc-500 dark:text-zinc-400 active:bg-zinc-50 dark:active:bg-zinc-800/50'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" />
                {badge && badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
              </div>
              <span className="truncate max-w-full px-0.5">{l}</span>
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
  canChangeTruck = true,
  onSelectTruck,
  onGoToCargo,
  onGoToExpense,
}: {
  trucks: DriverTruck[];
  selectedTruck: DriverTruck;
  activeTrip: DriverTrip | null;
  todayExpenseTotal: number;
  canChangeTruck?: boolean;
  onSelectTruck: (id: string) => void;
  onGoToCargo: () => void;
  onGoToExpense: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
      {/* Linha do Caminhão */}
      <div className="p-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-black dark:bg-emerald-500 text-white dark:text-black shrink-0">
            <TruckIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Caminhão Atual
              </p>
              {!canChangeTruck && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Fixo pelo Admin
                </span>
              )}
            </div>
            <p className="text-base font-extrabold text-black dark:text-white truncate">
              {selectedTruck.plate} — {selectedTruck.model}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
              Painel: {selectedTruck.currentOdometer.toLocaleString('pt-BR')} km
            </p>
          </div>
        </div>

        {trucks.length > 1 && canChangeTruck && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-black dark:text-white border border-zinc-300 dark:border-zinc-700 shrink-0 transition"
          >
            {open ? 'Fechar' : 'Trocar'}
          </button>
        )}
      </div>

      {/* Lista de troca de caminhão */}
      {open && trucks.length > 1 && canChangeTruck && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
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
                      ? 'bg-black text-white border-black dark:bg-emerald-500 dark:text-black dark:border-emerald-500'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 text-black dark:text-white border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span>
                    {t.plate} — {t.model}
                  </span>
                  <span className={active ? 'text-zinc-300 dark:text-black font-extrabold' : 'text-zinc-600 dark:text-zinc-400'}>
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
  onOpenAgenda,
}: {
  ctx: Ctx;
  truck: DriverTruck;
  activeTrip: DriverTrip | null;
  activeTripExpenseTotal: number;
  onDone: (msg: string, newOdo?: number) => void;
  onError: (msg: string) => void;
  onOpenExpense: () => void;
  onOpenAgenda: () => void;
}) {
  const [showNewForm, setShowNewForm] = useState(!activeTrip);
  const [finishing, setFinishing] = useState(false);
  const [finalKm, setFinalKm] = useState('');
  const [finishNotes, setFinishNotes] = useState('');
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
  const [notes, setNotes] = useState('');

  // Estado para Corrigir / Editar informações de um frete lançado (ativo ou recente)
  const [editingTrip, setEditingTrip] = useState<DriverTrip | null>(null);
  const [editCargo, setEditCargo] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editWeightTons, setEditWeightTons] = useState('');
  const [editInitialKm, setEditInitialKm] = useState('');
  const [editFinalKm, setEditFinalKm] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    setShowNewForm(!activeTrip);
  }, [activeTrip]);

  const openEditTrip = (trip: DriverTrip) => {
    setEditingTrip(trip);
    setEditCargo(trip.cargoDescription || '');
    setEditOrigin(trip.origin || '');
    setEditDestination(trip.destination || '');
    setEditCustomer(trip.customerName || '');
    setEditWeightTons(
      trip.cargoWeightKg ? String(Number((trip.cargoWeightKg / 1000).toFixed(2))) : ''
    );
    setEditInitialKm(trip.initialKm ? String(trip.initialKm) : '');
    setEditFinalKm(trip.finalKm ? String(trip.finalKm) : '');
    setEditNotes(trip.notes || '');
    setFinishing(false);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip || busy) return;
    if (!editCargo.trim() || !editOrigin.trim() || !editDestination.trim()) {
      onError('Preencha o produto, origem e destino para salvar a correção.');
      return;
    }

    setBusy(true);
    try {
      const weightKg = editWeightTons ? Math.round(Number(editWeightTons) * 1000) : null;
      const initKmNum = editInitialKm ? Number(editInitialKm) : undefined;
      const finKmNum = editFinalKm ? Number(editFinalKm) : undefined;

      await postDriverAction(
        '/api/driver/cargo',
        {
          tripId: editingTrip.id,
          cargoDescription: editCargo.trim(),
          origin: editOrigin.trim(),
          destination: editDestination.trim(),
          customerName: editCustomer.trim(),
          cargoWeightKg: weightKg,
          initialKm: initKmNum,
          finalKm: finKmNum,
          notes: editNotes.trim(),
        },
        'PATCH'
      );
      setEditingTrip(null);
      onDone('Informações do frete corrigidas com sucesso!', finKmNum || initKmNum);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao corrigir informações do frete.');
    } finally {
      setBusy(false);
    }
  };

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
        notes: sched.notes || '',
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
        notes: notes.trim(),
      });

      setCargoDescription('');
      setOrigin('');
      setDestination('');
      setCustomerName('');
      setWeightTons('');
      setNotes('');
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
          notes: finishNotes.trim() || activeTrip.notes || undefined,
        },
        'PATCH'
      );
      setFinishing(false);
      setFinalKm('');
      setFinishNotes('');
      onDone('Entrega concluída com sucesso!', numFinal > 0 ? numFinal : undefined);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao concluir carga.');
    } finally {
      setBusy(false);
    }
  };

  const plannedTrips = (ctx.trips ?? []).filter((t) => t.status === 'PLANEJADO');
  const scheduledLoads = (ctx.scheduledLoads ?? []).filter(
    (s) => (s.status ?? 'AGENDADA') === 'AGENDADA'
  );
  const recentCompletedTrips = (ctx.recentTrips ?? []).filter(
    (t) => t.id !== activeTrip?.id && t.status === 'CONCLUIDO'
  );

  return (
    <div className="space-y-3.5">
      {/* Modal/Painel de Correção de Informações do Frete */}
      {editingTrip && (
        <form
          onSubmit={handleSaveCorrection}
          className="bg-white rounded-xl border-2 border-black p-4 space-y-3.5 shadow-md"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 block">
                Correção de Lançamento
              </span>
              <h3 className="text-base font-extrabold text-black flex items-center gap-1.5">
                <Pencil className="w-4 h-4" />
                Corrigir Informações do Frete
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingTrip(null)}
              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className={labelCls}>Carga / Produto Transportado *</label>
            <input
              required
              className={fieldCls}
              value={editCargo}
              onChange={(e) => setEditCargo(e.target.value)}
              placeholder="Produto transportado"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cidade de Saída (Origem) *</label>
              <input
                required
                className={fieldCls}
                value={editOrigin}
                onChange={(e) => setEditOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Cidade de Entrega (Destino) *</label>
              <input
                required
                className={fieldCls}
                value={editDestination}
                onChange={(e) => setEditDestination(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Peso (Toneladas)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                className={fieldCls}
                value={editWeightTons}
                onChange={(e) => setEditWeightTons(e.target.value)}
                placeholder="Toneladas"
              />
            </div>
            <div>
              <label className={labelCls}>Cliente / Empresa</label>
              <input
                className={fieldCls}
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
                placeholder="Cliente"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>KM Inicial (Saída)</label>
              <input
                type="number"
                inputMode="numeric"
                className={fieldCls}
                value={editInitialKm}
                onChange={(e) => setEditInitialKm(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>KM Final (Chegada)</label>
              <input
                type="number"
                inputMode="numeric"
                className={fieldCls}
                value={editFinalKm}
                onChange={(e) => setEditFinalKm(e.target.value)}
                placeholder="Se já entregou"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Observação do Motorista</label>
            <textarea
              rows={2}
              className="w-full text-base font-semibold p-3 rounded-xl bg-white text-black border-2 border-zinc-300 placeholder:text-zinc-400 focus:border-black focus:outline-none"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Alguma observação sobre a carga, balança, estrada ou entrega"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingTrip(null)}
              className="flex-1 h-12 rounded-xl bg-zinc-100 border border-zinc-300 text-xs font-bold text-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-12 rounded-xl bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Salvar Correção</span>
            </button>
          </div>
        </form>
      )}

      {/* Cartão da Carga em Andamento */}
      {activeTrip && !editingTrip && (
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
            <div className="flex flex-col items-end gap-1.5">
              <CommissionTag
                value={activeTrip.commission}
                isEstimate={activeTrip.commissionIsEstimate}
              />
              {activeTrip.cargoWeightKg ? (
                <span className="bg-zinc-100 text-black font-extrabold text-xs px-2.5 py-1 rounded-lg border border-zinc-200">
                  {(activeTrip.cargoWeightKg / 1000).toFixed(1).replace('.', ',')} t
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => openEditTrip(activeTrip)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-black border border-zinc-300 text-[11px] font-bold"
              >
                <Pencil className="w-3 h-3" />
                <span>Corrigir / Editar</span>
              </button>
            </div>
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

          {activeTrip.notes && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase text-[10px] text-amber-800 block">
                  Observação da Carga
                </span>
                <span className="font-semibold">{activeTrip.notes}</span>
              </div>
            </div>
          )}

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
                  setFinishNotes(activeTrip.notes || '');
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
              <div>
                <label className={labelCls}>Observação da Entrega (Opcional)</label>
                <input
                  className={fieldCls}
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder="Observação final ou ocorrência"
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

      {/* Atalho para Cargas Agendadas pela Administração */}
      {(plannedTrips.length > 0 || scheduledLoads.length > 0) && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-black" />
              <span>Sua Agenda de Cargas ({plannedTrips.length + scheduledLoads.length})</span>
            </h3>
            <button
              type="button"
              onClick={onOpenAgenda}
              className="text-xs font-extrabold text-black underline"
            >
              Ver agenda completa
            </button>
          </div>

          <div className="space-y-2">
            {scheduledLoads.slice(0, 3).map((s) => {
              const dt = new Date(s.pickupDate).toLocaleString('pt-BR', {
                timeZone: 'UTC',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-black text-white px-2 py-0.5 rounded mb-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        {dt}
                      </span>
                      <p className="text-xs font-extrabold text-black truncate">
                        {s.cargoDescription} • {s.customerName}
                      </p>
                      <p className="text-xs text-zinc-700 font-semibold truncate">
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
                  {s.notes && (
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-2.5 py-1.5 font-semibold">
                      ⚠️ Obs. Admin: {s.notes}
                    </div>
                  )}
                </div>
              );
            })}

            {plannedTrips.slice(0, 2).map((t) => (
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
                  {t.notes && (
                    <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                      ⚠️ Obs: {t.notes}
                    </p>
                  )}
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
          </div>
        </div>
      )}

      {/* Botão para abrir formulário caso já exista uma carga ativa mas ele queira trocar */}
      {activeTrip && !showNewForm && !editingTrip && (
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
      {showNewForm && !editingTrip && (
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
                Informe o produto, trajeto e observações da viagem
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

          <div>
            <label className={labelCls}>Observação do Motorista (Opcional)</label>
            <textarea
              rows={2}
              className="w-full text-base font-semibold p-3 rounded-xl bg-white text-black border-2 border-zinc-300 placeholder:text-zinc-400 focus:border-black focus:outline-none transition-colors"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Algum detalhe sobre a carga, balança, estrada ou horário"
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

      {/* Últimas Cargas Realizadas pelo Motorista (com opção de Corrigir Informações) */}
      {recentCompletedTrips.length > 0 && !editingTrip && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
              Suas Últimas Cargas Lançadas
            </h3>
            <span className="text-[11px] text-zinc-500">Toque em Corrigir se precisar ajustar</span>
          </div>

          <div className="space-y-2">
            {recentCompletedTrips.slice(0, 4).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-black truncate">
                    {t.cargoDescription || 'Frete'} • {t.origin} → {t.destination}
                  </p>
                  <p className="text-zinc-500 truncate">
                    {t.startDate ? formatDate(t.startDate) : ''} • {t.customerName}
                  </p>
                  {t.notes && (
                    <p className="text-amber-800 font-medium truncate mt-0.5">
                      Obs: {t.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEditTrip(t)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-300 text-black font-bold hover:border-black"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Corrigir</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- ABA 2: PAINEL DE AGENDA DO MOTORISTA (Horários, Destinos e Observações do Admin) ---------------- */

function AgendaTabView({
  ctx,
  truck,
  onStartSuccess,
  onError,
}: {
  ctx: Ctx;
  truck: DriverTruck;
  onStartSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const schedules = useMemo(() => ctx.scheduledLoads ?? [], [ctx.scheduledLoads]);
  const plannedTrips = useMemo(
    () => (ctx.trips ?? []).filter((t) => t.status === 'PLANEJADO'),
    [ctx.trips]
  );

  const getTruckLabel = (id?: string | null) => {
    if (!id) return truck.plate;
    return ctx.trucks.find((t) => t.id === id)?.plate ?? truck.plate;
  };

  const handleStartSchedule = async (s: ScheduledLoadItem) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      await postDriverAction('/api/driver/cargo', {
        scheduleId: s.id,
        truckId: s.truckId || truck.id,
        origin: s.origin,
        destination: s.destination,
        customerName: s.customerName,
        cargoDescription: s.cargoDescription,
        cargoWeightKg: s.cargoWeightKg,
        initialKm: truck.currentOdometer,
        notes: s.notes || '',
      });
      onStartSuccess(`Carga "${s.cargoDescription}" iniciada! Boa viagem!`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao iniciar carga da agenda.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartPlanned = async (t: DriverTrip) => {
    if (busyId) return;
    setBusyId(t.id);
    try {
      await postDriverAction('/api/driver/cargo', {
        tripId: t.id,
        truckId: t.truckId || truck.id,
        origin: t.origin,
        destination: t.destination,
        cargoDescription: t.cargoDescription || 'Carga Geral',
        initialKm: truck.currentOdometer,
      });
      onStartSuccess('Viagem iniciada! Boa viagem!');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao iniciar viagem.');
    } finally {
      setBusyId(null);
    }
  };

  const fmtFullDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-3.5">
      <div className="bg-black text-white rounded-xl p-4 space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
            <CalendarClock className="w-4 h-4" />
            Painel de Agenda do Motorista
          </span>
          <span className="text-xs font-bold bg-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-200">
            {schedules.length + plannedTrips.length} programada(s)
          </span>
        </div>
        <h2 className="text-base font-extrabold">Suas Próximas Cargas e Horários</h2>
        <p className="text-xs text-zinc-400">
          Confira horários de coleta, destinos prontos e recomendações da administração.
        </p>
      </div>

      {schedules.length === 0 && plannedTrips.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center space-y-2">
          <CalendarClock className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-extrabold text-zinc-800">
            Nenhuma carga agendada para você no momento.
          </p>
          <p className="text-xs text-zinc-500">
            Assim que a administração programar uma nova coleta, você receberá um aviso aqui no topo da tela.
          </p>
        </div>
      )}

      {schedules.map((s) => {
        const isInTransit = s.status === 'EM_TRANSITO';
        return (
          <div
            key={s.id}
            className="bg-white rounded-xl border-2 border-zinc-200 p-4 space-y-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2.5">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-black text-white text-xs font-extrabold px-2.5 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    {fmtFullDateTime(s.pickupDate)}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                      isInTransit
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {isInTransit ? 'Em Trânsito' : 'Agendada'}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">
                  Cliente: <strong className="text-black">{s.customerName}</strong> • Caminhão:{' '}
                  <strong className="text-black">{getTruckLabel(s.truckId)}</strong>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <CommissionTag
                  value={s.commission}
                  isEstimate={s.commissionIsEstimate}
                  size="lg"
                />
                {s.cargoWeightKg > 0 && (
                  <span className="text-xs font-extrabold bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg text-black">
                    {(s.cargoWeightKg / 1000).toFixed(1).replace('.', ',')} t
                  </span>
                )}
              </div>
            </div>

            {/* Rota e Carga Prontas */}
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-black">
                <MapPin className="w-4 h-4 text-zinc-700 shrink-0" />
                <span>{s.origin}</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>{s.destination}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-zinc-600 pt-1 border-t border-zinc-200/70">
                <span>
                  Carga: <strong className="text-black">{s.cargoDescription}</strong>
                </span>
                {s.distanceKm > 0 && (
                  <span>
                    Distância: <strong className="text-black">{s.distanceKm} km</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Observação / Instrução do Admin (ex: Precisa Abastecer) */}
            {s.notes && (
              <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                    Orientação da Administração para Esta Viagem
                  </span>
                  <span className="font-bold text-sm">{s.notes}</span>
                </div>
              </div>
            )}

            {!isInTransit && (
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleStartSchedule(s)}
                className={submitBtnCls}
              >
                {busyId === s.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>INICIAR ESTA CARGA AGORA</span>
              </button>
            )}
          </div>
        );
      })}

      {plannedTrips.map((t) => (
        <div
          key={t.id}
          className="bg-white rounded-xl border-2 border-zinc-200 p-4 space-y-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold bg-zinc-900 text-white px-2.5 py-1 rounded-lg">
                Viagem Planejada • {t.startDate ? formatDate(t.startDate) : 'Hoje'}
              </span>
              <span className="text-xs font-bold text-zinc-600 block mt-1">{t.customerName}</span>
            </div>
            <CommissionTag value={t.commission} isEstimate={t.commissionIsEstimate} size="lg" />
          </div>

          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 space-y-1">
            <p className="text-sm font-extrabold text-black">
              {t.origin} → {t.destination}
            </p>
            <p className="text-xs text-zinc-600">
              Carga: <strong className="text-black">{t.cargoDescription || 'Carga Geral'}</strong>
            </p>
          </div>

          {t.notes && (
            <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 text-xs text-amber-950">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                Orientação da Administração
              </span>
              <span className="font-bold">{t.notes}</span>
            </div>
          )}

          <button
            type="button"
            disabled={busyId === t.id}
            onClick={() => handleStartPlanned(t)}
            className={submitBtnCls}
          >
            {busyId === t.id ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            <span>INICIAR VIAGEM</span>
          </button>
        </div>
      ))}
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

/* ---------------- Selo de comissão (definida pelo admin / estimada / a definir) ---------------- */

function CommissionTag({
  value,
  isEstimate,
  size = 'sm',
}: {
  value?: number;
  isEstimate?: boolean;
  size?: 'sm' | 'lg';
}) {
  const v = Number(value) || 0;
  if (v <= 0) {
    return (
      <span className="inline-flex items-center rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
        Comissão a definir
      </span>
    );
  }
  return (
    <span
      className={`inline-flex flex-col items-end rounded-lg bg-emerald-50 border border-emerald-300 ${
        size === 'lg' ? 'px-3 py-1.5' : 'px-2 py-0.5'
      }`}
    >
      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 leading-tight">
        {isEstimate ? 'Comissão estimada' : 'Sua comissão'}
      </span>
      <span
        className={`font-extrabold text-emerald-700 leading-tight ${
          size === 'lg' ? 'text-lg' : 'text-sm'
        }`}
      >
        {formatBRL(v)}
      </span>
    </span>
  );
}

/* ---------------- ABA INÍCIO: DASHBOARD DO MOTORISTA (ganhos e produção) ---------------- */

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function DriverDashboardView({
  ctx,
  activeTrip,
  monthExpenseTotal,
  onGoTo,
}: {
  ctx: Ctx;
  activeTrip: DriverTrip | null;
  monthExpenseTotal: number;
  onGoTo: (t: Tab) => void;
}) {
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedKey, setSelectedKey] = useState(curKey);
  const [showReportModal, setShowReportModal] = useState(false);

  const history = useMemo(() => ctx.tripHistory ?? ctx.recentTrips ?? [], [ctx.tripHistory, ctx.recentTrips]);
  const schedules = useMemo(
    () => (ctx.scheduledLoads ?? []).filter((s) => (s.status ?? 'AGENDADA') === 'AGENDADA'),
    [ctx.scheduledLoads]
  );
  const pct = ctx.driver?.commissionPercent ?? 10;

  // Gamificação: Total de cargas entregues no histórico
  const allDeliveredLoadsCount = useMemo(
    () => history.filter((t) => t.status === 'CONCLUIDO').length,
    [history]
  );
  const rankInfo = useMemo(() => getDriverRank(allDeliveredLoadsCount), [allDeliveredLoadsCount]);

  const monthKeyOf = (iso?: string | null) => (iso ? iso.slice(0, 7) : '');

  // Últimos 6 meses (para gráfico e seletor)
  const last6 = useMemo(() => {
    const arr: { key: string; label: string; total: number; loads: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthTrips = history.filter((t) => monthKeyOf(t.startDate) === key && t.status !== 'PLANEJADO');
      arr.push({
        key,
        label: MONTH_SHORT[d.getMonth()],
        total: monthTrips.reduce((a, t) => a + (Number(t.commission) || 0), 0),
        loads: monthTrips.length,
      });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const maxBar = Math.max(1, ...last6.map((m) => m.total));

  const monthTrips = useMemo(
    () =>
      history.filter((t) => monthKeyOf(t.startDate) === selectedKey && t.status !== 'PLANEJADO'),
    [history, selectedKey]
  );

  const stats = useMemo(() => {
    const done = monthTrips.filter((t) => t.status === 'CONCLUIDO');
    const running = monthTrips.filter((t) => t.status === 'EM_VIAGEM');
    const confirmed = done.reduce((a, t) => a + (Number(t.commission) || 0), 0);
    const inProgress = running.reduce((a, t) => a + (Number(t.commission) || 0), 0);
    const km = monthTrips.reduce((a, t) => {
      const k =
        t.distanceKm ??
        (t.finalKm && t.initialKm ? Math.max(0, t.finalKm - t.initialKm) : 0);
      return a + (Number(k) || 0);
    }, 0);
    return {
      confirmed,
      inProgress,
      total: confirmed + inProgress,
      doneCount: done.length,
      runningCount: running.length,
      km,
    };
  }, [monthTrips]);

  const forecast = useMemo(
    () => schedules.reduce((a, s) => a + (Number(s.commission) || 0), 0),
    [schedules]
  );

  const isCurrentMonth = selectedKey === curKey;
  const selectedLabel = (() => {
    const [y, m] = selectedKey.split('-').map(Number);
    return `${MONTH_SHORT[(m || 1) - 1]}/${y}`;
  })();

  const nextSchedule = schedules[0];

  return (
    <div className="space-y-3.5">
      {/* CARD DE GAMIFICAÇÃO: NÍVEL DO MOTORISTA NO TRANSPORTE */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 p-4 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {rankInfo.currentRank.badge}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                  Nível {rankInfo.currentRank.level} • Carreira
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {Math.round((rankInfo.currentRank.bonusMultiplier - 1) * 100)}% bônus
                </span>
              </div>
              <h2 className="text-base font-extrabold truncate text-white">
                {rankInfo.currentRank.title}
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                {allDeliveredLoadsCount} cargas entregues no histórico
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Relatório</span>
            <span className="sm:hidden">Desempenho</span>
          </button>
        </div>

        {/* Barra de Progresso para o próximo nível */}
        <div className="mt-3.5 pt-3 border-t border-zinc-800/80 relative z-10 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-medium">
              {rankInfo.nextRank ? (
                <>
                  Próximo nível: <strong className="text-white font-bold">{rankInfo.nextRank.badge} {rankInfo.nextRank.title}</strong>
                </>
              ) : (
                <strong className="text-emerald-400 font-extrabold">🏆 Nível Máximo Alcançado!</strong>
              )}
            </span>
            <span className="font-extrabold text-emerald-400">
              {rankInfo.nextRank ? `${rankInfo.loadsForNext} carga(s) restante(s)` : 'Elite da Frota'}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
              style={{ width: `${rankInfo.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* HERO: Ganhos do mês */}
      <div className="rounded-2xl bg-black dark:bg-zinc-900 text-white p-4 space-y-3 shadow-md relative overflow-hidden border border-zinc-800 transition-colors">
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
            Seus ganhos • {selectedLabel}
          </span>
          <span className="text-[11px] font-bold bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded-full">
            Comissão padrão: {pct}%
          </span>
        </div>

        <div className="relative">
          <p className="text-4xl font-extrabold tracking-tight">{formatBRL(stats.total)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {stats.doneCount + stats.runningCount} carga(s) no mês •{' '}
            {stats.km.toLocaleString('pt-BR')} km
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-zinc-900/90 dark:bg-zinc-950/80 border border-zinc-800 p-2.5">
            <span className="text-[10px] font-bold uppercase text-zinc-400 block">Confirmado</span>
            <span className="font-extrabold text-emerald-400 block">{formatBRL(stats.confirmed)}</span>
            <span className="text-[10px] text-zinc-500">{stats.doneCount} entregue(s)</span>
          </div>
          <div className="rounded-xl bg-zinc-900/90 dark:bg-zinc-950/80 border border-zinc-800 p-2.5">
            <span className="text-[10px] font-bold uppercase text-zinc-400 block">Em viagem</span>
            <span className="font-extrabold text-amber-300 block">{formatBRL(stats.inProgress)}</span>
            <span className="text-[10px] text-zinc-500">{stats.runningCount} ativa(s)</span>
          </div>
          <div className="rounded-xl bg-zinc-900/90 dark:bg-zinc-950/80 border border-zinc-800 p-2.5">
            <span className="text-[10px] font-bold uppercase text-zinc-400 block">Previsto</span>
            <span className="font-extrabold text-sky-300 block">{formatBRL(forecast)}</span>
            <span className="text-[10px] text-zinc-500">{schedules.length} agendada(s)</span>
          </div>
        </div>
      </div>

      {/* Gráfico: comissão dos últimos 6 meses (toque para filtrar) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
            Comissão por mês
          </h3>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setSelectedKey(curKey)}
              className="text-[11px] font-bold underline text-zinc-600 dark:text-zinc-400"
            >
              Voltar ao mês atual
            </button>
          )}
        </div>
        <div className="flex items-end justify-between gap-2 h-32">
          {last6.map((m) => {
            const h = Math.max(4, Math.round((m.total / maxBar) * 100));
            const active = m.key === selectedKey;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedKey(m.key)}
                className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                aria-label={`${m.label}: ${formatBRL(m.total)}`}
              >
                <span className={`text-[9px] font-bold ${active ? 'text-black dark:text-white' : 'text-zinc-400'}`}>
                  {m.total > 0 ? `${Math.round(m.total / 100) / 10}k` : ''}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    active ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span className={`text-[11px] font-bold ${active ? 'text-black dark:text-white' : 'text-zinc-500'}`}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onGoTo('cargo')}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-left shadow-sm transition-colors"
        >
          <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" /> Carga atual
          </span>
          {activeTrip ? (
            <>
              <span className="text-sm font-extrabold text-black dark:text-white block truncate mt-1">
                {activeTrip.cargoDescription || 'Em viagem'}
              </span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block truncate">
                → {activeTrip.destination}
              </span>
              {Number(activeTrip.commission) > 0 && (
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  {formatBRL(Number(activeTrip.commission))}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 block mt-1">Nenhuma ativa</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onGoTo('agenda')}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-left shadow-sm transition-colors"
        >
          <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5" /> Próxima carga
          </span>
          {nextSchedule ? (
            <>
              <span className="text-sm font-extrabold text-black dark:text-white block mt-1">
                {new Date(nextSchedule.pickupDate).toLocaleString('pt-BR', {
                  timeZone: 'UTC',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block truncate">
                → {nextSchedule.destination}
              </span>
              {Number(nextSchedule.commission) > 0 && (
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  {formatBRL(Number(nextSchedule.commission))}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 block mt-1">Sem agendamentos</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onGoTo('expense')}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-left shadow-sm transition-colors"
        >
          <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5" /> Despesas do mês
          </span>
          <span className="text-base font-extrabold text-black dark:text-white block mt-1">
            {formatBRL(monthExpenseTotal)}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Lançadas por você</span>
        </button>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm transition-colors">
          <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" /> Média por carga
          </span>
          <span className="text-base font-extrabold text-black dark:text-white block mt-1">
            {formatBRL(
              stats.doneCount + stats.runningCount > 0
                ? stats.total / (stats.doneCount + stats.runningCount)
                : 0
            )}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">de comissão</span>
        </div>
      </div>

      {/* Próximas cargas agendadas com comissão prevista */}
      {schedules.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              Quanto você vai ganhar nas próximas cargas
            </h3>
            <button
              type="button"
              onClick={() => onGoTo('agenda')}
              className="text-[11px] font-bold underline text-zinc-600 dark:text-zinc-400"
            >
              Agenda
            </button>
          </div>
          {schedules.slice(0, 4).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-black dark:text-white truncate">
                  {s.origin} → {s.destination}
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                  {new Date(s.pickupDate).toLocaleString('pt-BR', {
                    timeZone: 'UTC',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {s.cargoDescription}
                </p>
              </div>
              <CommissionTag value={s.commission} isEstimate={s.commissionIsEstimate} />
            </div>
          ))}
        </div>
      )}

      {/* Extrato de comissão por viagem no mês */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
            Comissão por viagem • {selectedLabel}
          </h3>
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{monthTrips.length} viagem(ns)</span>
        </div>

        {monthTrips.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 text-center">
            Nenhuma viagem registrada neste mês.
          </p>
        ) : (
          monthTrips.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      t.status === 'EM_VIAGEM'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}
                  >
                    {t.status === 'EM_VIAGEM' ? 'Em viagem' : 'Entregue'}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t.startDate ? formatDate(t.startDate) : ''}
                  </span>
                </div>
                <p className="text-xs font-extrabold text-black dark:text-white truncate mt-0.5">
                  {t.origin} → {t.destination}
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                  {t.cargoDescription || 'Carga'} • {t.customerName}
                </p>
              </div>
              <CommissionTag value={t.commission} isEstimate={t.commissionIsEstimate} />
            </div>
          ))
        )}

        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-1">
          “Sua comissão” = valor definido pela administração no agendamento. “Estimada” = calculada
          pelo seu percentual padrão ({pct}%). Valores finais são confirmados no fechamento.
        </p>
      </div>

      {/* MODAL: RELATÓRIO MENSAL DE DESEMPENHO DO MOTORISTA */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500 text-black">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-black dark:text-white">
                    Relatório de Desempenho
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {ctx.driver?.name ?? ctx.userName} • {selectedLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo executivo do relatório */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">
                  Cargas Realizadas
                </span>
                <span className="text-lg font-extrabold text-black dark:text-white block mt-0.5">
                  {stats.doneCount + stats.runningCount} viagem(ns)
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {stats.doneCount} entregues • {stats.runningCount} ativas
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">
                  KM Rodado no Mês
                </span>
                <span className="text-lg font-extrabold text-black dark:text-white block mt-0.5">
                  {stats.km.toLocaleString('pt-BR')} km
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                  Média: {stats.doneCount + stats.runningCount > 0 ? Math.round(stats.km / (stats.doneCount + stats.runningCount)) : 0} km/viagem
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">
                  Comissão Líquida
                </span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {formatBRL(stats.total)}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {stats.confirmed > 0 ? `${formatBRL(stats.confirmed)} faturado` : 'Aguardando entrega'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 block">
                  Despesas Lançadas
                </span>
                <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 block mt-0.5">
                  {formatBRL(monthExpenseTotal)}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Alimentação, pedágio, etc.
                </span>
              </div>
            </div>

            {/* Destaque da Carreira e Gamificação no Relatório */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-500 flex items-center gap-1.5">
                  <span>{rankInfo.currentRank.badge}</span>
                  <span>{rankInfo.currentRank.title}</span>
                </span>
                <span className="text-[10px] font-extrabold text-zinc-400">
                  Nível {rankInfo.currentRank.level} de 5
                </span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {rankInfo.currentRank.description}
              </p>
            </div>

            {/* Lista detalhada das viagens do mês no relatório */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Detalhamento das Viagens
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {monthTrips.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-2">Sem viagens no período selecionado.</p>
                ) : (
                  monthTrips.map((t, idx) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-black dark:text-white truncate">
                          {idx + 1}. {t.origin} → {t.destination}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {t.cargoDescription || 'Carga'} • {t.distanceKm || 0} km
                        </p>
                      </div>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {formatBRL(Number(t.commission) || 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Botões de Ação do Relatório */}
            <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
