'use client';

import React from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Fuel,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck as TruckIcon,
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
import { DashboardMetrics } from '@/types';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  onOpenQuickEntry: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  onOpenQuickEntry,
}) => {
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      {/* Top Banner de Resumo e Ação Rápida */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Executivo da Frota</h1>
          <p className="text-sm text-slate-300 mt-1">
            Monitoramento de 3 cavalos mecânicos pesados • Métricas de CPK, Tanque Cheio e Revisões
          </p>
        </div>
        <button
          onClick={onOpenQuickEntry}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-sky-500/25 transition-all active:scale-95"
        >
          <Fuel className="w-5 h-5" />
          <span>+ Lançar Abastecimento / KM</span>
        </button>
      </div>

      {/* Cards Superiores (KPIs do Mês) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Bruto */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Faturamento Fretes
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatBRL(metrics.totalRevenue)}
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span>Receita bruta dos fretes lançados</span>
            </div>
          </div>
        </div>

        {/* Gasto Total Operacional */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gasto Operacional Total
            </span>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatBRL(metrics.totalExpenses)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Combustível + Manutenção + Rotas
            </div>
          </div>
        </div>

        {/* Lucro Líquido e Margem */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lucro Líquido Real
            </span>
            <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-sky-700">
              {formatBRL(metrics.netProfit)}
            </div>
            <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                {metrics.profitMarginPercent}%
              </span>
              <span>Margem Operacional</span>
            </div>
          </div>
        </div>

        {/* Média da Frota & CPK */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Média km/L & CPK Médio
            </span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {metrics.fleetAverageKmL} <span className="text-sm font-normal text-slate-500">km/L</span>
              </span>
            </div>
            <div className="text-xs text-slate-700 font-medium mt-1">
              CPK Médio: <span className="font-bold text-slate-900">R$ {metrics.fleetCpk}</span> / km
            </div>
          </div>
        </div>
      </div>

      {/* Alertas Ativos da Frota */}
      {metrics.activeAlerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm">
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
                className={`flex items-start gap-3 p-3.5 rounded-xl border ${
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
                    Hodômetro Atual: {alert.currentOdometer.toLocaleString('pt-BR')} km • Limite Alerta:{' '}
                    {alert.nextServiceOdometer.toLocaleString('pt-BR')} km
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Gráficos Analíticos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Desempenho Individual por Caminhão */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Desempenho por Caminhão (KM vs Gasto Total)
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativo direto de quilometragem percorrida e custos gerados
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                3 Cavalos VSM
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
                  <Bar yAxisId="left" dataKey="kmTraveled" name="KM Rodados" fill="#2fc43a" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="totalExpenses" name="Gasto Total (R$)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mini Tabela Resumo Embaixo do Gráfico */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
            {metrics.truckMetrics.map((t) => (
              <div key={t.truckId} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-900 block">{t.plate}</span>
                <span className="text-[11px] text-slate-500 block">{t.model}</span>
                <div className="mt-1 flex items-center justify-center gap-2 text-xs">
                  <span className={`font-semibold ${t.averageKmL < 1.8 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {t.averageKmL} km/L
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-slate-700">R$ {t.cpk}/km</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Composição de Custos Operacionais */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
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
                  ></span>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatBRL(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico 3: Evolução do Preço do Litro do Diesel nos Postos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Evolução do Preço do Diesel S10 (R$/Litro)
            </h3>
            <p className="text-xs text-slate-500">
              Variação histórica abastecida pelos motoristas da VSM nos postos de rodovia
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            Último valor registrado: {formatBRL(metrics.dieselPriceTrend.at(-1)?.price ?? 0)}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.dieselPriceTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                domain={[5.7, 6.2]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v) => `R$ ${v.toFixed(2)}`}
              />
              <Tooltip
                formatter={(val: any, name: any, item: any) => [
                  `R$ ${Number(val).toFixed(2)} / L (${item.payload.station})`,
                  'Diesel S10',
                ]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#1f9e2e"
                strokeWidth={3}
                dot={{ r: 4, fill: '#2fc43a' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
