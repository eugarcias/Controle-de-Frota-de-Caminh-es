'use client';

import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Fuel,
  Gauge,
  AlertTriangle,
  AlertCircle,
  MapPin,
  ArrowUpRight,
  Calendar,
  Truck as TruckIcon,
  Package,
  Receipt,
  Activity,
  Navigation,
  User,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  Truck,
  Driver,
  FuelLog,
  MaintenanceLog,
  FreightTrip,
  TravelExpenseRecord,
  CargoSchedule,
} from '@/types';
import { computeDashboardMetrics } from '@/mock-data';
import { DashboardFilterBar } from '@/components/DashboardFilterBar';
import {
  DashboardFilters,
  defaultDashboardFilters,
  isDateInFilter,
} from '@/lib/dashboardFilters';
import { formatBRL, formatDate } from '@/components/ui';
import { routeLabel } from '@/lib/geo';

interface DashboardViewProps {
  trucks: Truck[];
  drivers: Driver[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  trips: FreightTrip[];
  travelExpenses?: TravelExpenseRecord[];
  schedules?: CargoSchedule[];
  onOpenQuickEntry: () => void;
}

const fmtKmL = (val: number) => val.toFixed(2).replace('.', ',');
const fmtCpk = (val: number) => val.toFixed(2).replace('.', ',');

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  ALIMENTACAO: 'Alimentação / Refeição',
  PEDAGIO: 'Pedágio',
  CHAPA: 'Chapa / Descarga',
  BORRACHARIA: 'Borracharia / Pneu',
  ESTACIONAMENTO: 'Estacionamento / Pátio',
  HOSPEDAGEM: 'Pernoite / Hotel',
  OUTROS: 'Outros Gastos',
};

