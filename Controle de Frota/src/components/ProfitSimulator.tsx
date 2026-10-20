'use client';

import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, XCircle, Fuel, Info } from 'lucide-react';
import { Truck, FuelLog } from '@/types';
import { Field, inputCls, formatBRL } from '@/components/ui';
import { Combobox } from '@/components/ui/combobox';
import { calculateTruckEfficiency, projectTripProfit } from '@/lib/calc';

/** Margem de contribuição mínima para recomendar a carga (ajuste conforme a política da empresa). */
const MARGIN_ACCEPT = 15; // % ou mais  → aceitar
const MARGIN_WARN = 5; //  % a 15%    → negociar

interface Props {
  trucks: Truck[];
  fuelLogs: FuelLog[];
  /** Fallbacks quando o caminhão ainda não tem histórico suficiente */
  fleetKmL: number;
  fleetDieselPrice: number;
}

export const ProfitSimulator: React.FC<Props> = ({ trucks, fuelLogs, fleetKmL, fleetDieselPrice }) => {
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? '');
  const [distanceKm, setDistanceKm] = useState('');
  const [grossFreight, setGrossFreight] = useState('');
  const [tolls, setTolls] = useState('');
  const [otherCosts, setOtherCosts] = useState('');

  // 1) Busca no histórico REAL do caminhão selecionado (km/L ponderado + último preço pago)
  const efficiency = useMemo(() => {
    const logs = fuelLogs.filter((l) => l.truckId === truckId);
    const eff = calculateTruckEfficiency(logs);
    const lastLog = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const hasOwnHistory = eff.kmPerLiter !== null && eff.intervals >= 2;
    return {
      kmPerLiter: hasOwnHistory ? (eff.kmPerLiter as number) : fleetKmL,
      source: hasOwnHistory ? ('truck' as const) : ('fleet' as const),
      intervals: eff.intervals,
      sampleKm: eff.sampleKm,
      dieselPrice: lastLog?.pricePerLiter ?? fleetDieselPrice,
    };
  }, [fuelLogs, truckId, fleetKmL, fleetDieselPrice]);

  // 2) Projeção financeira
  const km = Number(distanceKm) || 0;
  const freight = Number(grossFreight) || 0;
  const ready = km > 0 && freight > 0 && !!truckId;

  const result = useMemo(
    () =>
      projectTripProfit({
        distanceKm: km,
        grossFreight: freight,
        kmPerLiter: efficiency.kmPerLiter,
        dieselPrice: efficiency.dieselPrice,
        tolls: Number(tolls) || 0,
        otherCosts: Number(otherCosts) || 0,
      }),
    [km, freight, efficiency, tolls, otherCosts]
  );

  const verdict =
    result.marginPercent >= MARGIN_ACCEPT
      ? { label: 'ACEITAR', tone: 'emerald', Icon: CheckCircle2, text: 'Margem saudável para a operação.' }
      : result.marginPercent >= MARGIN_WARN
        ? { label: 'NEGOCIAR', tone: 'amber', Icon: AlertTriangle, text: `Margem apertada. Peça pelo menos ${formatBRL(result.totalCost / (1 - MARGIN_ACCEPT / 100))} para atingir ${MARGIN_ACCEPT}%.` }
        : { label: 'RECUSAR', tone: 'rose', Icon: XCircle, text: `Margem insuficiente. O frete mínimo para não ter prejuízo é ${formatBRL(result.breakEvenFreight)}.` };

  const toneCls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 space-y-4" aria-label="Simulador de rentabilidade">
      <header className="flex items-start gap-3">
        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
          <Calculator className="w-5 h-5" />
        </span>
        <div>
          <h3 className="text-base font-bold text-slate-900">Simulador de Rentabilidade</h3>
          <p className="text-xs text-slate-500">
            Projeta o lucro com o consumo real do caminhão escolhido, antes de aceitar a carga.
          </p>
        </div>
      </header>

      {/* Entradas: coluna única no celular, 4 colunas no desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Veículo">
          <Combobox
            options={trucks.map((t) => ({ value: t.id, label: t.plate, hint: t.model }))}
            value={truckId}
            onChange={setTruckId}
            placeholder="Selecione o caminhão"
            searchPlaceholder="Buscar por placa..."
          />
        </Field>
        <Field label="Distância aprox. (km)">
          <input type="number" inputMode="decimal" min="1" className={inputCls} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="Ex: 600" />
        </Field>
        <Field label="Frete oferecido (R$)">
          <input type="number" inputMode="decimal" min="0" step="0.01" className={inputCls} value={grossFreight} onChange={(e) => setGrossFreight(e.target.value)} placeholder="0,00" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pedágios">
            <input type="number" inputMode="decimal" min="0" step="0.01" className={inputCls} value={tolls} onChange={(e) => setTolls(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Outros">
            <input type="number" inputMode="decimal" min="0" step="0.01" className={inputCls} value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} placeholder="0,00" />
          </Field>
        </div>
      </div>

      {/* Base de cálculo: de onde veio o km/L */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
          <Fuel className="w-3.5 h-3.5 text-emerald-600" />
          {efficiency.kmPerLiter.toFixed(2)} km/L
        </span>
        <span>
          {efficiency.source === 'truck'
            ? `média real deste caminhão (${efficiency.intervals} tanques cheios, ${efficiency.sampleKm.toLocaleString('pt-BR')} km)`
            : 'média da frota (este caminhão ainda não tem histórico suficiente)'}
        </span>
        <span>Diesel: {formatBRL(efficiency.dieselPrice)}/L (último abastecimento)</span>
      </div>

      {/* Resultado */}
      {ready ? (
        <div className="space-y-3">
          <div className={`flex items-start gap-3 rounded-xl p-3.5 ring-1 ${toneCls[verdict.tone]}`}>
            <verdict.Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="block">{verdict.label}</strong>
              <span className="text-xs">{verdict.text}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Diesel estimado" value={formatBRL(result.dieselCost)} sub={`${result.liters.toFixed(0)} L necessários`} negative />
            <Metric label="Custos totais" value={formatBRL(result.totalCost)} sub={`${formatBRL(result.costPerKm)}/km`} negative />
            <Metric
              label="Lucro líquido projetado"
              value={formatBRL(result.netProfit)}
              sub={`Frete: ${formatBRL(result.freightPerKm)}/km`}
              positive={result.netProfit >= 0}
              negative={result.netProfit < 0}
              highlight
            />
            <Metric
              label="Margem"
              value={`${result.marginPercent.toFixed(1)}%`}
              sub={`Mínimo recomendado: ${MARGIN_ACCEPT}%`}
              positive={result.marginPercent >= MARGIN_ACCEPT}
              negative={result.marginPercent < MARGIN_WARN}
            />
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4" />
          Informe veículo, distância e valor do frete para ver a projeção.
        </p>
      )}
    </section>
  );
};

function Metric({
  label,
  value,
  sub,
  positive,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  const color = positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className={`rounded-xl p-3.5 ${highlight ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <span className={`block text-[11px] font-semibold uppercase tracking-wide ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <strong className={`block text-lg sm:text-xl font-bold mt-0.5 ${highlight ? (positive ? 'text-emerald-400' : 'text-rose-400') : color}`}>{value}</strong>
      {sub && <span className={`block text-[11px] mt-0.5 ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</span>}
    </div>
  );
}
