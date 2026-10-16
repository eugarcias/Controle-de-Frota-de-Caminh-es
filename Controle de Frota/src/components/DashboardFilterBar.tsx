'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, Filter, RefreshCw, Truck as TruckIcon, Users, ChevronDown, X } from 'lucide-react';
import { MultiSelect, ComboOption } from '@/components/ui/combobox';
import { inputCls } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  DashboardFilters,
  PeriodPreset,
  defaultDashboardFilters,
  hasActiveFilters,
  periodLabels,
} from '@/lib/dashboardFilters';

interface DashboardFilterBarProps {
  trucks: { id: string; plate: string; model?: string }[];
  drivers: { id: string; name: string }[];
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  /** Quantidade de registros no escopo atual (feedback visual do recálculo). */
  resultCount?: number;
}

const labelCls =
  'flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase mb-1';

export function DashboardFilterBar({
  trucks,
  drivers,
  value,
  onChange,
  resultCount,
}: DashboardFilterBarProps) {
  // No mobile os filtros ficam recolhidos para liberar a tela; no desktop sempre visíveis
  const [open, setOpen] = useState(false);

  const truckOptions: ComboOption[] = useMemo(
    () => trucks.map((t) => ({ value: t.id, label: t.plate, hint: t.model })),
    [trucks]
  );
  const driverOptions: ComboOption[] = useMemo(
    () => drivers.map((d) => ({ value: d.id, label: d.name })),
    [drivers]
  );

  const active = hasActiveFilters(value);
  const invalidRange =
    value.period === 'CUSTOM' && !!value.dateFrom && !!value.dateTo && value.dateFrom > value.dateTo;

  const set = (patch: Partial<DashboardFilters>) => onChange({ ...value, ...patch });

  const activeCount =
    (value.period !== 'ALL' ? 1 : 0) +
    (value.truckIds.length > 0 ? 1 : 0) +
    (value.driverIds.length > 0 ? 1 : 0);

  return (
    <section
      aria-label="Filtros globais do dashboard"
      className="sticky top-0 z-30 -mx-4 sm:mx-0 bg-white/95 backdrop-blur sm:rounded-2xl shadow-sm ring-1 ring-slate-200"
    >
      {/* Cabeçalho (toggle no mobile) */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="dashboard-filter-fields"
          className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider lg:cursor-default"
        >
          <Filter className="w-4 h-4 text-emerald-600" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-emerald-600 text-white rounded-full px-1.5 min-w-5 h-5 inline-flex items-center justify-center text-[11px]">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-slate-400 transition-transform lg:hidden', open && 'rotate-180')}
          />
        </button>

        <div className="flex items-center gap-3">
          {typeof resultCount === 'number' && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              {resultCount} registro(s) no escopo
            </span>
          )}
          {active && (
            <button
              type="button"
              onClick={() => onChange(defaultDashboardFilters)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 min-h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div
        id="dashboard-filter-fields"
        className={cn('px-4 pb-4 space-y-3', open ? 'block' : 'hidden lg:block')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="flt-period">
              <Calendar className="w-3 h-3 text-slate-400" />
              Período
            </label>
            <select
              id="flt-period"
              value={value.period}
              onChange={(e) => set({ period: e.target.value as PeriodPreset })}
              className={cn(inputCls, 'bg-slate-50 font-medium')}
            >
              {(Object.keys(periodLabels) as PeriodPreset[]).map((p) => (
                <option key={p} value={p}>
                  {periodLabels[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelCls}>
              <TruckIcon className="w-3 h-3 text-slate-400" />
              Veículos (placa)
            </span>
            <MultiSelect
              options={truckOptions}
              value={value.truckIds}
              onChange={(truckIds) => set({ truckIds })}
              allLabel="Todos os veículos"
              searchPlaceholder="Filtrar por placa..."
              aria-label="Filtro de veículos"
            />
          </div>

          <div>
            <span className={labelCls}>
              <Users className="w-3 h-3 text-slate-400" />
              Motoristas
            </span>
            <MultiSelect
              options={driverOptions}
              value={value.driverIds}
              onChange={(driverIds) => set({ driverIds })}
              allLabel="Todos os motoristas"
              searchPlaceholder="Filtrar por motorista..."
              aria-label="Filtro de motoristas"
            />
          </div>
        </div>

        {value.period === 'CUSTOM' && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <label className={labelCls} htmlFor="flt-from">
                De
              </label>
              <input
                id="flt-from"
                type="date"
                className={inputCls}
                value={value.dateFrom}
                max={value.dateTo || undefined}
                onChange={(e) => set({ dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="flt-to">
                Até
              </label>
              <input
                id="flt-to"
                type="date"
                className={inputCls}
                value={value.dateTo}
                min={value.dateFrom || undefined}
                onChange={(e) => set({ dateTo: e.target.value })}
              />
            </div>
            {invalidRange && (
              <p className="col-span-2 text-xs text-rose-600 flex items-center gap-1" role="alert">
                <X className="w-3.5 h-3.5" /> A data inicial é posterior à final.
              </p>
            )}
          </div>
        )}

        {active && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            KPIs e gráficos recalculados para os filtros selecionados.
          </p>
        )}
      </div>
    </section>
  );
}