const MODERN_COST_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#64748b'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  trucks,
  drivers,
  fuelLogs,
  maintenanceLogs,
  trips,
  travelExpenses = [],
  schedules = [],
  onOpenQuickEntry,
}) => {
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('ALL');
  const { truckIds: selectedTruckIds, driverIds: selectedDriverIds } = filters;

  const filteredData = useMemo(() => {
    const filteredTrips = trips.filter((t) => {
      if (t.status === 'CANCELADO') return false;
      if (!isDateInFilter(t.startDate, filters)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(t.truckId)) return false;
      if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(t.driverId)) return false;
      return true;
    });

    const filteredFuelLogs = fuelLogs.filter((f) => {
      if (!isDateInFilter(f.date, filters)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(f.truckId)) return false;
      if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(f.driverId)) return false;
      return true;
    });

    const filteredMaintenanceLogs = maintenanceLogs.filter((m) => {
      if (!isDateInFilter(m.date, filters)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(m.truckId)) return false;
      return true;
    });

    const filteredTravelExpenses = travelExpenses.filter((e) => {
      if (!isDateInFilter(e.date, filters)) return false;
      if (selectedTruckIds.length > 0 && e.truckId && !selectedTruckIds.includes(e.truckId))
        return false;
      if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(e.driverId)) return false;
      return true;
    });

    const targetTrucks =
      selectedTruckIds.length > 0
        ? trucks.filter((t) => selectedTruckIds.includes(t.id))
        : trucks;

    const metrics = computeDashboardMetrics({
      trucks: targetTrucks,
      fuelLogs: filteredFuelLogs,
      maintenanceLogs: filteredMaintenanceLogs,
      trips: filteredTrips,
      travelExpenses: filteredTravelExpenses,
    });

    const routePerformance: Record<
      string,
      { route: string; tripsCount: number; gross: number; net: number; margin: number }
    > = {};

    filteredTrips.forEach((trip) => {
      const label = routeLabel(trip);
      if (!routePerformance[label]) {
        routePerformance[label] = {
          route: label,
          tripsCount: 0,
          gross: 0,
          net: 0,
          margin: 0,
        };
      }
      routePerformance[label].tripsCount += 1;
      routePerformance[label].gross += trip.grossFreightValue;
      routePerformance[label].net += trip.netFreightValue;
    });

    const routeList = Object.values(routePerformance)
      .map((r) => ({
        ...r,
        margin: r.gross > 0 ? (r.net / r.gross) * 100 : 0,
      }))
      .sort((a, b) => b.net - a.net);

    return {
      metrics,
      filteredTrips,
      filteredFuelLogs,
      filteredMaintenanceLogs,
      filteredTravelExpenses,
      targetTrucks,
      routeList,
    };
  }, [
    trucks,
    fuelLogs,
    maintenanceLogs,
    trips,
    travelExpenses,
    filters,
    selectedTruckIds,
    selectedDriverIds,
  ]);

  const { metrics, routeList, filteredTravelExpenses, filteredTrips, filteredFuelLogs } =
    filteredData;

  // Status ao vivo de cada caminhão e qual carga está realizando no momento
  const liveFleetStatus = useMemo(() => {
    return trucks.map((truck) => {
      const activeTrip = trips.find(
        (t) => t.truckId === truck.id && t.status === 'EM_VIAGEM'
      );
      const plannedTrip = trips.find(
        (t) => t.truckId === truck.id && t.status === 'PLANEJADO'
      );
      const scheduled = schedules.find(
        (s) => s.truckId === truck.id && s.status === 'AGENDADA'
      );
      const lastFuel = fuelLogs.find((f) => f.truckId === truck.id);

      const driverId =
        activeTrip?.driverId || plannedTrip?.driverId || scheduled?.driverId || lastFuel?.driverId;
      const driver = drivers.find((d) => d.id === driverId) ?? null;

      // Soma das despesas diárias desta viagem ativa
      const tripExpensesSum = activeTrip
        ? (Number(activeTrip.tollCosts) || 0) +
          (Number(activeTrip.loadingUnloadingCosts) || 0) +
          (Number(activeTrip.otherExpenses) || 0)
        : 0;

      return {
        truck,
        driver,
        activeTrip: activeTrip ?? null,
        plannedTrip: plannedTrip ?? null,
        scheduled: scheduled ?? null,
        tripExpensesSum,
      };
    });
  }, [trucks, trips, schedules, fuelLogs, drivers]);

  const activeLoadsCount = useMemo(
    () => liveFleetStatus.filter((item) => item.activeTrip !== null).length,
    [liveFleetStatus]
  );

  const totalDriverDailyExpenses = useMemo(
    () => filteredTravelExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    [filteredTravelExpenses]
  );

  // Dados dos caminhões para o gráfico e cards
  const truckCardsData = useMemo(() => {
    return metrics.truckMetrics.map((t) => {
      const truckRevenue = filteredTrips
        .filter((tr) => tr.truckId === t.truckId)
        .reduce((sum, tr) => sum + tr.grossFreightValue, 0);

      if (selectedPeriodKey !== 'ALL') {
        const monthEntry = t.monthlyHistory.find((m) => m.periodKey === selectedPeriodKey);
        if (monthEntry) {
          return {
            ...t,
            revenue: truckRevenue,
            kmTraveled: monthEntry.distanceTraveled,
            totalLiters: monthEntry.totalLiters,
            startOdometer: monthEntry.startOdometer,
            endOdometer: monthEntry.endOdometer,
            fuelCost: monthEntry.totalFuelCost,
            monthlyAvgKmL: monthEntry.monthlyAvgKmL,
            fuelCpk: monthEntry.fuelCpk,
            isAnomalous: monthEntry.isAnomalous,
            anomalyType: monthEntry.anomalyType,
            anomalyMessage: monthEntry.anomalyMessage,
            anomalyPeriodLabel: monthEntry.periodLabel,
          };
        }
        return {
          ...t,
          revenue: 0,
          kmTraveled: 0,
          totalLiters: 0,
          startOdometer: 0,
          endOdometer: 0,
          fuelCost: 0,
          monthlyAvgKmL: 0,
          fuelCpk: 0,
          isAnomalous: false,
          anomalyType: null,
          anomalyMessage: null,
          anomalyPeriodLabel: null,
        };
      }
      return { ...t, revenue: truckRevenue };
    });
  }, [metrics.truckMetrics, selectedPeriodKey, filteredTrips]);

  const totalLitersAll = useMemo(
    () => filteredFuelLogs.reduce((acc, f) => acc + f.liters, 0),
    [filteredFuelLogs]
  );

  const coloredCostBreakdown = useMemo(() => {
    return metrics.costBreakdown.map((item, idx) => ({
      ...item,
      color: MODERN_COST_COLORS[idx % MODERN_COST_COLORS.length],
      pct:
        metrics.totalExpenses > 0
          ? Number(((item.value / metrics.totalExpenses) * 100).toFixed(1))
          : 0,
    }));
  }, [metrics.costBreakdown, metrics.totalExpenses]);

  return (
    <div className="space-y-6">
      {/* 1. HERO COMMAND CENTER */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-6 sm:p-7 shadow-xl border border-slate-800">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Telemetria &amp; Gestão em Tempo Real</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Central de Inteligência da Frota
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Monitoramento integrado de cargas em andamento, despesas diárias dos motoristas,
              consumo acumulado (km/L) e rentabilidade por veículo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Cargas Ativas
                </span>
                <span className="text-lg font-extrabold text-emerald-400">
                  {activeLoadsCount} / {trucks.length} veíc.
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  KM Monitorados
                </span>
                <span className="text-lg font-extrabold text-white">
                  {metrics.totalKmTraveled.toLocaleString('pt-BR')} km
                </span>
              </div>
            </div>

            <button
              onClick={onOpenQuickEntry}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-sm"
            >
              <Fuel className="w-4 h-4" />
              <span>+ Lançar Abastecimento</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. RADAR DE CARGAS E OPERAÇÃO EM TEMPO REAL (O que cada caminhão/motorista está fazendo agora) */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-emerald-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Status ao Vivo da Frota &amp; Cargas no Momento
              </h2>
              <p className="text-xs text-slate-500">
                Atualizado diretamente pelo aplicativo dos motoristas e programação de fretes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeLoadsCount} em viagem agora
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveFleetStatus.map(
            ({ truck, driver, activeTrip, plannedTrip, scheduled, tripExpensesSum }) => {
              const isTraveling = Boolean(activeTrip);
              const hasPlanned = !isTraveling && Boolean(plannedTrip || scheduled);

              return (
                <div
                  key={truck.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                    isTraveling
                      ? 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-slate-800 shadow-md'
                      : hasPlanned
                      ? 'bg-sky-50/50 border-sky-200 text-slate-900'
                      : 'bg-slate-50/80 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Topo do Card: Placa e Badge de Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold tracking-wider ${
                            isTraveling
                              ? 'bg-white text-slate-950'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {truck.plate}
                        </span>
                        <span
                          className={`text-xs font-bold truncate ${
                            isTraveling ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {truck.brand} {truck.model}
                        </span>
                      </div>

                      {isTraveling ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          EM CARGA
                        </span>
                      ) : hasPlanned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 text-sky-900 text-[11px] font-bold">
                          <Clock className="w-3 h-3" />
                          PROGRAMADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          DISPONÍVEL
                        </span>
                      )}
                    </div>

                    {/* Informações da Carga Atual */}
                    {activeTrip ? (
                      <div className="rounded-xl bg-white/10 border border-white/10 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-extrabold uppercase tracking-wide">
                            <Package className="w-4 h-4 shrink-0" />
                            <span>{activeTrip.cargoDescription || 'Carga em Trânsito'}</span>
                          </div>
                          {activeTrip.cargoWeightKg ? (
                            <span className="text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded text-white">
                              {(activeTrip.cargoWeightKg / 1000).toFixed(1).replace('.', ',')} t
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{activeTrip.origin}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{activeTrip.destination}</span>
                        </div>

                        <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-white/10">
                          <span className="truncate">Cliente: {activeTrip.customerName}</span>
                          {tripExpensesSum > 0 && (
                            <span className="font-bold text-amber-300 shrink-0 ml-2">
                              Despesas: {formatBRL(tripExpensesSum)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : plannedTrip || scheduled ? (
                      <div className="rounded-xl bg-white p-3 border border-sky-200/80 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                          <Package className="w-3.5 h-3.5 text-sky-600" />
                          <span>
                            {plannedTrip?.cargoDescription ||
                              scheduled?.cargoDescription ||
                              'Próxima Carga'}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <span>{plannedTrip?.origin || scheduled?.origin}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>{plannedTrip?.destination || scheduled?.destination}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white p-3 border border-slate-200/80 text-xs text-slate-500">
                        Sem carga ativa no momento. Aguardando início de viagem pelo motorista ou
                        programação.
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card: Motorista & Hodômetro */}
                  <div
                    className={`flex items-center justify-between text-xs pt-2 border-t ${
                      isTraveling
                        ? 'border-slate-800 text-slate-300'
                        : 'border-slate-200/80 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold truncate">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{driver?.name ?? 'Motorista'}</span>
                    </span>
                    <span className="font-bold shrink-0">
                      {truck.currentOdometer.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* 3. BARRA DE FILTROS GLOBAIS DINÂMICOS */}
      <DashboardFilterBar
        trucks={trucks}
        drivers={drivers}
        value={filters}
        onChange={setFilters}
        resultCount={
          filteredData.filteredTrips.length +
          filteredData.filteredFuelLogs.length +
          filteredData.filteredMaintenanceLogs.length +
          filteredData.filteredTravelExpenses.length
        }
      />

      {/* 4. CARDS DE KPIS EXECUTIVOS (HIGH-TECH) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Receita Bruta */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Faturamento Bruto
            </span>
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatBRL(metrics.totalRevenue)}
            </div>
            <div className="text-xs text-emerald-700 font-bold mt-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{filteredTrips.length} viagem(ns) contabilizada(s)</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full w-full" />
          </div>
        </div>

        {/* KPI 2: Gasto Operacional */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Custo Operacional Total
            </span>
            <div className="p-2.5 bg-rose-500/10 rounded-2xl text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
              {formatBRL(metrics.totalExpenses)}
            </div>
            <div className="text-xs text-slate-600 font-semibold mt-1.5 flex items-center justify-between">
              <span>Diesel + Oficina + Diárias</span>
              {totalDriverDailyExpenses > 0 && (
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  Diárias: {formatBRL(totalDriverDailyExpenses)}
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full"
              style={{
                width: `${
                  metrics.totalRevenue > 0
                    ? Math.min(100, Math.round((metrics.totalExpenses / metrics.totalRevenue) * 100))
                    : 60
                }%`,
              }}
            />
          </div>
        </div>

        {/* KPI 3: Lucro Líquido Real */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Resultado Líquido
            </span>
            <div
              className={`p-2.5 rounded-2xl ${
                metrics.netProfit >= 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatBRL(metrics.netProfit)}
            </div>
            <div className="text-xs font-semibold mt-1.5 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md font-extrabold text-xs ${
                  metrics.profitMarginPercent >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {metrics.profitMarginPercent}% margem
              </span>
              <span className="text-slate-500">Lucro livre</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                metrics.netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, Math.abs(metrics.profitMarginPercent)))}%`,
              }}
            />
          </div>
        </div>

        {/* KPI 4: Telemetria de Combustível */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Eficiência &amp; Consumo
            </span>
            <div className="p-2.5 bg-sky-500/10 rounded-2xl text-sky-600">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {fmtKmL(metrics.fleetAverageKmL)} <span className="text-base font-bold text-slate-500">km/L</span>
            </div>
            <div className="text-xs text-slate-600 font-semibold mt-1.5 flex items-center justify-between">
              <span>
                Diesel/KM: <strong className="text-slate-900">R$ {fmtCpk(metrics.fleetFuelCpk)}</strong>
              </span>
              <span className="text-slate-500">
                {Math.round(totalLitersAll).toLocaleString('pt-BR')} L
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((metrics.fleetAverageKmL / 4.0) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Alertas Ativos de Manutenção */}
      {metrics.activeAlerts.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-extrabold text-amber-950">
              Alertas Preditivos de Manutenção ({metrics.activeAlerts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.activeAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-white border-amber-200 text-amber-900'
                }`}
              >
                {alert.severity === 'CRITICAL' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[11px]">
                      {alert.truckPlate}
                    </span>
                    <span>{alert.truckModel}</span>
                  </div>
                  <p>{alert.message}</p>
                  <p className="text-[11px] text-slate-500">
                    Hodômetro Atual: {alert.currentOdometer.toLocaleString('pt-BR')} km • Revisão:{' '}
                    {alert.nextServiceOdometer.toLocaleString('pt-BR')} km
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. GRÁFICO PRINCIPAL: TELEMETRIA E DESEMPENHO POR CAMINHÃO + DONUT DE CUSTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Performance Operacional por Caminhão
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparativo de Quilometragem Rodada, Custo de Combustível e Eficiência (km/L)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  aria-label="Selecionar mês de referência"
                  value={selectedPeriodKey}
                  onChange={(e) => setSelectedPeriodKey(e.target.value)}
                  className="text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">
                    Período Acumulado ({metrics.truckMetrics.length} veículos)
                  </option>
                  {metrics.monthlyFuelSeries.map((m) => (
                    <option key={m.periodKey} value={m.periodKey}>
                      Mês: {m.periodLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={truckCardsData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradKm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                    </linearGradient>
                    <linearGradient id="gradFuelCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="plate"
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#0f172a' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toLocaleString('pt-BR')} km`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '14px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(value: any, name: any, item: any) => {
                      if (name === 'KM Rodados') {
                        const p = item?.payload;
                        return [
                          `${Number(value).toLocaleString('pt-BR')} km (Média: ${fmtKmL(
                            p?.monthlyAvgKmL ?? 0
                          )} km/L)`,
                          name,
                        ];
                      }
                      if (name === 'Combustível (R$)') {
                        const p = item?.payload;
                        return [
                          `${formatBRL(Number(value))} (R$ ${fmtCpk(p?.fuelCpk ?? 0)}/km)`,
                          name,
                        ];
                      }
                      return [formatBRL(Number(value)), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="kmTraveled"
                    name="KM Rodados"
                    fill="url(#gradKm)"
                    radius={[8, 8, 0, 0]}
                    barSize={38}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="fuelCost"
                    name="Combustível (R$)"
                    fill="url(#gradFuelCost)"
                    radius={[8, 8, 0, 0]}
                    barSize={38}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards de Telemetria Individual de cada Caminhão */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 border-t border-slate-100">
            {truckCardsData.map((t) => (
              <div
                key={t.truckId}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition ${
                  t.isAnomalous
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {t.plate}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      {t.kmTraveled.toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 block truncate pt-0.5">
                    {t.model} • {Math.round(t.totalLiters).toLocaleString('pt-BR')} L
                  </span>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Consumo:</span>
                    <span
                      className={`text-sm font-extrabold ${
                        t.isAnomalous ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {fmtKmL(t.monthlyAvgKmL)} km/L
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Custo Diesel:</span>
                    <span className="text-xs font-extrabold text-slate-900">
                      R$ {fmtCpk(t.fuelCpk)} / km
                    </span>
                  </div>
                </div>

                {t.isAnomalous && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl bg-rose-100 text-rose-950 border border-rose-300 px-3 py-2 text-[11px]"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold uppercase tracking-wide text-rose-800">
                        Alerta {t.anomalyPeriodLabel ? `(${t.anomalyPeriodLabel})` : ''}
                      </strong>
                      <span>
                        {t.anomalyMessage ?? 'Consumo fora da faixa padrão (2,0 a 4,5 km/L).'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Donut de Composição de Custos com Barras de Proporção */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Distribuição de Custos
                </h3>
                <p className="text-xs text-slate-500">
                  Peso de cada centro de custo na operação
                </p>
              </div>
            </div>

            <div className="h-56 w-full relative my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={coloredCostBreakdown}
                    innerRadius={60}
                    outerRadius={86}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {coloredCostBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(value: any) => formatBRL(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Gasto Total
                </span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {formatBRL(metrics.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-100 pt-3.5">
            {coloredCostBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-md shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">{item.pct}%</span>
                    <span className="font-extrabold text-slate-900">{formatBRL(item.value)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, item.pct)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. EVOLUÇÃO MENSAL DE CONSUMO E CPK (AREA + LINE COM GRADIENTE) */}
      {metrics.monthlyFuelSeries.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Curva de Evolução Mensal (Média km/L vs Custo por KM)
              </h3>
              <p className="text-xs text-slate-500">
                Histórico consolidado de rendimento energético mês a mês
              </p>
            </div>
            <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              {metrics.monthlyFuelSeries.length} período(s) analisado(s)
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={metrics.monthlyFuelSeries}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradMonthlyKml" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="periodLabel"
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="kml"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${fmtKmL(Number(v))} km/L`}
                />
                <YAxis
                  yAxisId="cpk"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${fmtCpk(Number(v))}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '14px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(val: any, name: any) => {
                    if (name === 'Média Mensal (km/L)') {
                      return [`${fmtKmL(Number(val))} km/L`, name];
                    }
                    return [`R$ ${fmtCpk(Number(val))} / km`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Area
                  yAxisId="kml"
                  type="monotone"
                  dataKey="monthlyAvgKmL"
                  name="Média Mensal (km/L)"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#gradMonthlyKml)"
                />
                <Line
                  yAxisId="cpk"
                  type="monotone"
                  dataKey="fuelCpk"
                  name="Custo de Diesel por KM (R$)"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 7. SEÇÃO DUPLA: DESPESAS DIÁRIAS DOS MOTORISTAS + CURVA DO PREÇO DO DIESEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel de Despesas Diárias Integradas do Motorista */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Despesas Diárias dos Motoristas
                </h3>
                <p className="text-xs text-slate-500">
                  Gastos lançados em tempo real pelo aplicativo na estrada
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold bg-slate-900 text-white px-3 py-1.5 rounded-xl">
              {formatBRL(totalDriverDailyExpenses)}
            </span>
          </div>

          {filteredTravelExpenses.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              Nenhuma despesa diária registrada pelos motoristas no período selecionado.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {filteredTravelExpenses.slice(0, 10).map((exp) => {
                const drv = drivers.find((d) => d.id === exp.driverId);
                const trk = trucks.find((t) => t.id === exp.truckId);
                const trp = trips.find((t) => t.id === exp.tripId);
                return (
                  <div
                    key={exp.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
                        </span>
                        {trk && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                            {trk.plate}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {drv?.name ?? 'Motorista'} • {formatDate(exp.date)}
                        {exp.description ? ` • ${exp.description}` : ''}
                        {trp ? ` • Carga: ${trp.origin} → ${trp.destination}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 shrink-0">
                      {formatBRL(exp.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gráfico: Variação do Preço do Diesel S10 nos Postos */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Curva do Preço do Diesel S10 (R$/L)
                </h3>
                <p className="text-xs text-slate-500">
                  Monitoramento dos valores pagos nos postos
                </p>
              </div>
            </div>
            {metrics.dieselPriceTrend.length > 0 && (
              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                Último: R$ {(metrics.dieselPriceTrend.at(-1)?.price ?? 0).toFixed(2).replace('.', ',')}/L
              </span>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics.dieselPriceTrend}
                margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradDieselPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(val: any, _name: any, item: any) => [
                    `R$ ${Number(val).toFixed(2)} / L (${item?.payload?.station || 'Posto'})`,
                    'Diesel S10',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#gradDieselPrice)"
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 8. RANKING DE RENTABILIDADE POR ROTA */}
      {routeList.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Rentabilidade por Rota de Destino
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo de margem líquida real entre os trajetos operados
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {routeList.length} rota(s) apurada(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {routeList.map((r, idx) => {
              const isProfit = r.net >= 0;
              return (
                <div
                  key={idx}
                  className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-extrabold text-slate-900 block truncate">
                      {r.route}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {r.tripsCount} viagem(ns) • Bruto: {formatBRL(r.gross)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-extrabold block ${
                        isProfit ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatBRL(r.net)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        r.margin >= 30
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.margin >= 10
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.margin.toFixed(1)}% margem
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
