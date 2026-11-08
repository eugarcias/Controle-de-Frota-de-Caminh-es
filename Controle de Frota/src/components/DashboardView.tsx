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
  Sparkles,
  ArrowUpRight,
  Calendar,
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
import { Truck, Driver, FuelLog, MaintenanceLog, FreightTrip } from '@/types';
import { computeDashboardMetrics } from '@/mock-data';
import { DashboardFilterBar } from '@/components/DashboardFilterBar';
import { DashboardFilters, defaultDashboardFilters, isDateInFilter } from '@/lib/dashboardFilters';
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

const fmtKmL = (val: number) => val.toFixed(1).replace('.', ',');
const fmtCpk = (val: number) => val.toFixed(2).replace('.', ',');

export const DashboardView: React.FC<DashboardViewProps> = ({
  trucks,
  drivers,
  fuelLogs,
  maintenanceLogs,
  trips,
  onOpenQuickEntry,
}) => {
  // Filtros Globais Dinâmicos
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters);
  // Filtro opcional de mês específico para inspeção da Média Mensal Acumulada por caminhão
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

    const targetTrucks =
      selectedTruckIds.length > 0
        ? trucks.filter((t) => selectedTruckIds.includes(t.id))
        : trucks;

    const metrics = computeDashboardMetrics({
      trucks: targetTrucks,
      fuelLogs: filteredFuelLogs,
      maintenanceLogs: filteredMaintenanceLogs,
      trips: filteredTrips,
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
      targetTrucks,
      routeList,
    };
  }, [trucks, drivers, fuelLogs, maintenanceLogs, trips, filters, selectedTruckIds, selectedDriverIds]);

  const { metrics, routeList } = filteredData;

  // Quando o administrador escolhe um mês específico no seletor de mês, exibe os dados daquele mês no card do caminhão
  const truckCardsData = useMemo(() => {
    return metrics.truckMetrics.map((t) => {
      if (selectedPeriodKey !== 'ALL') {
        const monthEntry = t.monthlyHistory.find((m) => m.periodKey === selectedPeriodKey);
        if (monthEntry) {
          return {
            ...t,
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
      return t;
    });
  }, [metrics.truckMetrics, selectedPeriodKey]);

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
              Inteligência Financeira • Média Mensal Acumulada
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Painel Executivo da Frota</h1>
          <p className="text-xs text-slate-300 mt-1">
            Análise de CPK, Média Mensal (km/L), Custo de Diesel por KM e detecção de anomalias.
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
      <DashboardFilterBar
        trucks={trucks}
        drivers={drivers}
        value={filters}
        onChange={setFilters}
        resultCount={
          filteredData.filteredTrips.length +
          filteredData.filteredFuelLogs.length +
          filteredData.filteredMaintenanceLogs.length
        }
      />

      {/* Cards de KPIs Principais */}
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

        {/* 4. Média Mensal & Custo de Diesel por KM */}
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Eficiência de Combustível
            </span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900">
              Média Mensal: {fmtKmL(metrics.fleetAverageKmL)} km/L
            </div>
            <div className="text-xs text-slate-700 font-semibold mt-1">
              Custo de Diesel por KM:{' '}
              <span className="font-bold text-slate-900">R$ {fmtCpk(metrics.fleetFuelCpk)}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              CPK Total: R$ {fmtCpk(metrics.fleetCpk)} / km
            </div>
          </div>
        </div>
      </div>

      {/* Alertas Ativos da Frota (Manutenção) */}
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

      {/* Desempenho Mensal Acumulado por Caminhão (Cards + Gráficos) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Desempenho por Caminhão (Média Mensal Acumulada)
                </h3>
                <p className="text-xs text-slate-500">
                  Fórmula: (MAX(odômetro) − MIN(odômetro)) ÷ SOMA(litros) • Alerta se &lt; 2,0 ou &gt; 4,5 km/L (&gt; 1.000 km)
                </p>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  aria-label="Selecionar mês de referência"
                  value={selectedPeriodKey}
                  onChange={(e) => setSelectedPeriodKey(e.target.value)}
                  className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="ALL">Acumulado do período ({metrics.truckMetrics.length} veíc.)</option>
                  {metrics.monthlyFuelSeries.map((m) => (
                    <option key={m.periodKey} value={m.periodKey}>
                      Mês: {m.periodLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={truckCardsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    formatter={(value: any, name: any, item: any) => {
                      if (name === 'KM Rodados') {
                        const p = item?.payload;
                        return [
                          `${Number(value).toLocaleString('pt-BR')} km (Média Mensal: ${fmtKmL(p?.monthlyAvgKmL ?? 0)} km/L)`,
                          name,
                        ];
                      }
                      if (name === 'Combustível (R$)') {
                        const p = item?.payload;
                        return [
                          `${formatBRL(Number(value))} (Custo de Diesel por KM: R$ ${fmtCpk(p?.fuelCpk ?? 0)})`,
                          name,
                        ];
                      }
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
                    dataKey="fuelCost"
                    name="Combustível (R$)"
                    fill="#0ea5e9"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards de Desempenho Individual de cada Caminhão */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            {truckCardsData.map((t) => (
              <div
                key={t.truckId}
                className={`p-4 rounded-2xl ring-1 flex flex-col justify-between gap-2.5 ${
                  t.isAnomalous
                    ? 'bg-amber-50/70 ring-amber-300'
                    : 'bg-slate-50 ring-slate-200/80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{t.plate}</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {t.kmTraveled.toLocaleString('pt-BR')} km • {t.totalLiters.toLocaleString('pt-BR')} L
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 block truncate">{t.model}</span>
                </div>

                {/* Métricas consolidadas exigidas */}
                <div className="bg-white rounded-xl p-3 ring-1 ring-slate-200/70 space-y-1">
                  <div
                    className={`text-sm font-bold ${
                      t.isAnomalous ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    Média Mensal: {fmtKmL(t.monthlyAvgKmL)} km/L
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Custo de Diesel por KM: R$ {fmtCpk(t.fuelCpk)}
                  </div>
                </div>

                {/* Badge de alerta quando < 2,0 km/L ou > 4,5 km/L em mês com > 1.000 km rodados */}
                {t.isAnomalous && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl bg-rose-100/90 text-rose-950 ring-1 ring-rose-300 px-3 py-2 text-[11px]"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold uppercase tracking-wide text-rose-800">
                        Alerta de Eficiência {t.anomalyPeriodLabel ? `(${t.anomalyPeriodLabel})` : ''}
                      </strong>
                      <span>
                        {t.anomalyMessage ??
                          'Consumo fora da faixa (2,0 a 4,5 km/L) com mais de 1.000 km rodados. Sugerida conferência de notas ou revisão do veículo.'}
                      </span>
                    </div>
                  </div>
                )}
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

      {/* Gráficos Mensais Consolidados: Evolução da Média Mensal (km/L) e Custo de Diesel por KM */}
      {metrics.monthlyFuelSeries.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Evolução Mensal Consolidada (Média Mensal km/L &amp; Custo de Diesel por KM)
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento mês a mês pelo método de Média Mensal Acumulada
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              {metrics.monthlyFuelSeries.length} mês(es) apurado(s)
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.monthlyFuelSeries}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  yAxisId="kml"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `${fmtKmL(Number(v))} km/L`}
                />
                <YAxis
                  yAxisId="cpk"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `R$ ${fmtCpk(Number(v))}`}
                />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (name === 'Média Mensal (km/L)') {
                      return [`Média Mensal: ${fmtKmL(Number(val))} km/L`, name];
                    }
                    return [`Custo de Diesel por KM: R$ ${fmtCpk(Number(val))}`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="kml"
                  dataKey="monthlyAvgKmL"
                  name="Média Mensal (km/L)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="cpk"
                  dataKey="fuelCpk"
                  name="Custo de Diesel por KM (R$)"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            {metrics.monthlyFuelSeries.map((m) => (
              <div
                key={m.periodKey}
                className={`p-3.5 rounded-xl ring-1 space-y-1 ${
                  m.isAnomalous
                    ? 'bg-amber-50/70 ring-amber-300'
                    : 'bg-slate-50 ring-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{m.periodLabel}</span>
                  <span className="text-[11px] text-slate-500">
                    {m.distanceTraveled.toLocaleString('pt-BR')} km • {m.totalLiters.toLocaleString('pt-BR')} L
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-700">
                  Média Mensal: {fmtKmL(m.monthlyAvgKmL)} km/L
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  Custo de Diesel por KM: R$ {fmtCpk(m.fuelCpk)}
                </div>
                {m.isAnomalous && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    Conferir notas / revisão do veículo
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RANKING DE RENTABILIDADE POR ROTA */}
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
                formatter={(val: any, _name: any, item: any) => [
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
