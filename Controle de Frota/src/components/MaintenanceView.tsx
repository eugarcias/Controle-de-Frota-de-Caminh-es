'use client';

import React, { useState } from 'react';
import { Wrench, Calendar, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { MaintenanceLog, Truck } from '@/types';
import { formatCategory } from '@/lib/calc';

interface MaintenanceViewProps {
  maintenances: MaintenanceLog[];
  trucks: Truck[];
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenances,
  trucks,
}) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('ALL');

  const filteredLogs = selectedTruck === 'ALL'
    ? maintenances
    : maintenances.filter((m) => m.truckId === selectedTruck);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getTruck = (id: string) => trucks.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-sky-600" />
            Controle de Oficina e Manutenção Preventiva
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico de paradas, custos com peças/mão de obra e alertas de próxima troca de óleo.
          </p>
        </div>

        {/* Filtro por Caminhão */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Filtrar:</span>
          <select
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            className="text-xs font-semibold p-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="ALL">Todos os Caminhões (3)</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards de Status de Revisão por Caminhão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trucks.map((t) => {
          const truckMaints = maintenances.filter((m) => m.truckId === t.id);
          const lastOil = truckMaints.find((m) => m.category === 'OLEO_FILTROS');
          const kmRemaining = lastOil?.nextServiceOdometerAlert
            ? lastOil.nextServiceOdometerAlert - t.currentOdometer
            : null;

          return (
            <div
              key={t.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">{t.plate}</span>
                  <span className="text-xs text-slate-500">{t.model}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    t.status === 'ATIVO'
                      ? 'bg-emerald-100 text-emerald-800'
                      : t.status === 'MANUTENCAO'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {t.status}
                </span>
              </div>

              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hodômetro Atual:</span>
                  <span className="font-bold text-slate-800">{t.currentOdometer.toLocaleString()} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Próxima Troca Óleo:</span>
                  <span className="font-bold text-slate-800">
                    {lastOil?.nextServiceOdometerAlert
                      ? `${lastOil.nextServiceOdometerAlert.toLocaleString()} km`
                      : 'Não programada'}
                  </span>
                </div>
              </div>

              {/* Status de Alerta de Troca de Óleo */}
              {kmRemaining !== null && (
                <div>
                  {kmRemaining <= 0 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>REVISÃO ATRASADA EM {Math.abs(kmRemaining).toLocaleString()} KM!</span>
                    </div>
                  ) : kmRemaining <= 1000 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>ATENÇÃO: Faltam apenas {kmRemaining.toLocaleString()} km para a troca.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Em dia (faltam {kmRemaining.toLocaleString()} km)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Histórico Detalhado de Manutenções */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">Histórico de Ordens de Serviço (OS)</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredLogs.map((log) => {
            const truck = getTruck(log.truckId);
            return (
              <div key={log.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded">
                      {truck?.plate}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        log.type === 'PREVENTIVA'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {formatCategory(log.category)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Custo Total da OS</span>
                    <span className="text-base font-bold text-slate-900">
                      {formatBRL(log.totalCost)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {log.description}
                </p>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div>
                    Oficina/Fornecedor: <strong className="text-slate-700">{log.supplierName}</strong>
                  </div>
                  <div>
                    Hodômetro na entrada:{' '}
                    <strong className="text-slate-700">{log.odometerAtService.toLocaleString()} km</strong>
                  </div>
                  <div>
                    Peças: <strong className="text-slate-700">{formatBRL(log.partsCost)}</strong> • Mão de Obra:{' '}
                    <strong className="text-slate-700">{formatBRL(log.laborCost)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
