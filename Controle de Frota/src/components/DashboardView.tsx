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
  Truck as TruckIcon,
  Filter,
  Calendar,
  Users,
  MapPin,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { DashboardMetrics, Truck, Driver, FuelLog, MaintenanceLog, FreightTrip } from '@/types';
import { computeDashboardMetrics } from '@/mock-data';
import { MultiSelect, ComboOption } from '@/components/ui/combobox';
import { formatBRL } from '@/components/ui';
import { routeLabel } from '@/lib/geo';

interface DashboardViewProps {
  trucks: Truck[];
  drivers: Driver[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  trips: FreightTrip[];
  onOpenQuickEntry: () => void;
}

type PeriodType = 'ALL' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'THIS_YEAR';

const periodLabels: Record<PeriodType, string> = {
  ALL: 'Todo o Histórico',
  THIS_MONTH: 'Mês Atual',
  LAST_30_DAYS: 'Últimos 30 Dias',
  LAST_90_DAYS: 'Últimos 90 Dias',
  THIS_YEAR: 'Este Ano',
};

function isWithinPeriod(dateStr: string, period: PeriodType): boolean {
  if (period === 'ALL') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (isNaN(d.getTime())) return true;

  if (period === 'THIS_MONTH') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === 'LAST_30_DAYS') {
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }
  if (period === 'LAST_90_DAYS') {
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 90;
  }
  if (period === 'THIS_YEAR') {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  trucks,
  drivers,
  fuelLogs,
  maintenanceLogs,
  trips,
  onOpenQuickEntry,
}) => {
  // Filtros Globais Dinâmicos
  const [period, setPeriod] = useState<PeriodType>('ALL');
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);

  // Opções para os MultiSelects
  const truckOptions: ComboOption[] = useMemo(
    () =>
      trucks.map((t) => ({
        value: t.id,
        label: t.plate,
        hint: t.model,
      })),
    [trucks]
  );

  const driverOptions: ComboOption[] = useMemo(
    () =>
      drivers.map((d) => ({
        value: d.id,
        label: d.name,
      })),
    [drivers]
  );

  // Aplicação dos Filtros Dinâmicos
  const filteredData = useMemo(() => {
    // 1. Filtra Fretes
    const filteredTrips = trips.filter((t) => {
      if (t.status === 'CANCELADO') return false;
      if (!isWithinPeriod(t.startDate, period)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(t.truckId)) return false;
      if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(t.driverId)) return false;
      return true;
    });

    // 2. Filtra Abastecimentos
    const filteredFuelLogs = fuelLogs.filter((f) => {
      if (!isWithinPeriod(f.date, period)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(f.truckId)) return false;
      if (selectedDriverIds.length > 0 && !selectedDriverIds.includes(f.driverId)) return false;
      return true;
    });

    // 3. Filtra Manutenções
    const filteredMaintenanceLogs = maintenanceLogs.filter((m) => {
      if (!isWithinPeriod(m.date, period)) return false;
      if (selectedTruckIds.length > 0 && !selectedTruckIds.includes(m.truckId)) return false;
      return true;
    });

    // 4. Caminhões relevantes para o escopo
    const targetTrucks =
      selectedTruckIds.length > 0
        ? trucks.filter((t) => selectedTruckIds.includes(t.id))
        : trucks;

    // 5. Recálculo das Métricas em Tempo Real
    const metrics = computeDashboardMetrics({
      trucks: targetTrucks,
      fuelLogs: filteredFuelLogs,
      maintenanceLogs: filteredMaintenanceLogs,
      trips: filteredTrips,
    });

    // 6. Análise de Lucro por Rota (Descoberta de Gargalos / Dinheiro na mesa)
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

    const routeList = Object.values(routePerformance).map((r) => ({
      ...r,
      margin: r.gross > 0 ? (r.net / r.gross) * 100 : 0,
    })).sort((a, b) => b.net - a.net);

    return {
      metrics,
      filteredTrips,
      filteredFuelLogs,
      filteredMaintenanceLogs,
      targetTrucks,
      routeList,
    };
  }, [trucks, drivers, fuelLogs, maintenanceLogs, trips, period, selectedTruckIds, selectedDriverIds]);

  const { metrics, routeList } = filteredData;
  const hasActiveFilters =
    period !== 'ALL' || selectedTruckIds.length > 0 || selectedDriverIds.length > 0;

  const resetFilters = () => {
    setPeriod('ALL');
    setSelectedTruckIds([]);
    setSelectedDriverIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Executivo */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl text-white shadow-md ring-1 ring-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Inteligência Financeira
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Painel Executivo da Frota</h1>
          <p className="text-xs text-slate-300 mt-1">
            Análise de CPK, margens reais de frete, consumo e detecção de gargalos financeiros.
          </p>
        </div>
        <button
          onClick={onOpenQuickEntry}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 text-sm"
        >
          <Fuel className="w-4 h-4" />
          <span>+ Lançar Abastecimento / IA</span>
        </button>
      </div>

      {/* BARRA DE FILTROS GLOBAIS DINÂMICOS NO TOPO */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros Globais em Tempo Real</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Filtro de Período */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Período
            </label>
            <select
              aria-label="Filtrar por período"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="w-full min-h-11 sm:min-h-10 text-base sm:text-sm px-3 py-2 bg-slate-50 rounded-xl ring-1 ring-slate-200 font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {(Object.keys(periodLabels) as PeriodType[]).map((p) => (
                <option key={p} value={p}>
                  {periodLabels[p]}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Multiselect de Veículos (Placas) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <TruckIcon className="w-3 h-3 text-slate-400" />
              Veículos (Placas)
            </label>
            <MultiSelect
              options={truckOptions}
              value={selectedTruckIds}
              onChange={setSelectedTruckIds}
              allLabel="Todos os Veículos"
              searchPlaceholder="Filtrar por placa..."
              aria-label="Filtro de veículos"
            />
          </div>

          {/* 3. Multiselect de Motoristas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              Motoristas
            </label>
            <MultiSelect
              options={driverOptions}
              value={selectedDriverIds}
              onChange={setSelectedDriverIds}
              allLabel="Todos os Motoristas"
              searchPlaceholder="Filtrar por motorista..."
              aria-label="Filtro de motoristas"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Exibindo dados recalculados dinamicamente para os filtros selecionados.
          </div>
        )}
      </div>

      {/* Cards de KPIs Principais (Refatorados com Hierarquia Financeira) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Faturamento Fretes */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Faturamento Bruto
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatBRL(metrics.totalRevenue)}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Receita dos fretes no escopo</span>
            </div>
          </div>
        </div>

        {/* 2. Gasto Operacional Total */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gasto Operacional
            </span>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {formatBRL(metrics.totalExpenses)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Diesel + Manutenção + Pedágios
            </div>
          </div>
        </div>

        {/* 3. Lucro Líquido Real & Margem */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lucro Líquido Real
            </span>
            <div
              className={`p-2 rounded-xl ${
                metrics.netProfit >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold ${
                metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatBRL(metrics.netProfit)}
            </div>
            <div className="text-xs font-medium mt-1 flex items-center gap-1.5">
              <span
                className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                  metrics.profitMarginPercent >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {metrics.profitMarginPercent}%
              </span>
              <span className="text-slate-500">Margem Líquida</span>
            </div>
          </div>
        </div>

        {/* 4. Consumo Médio & CPK */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Consumo & CPK Médio
            </span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {metrics.fleetAverageKmL}{' '}
              <span className="text-sm font-normal text-slate-500">km/L</span>
            </div>
            <div className="text-xs text-slate-700 font-medium mt-1">
              CPK:{' '}
              <span className="font-bold text-slate-900">R$ {metrics.fleetCpk}</span> / km
            </div>
          </div>
        </div>
      </div>

      {/* Alertas Ativos da Frota */}
      {metrics.activeAlerts.length > 0 && (
        <div className="bg-amber-50/80 ring-1 ring-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-950">
              Avisos Operacionais e Preditivos ({metrics.activeAlerts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.activeAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3.5 rounded-xl ring-1 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-50 ring-rose-200 text-rose-900'
                    : 'bg-white ring-amber-200 text-amber-900'
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
                    Hodômetro Atual: {alert.currentOdometer.toLocaleString('pt-BR')} km • Limite:{' '}
                    {alert.nextServiceOdometer.toLocaleString('pt-BR')} km
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RANKING DE RENTABILIDADE POR ROTA (Descobrindo Gargalos / Dinheiro na Mesa) */}
      {routeList.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Rentabilidade por Rota de Destino
              </h3>
              <p className="text-xs text-slate-500">
                Rotas mais rentáveis vs rotas com gargalo de margem no período filtrado
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {routeList.length} rotas monitoradas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {routeList.map((r, idx) => {
              const isProfit = r.net >= 0;
              return (
                <div
                  key={idx}
                  className="bg-slate-50 p-3.5 rounded-xl ring-1 ring-slate-200/80 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 block">{r.route}</span>
                    <span className="text-[11px] text-slate-500 block">
                      {r.tripsCount} viagem(ns) • Bruto: {formatBRL(r.gross)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-bold block ${
                        isProfit ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatBRL(r.net)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
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

      {/* Seção de Gráficos Analíticos com Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Desempenho Individual por Caminhão */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Desempenho por Caminhão (KM vs Gasto Total)
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativo de rodagem e custos gerados no filtro selecionado
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-semibold">
                {metrics.truckMetrics.length} veículo(s)
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.truckMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="plate" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'KM Rodados') return [`${value.toLocaleString()} km`, name];
                      return [formatBRL(Number(value)), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="kmTraveled"
                    name="KM Rodados"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="totalExpenses"
                    name="Gasto Total (R$)"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mini Cards Resumo por Veículo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
            {metrics.truckMetrics.map((t) => (
              <div key={t.truckId} className="bg-slate-50 p-3 rounded-xl ring-1 ring-slate-100 text-center">
                <span className="text-xs font-bold text-slate-900 block">{t.plate}</span>
                <span className="text-[11px] text-slate-500 block">{t.model}</span>
                <div className="mt-1.5 flex items-center justify-center gap-2 text-xs">
                  <span
                    className={`font-semibold ${
                      t.averageKmL < 1.8 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {t.averageKmL} km/L
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-700">R$ {t.cpk}/km</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Composição de Custos Operacionais */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Composição dos Custos</h3>
            <p className="text-xs text-slate-500 mb-2">
              Distribuição percentual dos gastos operacionais
            </p>
            <div className="h-60 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.costBreakdown}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metrics.costBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400">Total</span>
                <span className="text-sm font-bold text-slate-800">
                  {formatBRL(metrics.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 mt-2 border-t border-slate-100 pt-3">
            {metrics.costBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatBRL(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico 3: Preço do Diesel nos Postos */}
      <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Evolução do Preço do Diesel S10 (R$/Litro)
            </h3>
            <p className="text-xs text-slate-500">
              Variação histórica abastecida pelos motoristas nos postos de rodovia
            </p>
          </div>
          {metrics.dieselPriceTrend.length > 0 && (
            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              Último valor registrado: {formatBRL(metrics.dieselPriceTrend.at(-1)?.price ?? 0)}
            </div>
          )}
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.dieselPriceTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
              />
              <Tooltip
                formatter={(val: any, name: any, item: any) => [
                  `R$ ${Number(val).toFixed(2)} / L (${item?.payload?.station || 'Posto'})`,
                  'Diesel S10',
                ]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
