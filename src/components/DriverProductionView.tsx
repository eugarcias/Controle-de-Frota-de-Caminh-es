'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Package,
  DollarSign,
  TrendingUp,
  Route,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Percent,
  Receipt,
  CheckCircle2,
  Navigation,
  MessageSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Driver, FreightTrip, Truck, TravelExpenseRecord } from '@/types';
import { formatBRL, formatDate, Badge, EmptyState } from '@/components/ui';

interface DriverProductionViewProps {
  drivers: Driver[];
  trips: FreightTrip[];
  trucks: Truck[];
  travelExpenses?: TravelExpenseRecord[];
}

interface DriverCommissionRule {
  percent: number;
  fixedPerLoad: number;
}

const STORAGE_KEY = 'vsm.driver.commissions.v1';

export const DriverProductionView: React.FC<DriverProductionViewProps> = ({
  drivers,
  trips,
  trucks,
  travelExpenses = [],
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [calcBase, setCalcBase] = useState<'GROSS' | 'NET'>('GROSS');
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [rules, setRules] = useState<Record<string, DriverCommissionRule>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setRules(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const updateDriverRule = (driverId: string, patch: Partial<DriverCommissionRule>) => {
    setRules((prev) => {
      const current = prev[driverId] ?? { percent: 10, fixedPerLoad: 0 };
      const next = {
        ...prev,
        [driverId]: {
          percent: patch.percent !== undefined ? patch.percent : current.percent,
          fixedPerLoad:
            patch.fixedPerLoad !== undefined ? patch.fixedPerLoad : current.fixedPerLoad,
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Lista de meses disponíveis nos fretes
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      if (t.startDate && t.startDate.length >= 7) {
        set.add(t.startDate.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [trips]);

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${months[m - 1]} / ${y}`;
  };

  const getTruckPlate = (id: string) => trucks.find((t) => t.id === id)?.plate ?? 'Caminhão';

  // Filtragem de viagens válidas no período
  const validTrips = useMemo(() => {
    return trips.filter((t) => {
      if (t.status === 'CANCELADO') return false;
      if (onlyCompleted && (t.status ?? 'CONCLUIDO') !== 'CONCLUIDO') return false;
      if (selectedMonth !== 'ALL' && !t.startDate.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [trips, selectedMonth, onlyCompleted]);

  // Produção consolidada por motorista
  const driverStats = useMemo(() => {
    return drivers
      .map((driver) => {
        const rule = rules[driver.id] ?? { percent: 10, fixedPerLoad: 0 };
        const dTrips = validTrips
          .filter((t) => t.driverId === driver.id)
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

        const completedLoads = dTrips.filter(
          (t) => (t.status ?? 'CONCLUIDO') === 'CONCLUIDO'
        ).length;
        const activeLoads = dTrips.filter((t) => t.status === 'EM_VIAGEM').length;
        const plannedLoads = dTrips.filter((t) => t.status === 'PLANEJADO').length;
        const totalLoads = dTrips.length;

        const totalKm = dTrips.reduce((acc, t) => {
          const km =
            t.distanceKm ?? (t.finalKm && t.initialKm ? Math.max(0, t.finalKm - t.initialKm) : 0);
          return acc + km;
        }, 0);

        const grossRevenue = dTrips.reduce((acc, t) => acc + Number(t.grossFreightValue || 0), 0);
        const netRevenue = dTrips.reduce((acc, t) => acc + Number(t.netFreightValue || 0), 0);

        const baseAmount = calcBase === 'GROSS' ? grossRevenue : Math.max(0, netRevenue);
        const commissionFromPercent = (baseAmount * (rule.percent || 0)) / 100;
        const commissionFromFixed = totalLoads * (rule.fixedPerLoad || 0);
        const totalCommission = Number((commissionFromPercent + commissionFromFixed).toFixed(2));

        const dExpenses = travelExpenses.filter((e) => {
          if (e.driverId !== driver.id) return false;
          if (selectedMonth !== 'ALL' && !e.date.startsWith(selectedMonth)) return false;
          return true;
        });
        const totalDailyExpenses = dExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

        return {
          driver,
          rule,
          trips: dTrips,
          completedLoads,
          activeLoads,
          plannedLoads,
          totalLoads,
          totalKm,
          grossRevenue,
          netRevenue,
          totalCommission,
          totalDailyExpenses,
        };
      })
      .sort((a, b) => b.totalLoads - a.totalLoads || b.grossRevenue - a.grossRevenue);
  }, [drivers, validTrips, rules, calcBase, travelExpenses, selectedMonth]);

  const totals = useMemo(() => {
    return driverStats.reduce(
      (acc, s) => {
        acc.loads += s.totalLoads;
        acc.completed += s.completedLoads;
        acc.active += s.activeLoads;
        acc.km += s.totalKm;
        acc.gross += s.grossRevenue;
        acc.commission += s.totalCommission;
        acc.dailyExpenses += s.totalDailyExpenses;
        return acc;
      },
      { loads: 0, completed: 0, active: 0, km: 0, gross: 0, commission: 0, dailyExpenses: 0 }
    );
  }, [driverStats]);

  const chartData = useMemo(
    () =>
      driverStats.map((s) => ({
        name: s.driver.name.split(' ').slice(0, 2).join(' '),
        Cargas: s.totalLoads,
        Faturamento: Math.round(s.grossRevenue),
        Comissão: Math.round(s.totalCommission),
      })),
    [driverStats]
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Filtros */}
      <div className="bg-slate-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>Controle Administrativo de Produção</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Produção &amp; Comissões dos Motoristas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Acompanhe quantas cargas cada motorista realizou, o faturamento produzido e configure a
            comissão individual para fechamento de folha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de Mês */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-2">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <select
              aria-label="Filtrar por período"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none"
            >
              <option value="ALL" className="bg-slate-900 text-white">
                Todos os períodos
              </option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym} className="bg-slate-900 text-white">
                  {formatMonthLabel(ym)}
                </option>
              ))}
            </select>
          </div>

          {/* Base de cálculo da comissão */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setCalcBase('GROSS')}
              className={`px-3 py-1.5 rounded-xl transition ${
                calcBase === 'GROSS'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              % sobre Frete Bruto
            </button>
            <button
              type="button"
              onClick={() => setCalcBase('NET')}
              className={`px-3 py-1.5 rounded-xl transition ${
                calcBase === 'NET'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              % sobre Frete Líquido
            </button>
          </div>

          {/* Toggle Somente Concluídas */}
          <label className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyCompleted}
              onChange={(e) => setOnlyCompleted(e.target.checked)}
              className="rounded accent-emerald-500 w-4 h-4"
            />
            <span>Apenas cargas concluídas</span>
          </label>
        </div>
      </div>

      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Total de Cargas
            </span>
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3">{totals.loads}</div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {totals.completed} concluída(s) • {totals.active} em viagem
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Faturamento Produzido
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            {formatBRL(totals.gross)}
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {totals.km.toLocaleString('pt-BR')} km rodados em fretes
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
              Total de Comissões
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-500 text-slate-950">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-3">
            {formatBRL(totals.commission)}
          </div>
          <p className="text-xs text-emerald-800 font-semibold mt-1">
            Base: {calcBase === 'GROSS' ? 'Frete Bruto' : 'Frete Líquido'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
              Diárias Lançadas
            </span>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-700">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            {formatBRL(totals.dailyExpenses)}
          </div>
          <p className="text-xs text-slate-600 font-semibold mt-1">
            Despesas registradas pelos motoristas
          </p>
        </div>
      </div>

      {/* Gráfico Comparativo de Produção */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Ranking de Produção e Comissão por Motorista
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo entre o faturamento transportado e a comissão acumulada
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }} />
                <YAxis
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'Cargas' ? `${value} carga(s)` : formatBRL(Number(value))
                  }
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #334155',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                <Bar dataKey="Faturamento" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Comissão" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista Individual de Motoristas com Controle de Comissão e Cargas */}
      {driverStats.length === 0 ? (
        <EmptyState text="Nenhum motorista cadastrado." />
      ) : (
        <div className="space-y-4">
          {driverStats.map((item) => {
            const isExpanded = expandedDriverId === item.driver.id;
            return (
              <div
                key={item.driver.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Identificação do Motorista */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-extrabold text-lg shrink-0">
                        {item.driver.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-slate-900">
                            {item.driver.name}
                          </h3>
                          <Badge tone={item.activeLoads > 0 ? 'green' : 'slate'}>
                            {item.activeLoads > 0 ? 'Em Viagem' : item.driver.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                          {item.driver.phone && <span>Tel: {item.driver.phone}</span>}
                          <span>•</span>
                          <span className="font-bold text-slate-700">
                            {item.totalLoads} carga(s) no período ({item.completedLoads} concluída
                            {item.completedLoads === 1 ? '' : 's'})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Configuração Rápida de Comissão + Valor a Receber */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <div className="w-28">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                          Comissão (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={item.rule.percent}
                            onChange={(e) =>
                              updateDriverRule(item.driver.id, {
                                percent: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-3 py-1.5 pr-7 rounded-xl border border-slate-300 bg-white text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                          <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div className="w-32">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                          Fixo / Carga (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={item.rule.fixedPerLoad || ''}
                          placeholder="0,00"
                          onChange={(e) =>
                            updateDriverRule(item.driver.id, {
                              fixedPerLoad: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="pl-2 sm:border-l border-slate-200 min-w-[140px]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                          Comissão a Receber
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 block">
                          {formatBRL(item.totalCommission)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Métricas do Motorista */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Cargas Realizadas</span>
                      <strong className="text-sm font-extrabold text-slate-900 flex items-center gap-1 mt-0.5">
                        <Package className="w-4 h-4 text-sky-600" />
                        {item.totalLoads} carga(s)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Distância Total</span>
                      <strong className="text-sm font-extrabold text-slate-900 flex items-center gap-1 mt-0.5">
                        <Route className="w-4 h-4 text-sky-600" />
                        {item.totalKm.toLocaleString('pt-BR')} km
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Frete Bruto Produzido</span>
                      <strong className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                        {formatBRL(item.grossRevenue)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Frete Líquido</span>
                      <strong className="text-sm font-extrabold text-slate-800 mt-0.5 block">
                        {formatBRL(item.netRevenue)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Diárias / Despesas</span>
                      <strong className="text-sm font-extrabold text-amber-700 mt-0.5 block">
                        {formatBRL(item.totalDailyExpenses)}
                      </strong>
                    </div>
                  </div>

                  {/* Botão de expandir extrato de cargas */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      Cálculo: {item.rule.percent}% sobre{' '}
                      {calcBase === 'GROSS' ? 'Frete Bruto' : 'Frete Líquido'}
                      {item.rule.fixedPerLoad > 0
                        ? ` + ${formatBRL(item.rule.fixedPerLoad)} por carga`
                        : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDriverId(isExpanded ? null : item.driver.id)
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-3.5 py-2 rounded-xl transition"
                    >
                      <span>
                        {isExpanded
                          ? 'Ocultar cargas do motorista'
                          : `Ver as ${item.totalLoads} carga(s) e comissões`}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Lista expansível de todas as cargas do motorista */}
                {isExpanded && (
                  <div className="bg-slate-950 text-white p-5 sm:p-6 border-t border-slate-800 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      Extrato de Cargas de {item.driver.name} ({item.trips.length})
                    </h4>

                    {item.trips.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">
                        Nenhuma carga registrada para este motorista no período selecionado.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {item.trips.map((trip) => {
                          const baseVal =
                            calcBase === 'GROSS'
                              ? Number(trip.grossFreightValue || 0)
                              : Math.max(0, Number(trip.netFreightValue || 0));
                          const tripCommission =
                            (baseVal * (item.rule.percent || 0)) / 100 +
                            (item.rule.fixedPerLoad || 0);

                          return (
                            <div
                              key={trip.id}
                              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="bg-slate-800 text-sky-300 font-bold px-2 py-0.5 rounded-md">
                                    {getTruckPlate(trip.truckId)}
                                  </span>
                                  <span className="text-slate-400">
                                    {formatDate(trip.startDate)}
                                  </span>
                                  <span className="text-slate-300 font-semibold">
                                    • {trip.customerName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                                      trip.status === 'EM_VIAGEM'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : trip.status === 'PLANEJADO'
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {trip.status === 'EM_VIAGEM'
                                      ? 'Em Viagem'
                                      : trip.status === 'PLANEJADO'
                                        ? 'Planejado'
                                        : 'Concluída'}
                                  </span>
                                </div>

                                <div className="text-sm font-bold text-white flex flex-wrap items-center gap-1.5">
                                  <span>{trip.origin}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{trip.destination}</span>
                                </div>

                                {trip.cargoDescription && (
                                  <p className="text-xs text-slate-400">
                                    Carga: <strong className="text-slate-200">{trip.cargoDescription}</strong>
                                    {trip.cargoWeightKg
                                      ? ` (${trip.cargoWeightKg.toLocaleString('pt-BR')} kg)`
                                      : ''}
                                  </p>
                                )}

                                {trip.notes && (
                                  <p className="text-xs text-amber-300 flex items-center gap-1.5 pt-0.5">
                                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                    <span>Obs: {trip.notes}</span>
                                  </p>
                                )}
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                                <div className="text-xs text-slate-400">
                                  Frete: <strong className="text-white">{formatBRL(trip.grossFreightValue)}</strong>
                                </div>
                                <div className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-xl text-right">
                                  <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">
                                    Comissão da Carga
                                  </span>
                                  <strong className="text-sm font-extrabold text-emerald-400">
                                    {formatBRL(tripCommission)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
