'use client';

import React, { useState } from 'react';
import {
  Wrench,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  MaintenanceLog,
  MaintenanceCategory,
  MaintenanceType,
  Truck,
} from '@/types';
import { formatCategory } from '@/lib/calc';
import {
  Field,
  Modal,
  EmptyState,
  inputCls,
  primaryBtn,
  secondaryBtn,
  formatBRL,
  formatDate,
  newId,
} from '@/components/ui';

interface MaintenanceViewProps {
  maintenances: MaintenanceLog[];
  trucks: Truck[];
  onAdd?: (m: MaintenanceLog) => Promise<MaintenanceLog | null>;
  onUpdate?: (id: string, patch: Partial<MaintenanceLog>) => Promise<MaintenanceLog | null>;
  onRemove?: (id: string) => Promise<boolean>;
}

const CATEGORIES: { value: MaintenanceCategory; label: string }[] = [
  { value: 'OLEO_FILTROS', label: 'Troca de Óleo e Filtros' },
  { value: 'FREIOS', label: 'Sistema de Freios' },
  { value: 'SUSPENSAO', label: 'Suspensão / Molas' },
  { value: 'MOTOR', label: 'Motor' },
  { value: 'CAIXA', label: 'Caixa / Câmbio / Diferencial' },
  { value: 'ARLA_ELETRICA', label: 'Elétrica / Arla 32' },
  { value: 'OUTROS', label: 'Outros Serviços' },
];

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenances,
  trucks,
  onAdd,
  onUpdate,
  onRemove,
}) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceLog | null>(null);

  const filteredLogs = (
    selectedTruck === 'ALL'
      ? maintenances
      : maintenances.filter((m) => m.truckId === selectedTruck)
  )
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getTruck = (id: string) => trucks.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111926] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-500" />
            Controle de Oficina e Manutenção
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Histórico de revisões, trocas de óleo, custos de oficina e alertas por KM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            aria-label="Filtrar caminhão"
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            className="text-xs font-semibold p-2.5 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="ALL">Todos os Caminhões ({trucks.length})</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} — {t.model}
              </option>
            ))}
          </select>

          {onAdd && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className={primaryBtn}
            >
              <Plus className="w-4 h-4" />
              Nova Manutenção
            </button>
          )}
        </div>
      </div>

      {/* Cards de Status de Revisão por Caminhão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trucks.map((t) => {
          const truckMaints = maintenances
            .filter((m) => m.truckId === t.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastOil = truckMaints.find((m) => m.category === 'OLEO_FILTROS');
          const kmRemaining = lastOil?.nextServiceOdometerAlert
            ? lastOil.nextServiceOdometerAlert - t.currentOdometer
            : null;

          return (
            <div
              key={t.id}
              className="bg-white dark:bg-[#111926] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white block">{t.plate}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t.brand} {t.model}
                  </span>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    t.status === 'ATIVO'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      : t.status === 'MANUTENCAO'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                  }`}
                >
                  {t.status === 'ATIVO'
                    ? 'Ativo'
                    : t.status === 'MANUTENCAO'
                    ? 'Em Manutenção'
                    : 'Parado'}
                </span>
              </div>

              <div className="text-xs bg-slate-50 dark:bg-[#0b111a] p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Hodômetro Atual:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {t.currentOdometer.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Próxima Troca de Óleo:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {lastOil?.nextServiceOdometerAlert
                      ? `${lastOil.nextServiceOdometerAlert.toLocaleString('pt-BR')} km`
                      : 'Não programada'}
                  </span>
                </div>
              </div>

              {kmRemaining !== null && (
                <div>
                  {kmRemaining <= 0 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>REVISÃO ATRASADA EM {Math.abs(kmRemaining).toLocaleString('pt-BR')} KM!</span>
                    </div>
                  ) : kmRemaining <= 1000 ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>ATENÇÃO: Faltam {kmRemaining.toLocaleString('pt-BR')} km para a troca.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Em dia (faltam {kmRemaining.toLocaleString('pt-BR')} km)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Histórico Detalhado de Manutenções */}
      <div className="bg-white dark:bg-[#111926] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0b111a] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Histórico de Manutenções e Serviços ({filteredLogs.length})
          </h3>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-6">
            <EmptyState text="Nenhuma manutenção registrada até o momento." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.map((log) => {
              const truck = getTruck(log.truckId);
              return (
                <div key={log.id} className="p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-slate-900 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                        {truck?.plate ?? 'Caminhão'}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                          log.type === 'PREVENTIVA'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {log.type === 'PREVENTIVA' ? 'Preventiva' : 'Corretiva'}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {formatCategory(log.category)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">• {formatDate(log.date)}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Custo Total</span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">
                          {formatBRL(log.totalCost)}
                        </span>
                      </div>
                      {(onUpdate || onRemove) && (
                        <div className="flex items-center gap-1">
                          {onUpdate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(log);
                                setModalOpen(true);
                              }}
                              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              title="Editar manutenção"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {onRemove && (
                            <button
                              type="button"
                              onClick={() =>
                                confirm('Excluir este registro de manutenção?') &&
                                onRemove(log.id)
                              }
                              className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                              title="Excluir manutenção"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0b111a] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {log.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 gap-2">
                    <div>
                      Oficina / Fornecedor:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">{log.supplierName}</strong>
                    </div>
                    <div>
                      KM na revisão:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {log.odometerAtService.toLocaleString('pt-BR')} km
                      </strong>
                      {log.nextServiceOdometerAlert ? (
                        <span>
                          {' '}
                          • Próxima troca:{' '}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {log.nextServiceOdometerAlert.toLocaleString('pt-BR')} km
                          </strong>
                        </span>
                      ) : null}
                    </div>
                    <div>
                      Peças: <strong className="text-slate-700 dark:text-slate-200">{formatBRL(log.partsCost)}</strong> • Mão
                      de Obra: <strong className="text-slate-700 dark:text-slate-200">{formatBRL(log.laborCost)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <MaintenanceModal
          trucks={trucks}
          initial={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={async (m) => {
            if (editing && onUpdate) {
              const saved = await onUpdate(editing.id, m);
              if (saved) {
                setModalOpen(false);
                setEditing(null);
              }
            } else if (onAdd) {
              const saved = await onAdd(m);
              if (saved) {
                setModalOpen(false);
              }
            }
          }}
        />
      )}
    </div>
  );
};

function MaintenanceModal({
  trucks,
  initial,
  onSave,
  onClose,
}: {
  trucks: Truck[];
  initial: MaintenanceLog | null;
  onSave: (m: MaintenanceLog) => Promise<void>;
  onClose: () => void;
}) {
  const [truckId, setTruckId] = useState(initial?.truckId ?? trucks[0]?.id ?? '');
  const selectedTruck = trucks.find((t) => t.id === truckId) ?? trucks[0];
  const [type, setType] = useState<MaintenanceType>(initial?.type ?? 'PREVENTIVA');
  const [category, setCategory] = useState<MaintenanceCategory>(
    initial?.category ?? 'OLEO_FILTROS'
  );
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [odometerAtService, setOdometerAtService] = useState(
    String(initial?.odometerAtService ?? selectedTruck?.currentOdometer ?? 0)
  );
  const [nextServiceOdometerAlert, setNextServiceOdometerAlert] = useState(
    initial?.nextServiceOdometerAlert ? String(initial.nextServiceOdometerAlert) : ''
  );
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [partsCost, setPartsCost] = useState(String(initial?.partsCost ?? ''));
  const [laborCost, setLaborCost] = useState(String(initial?.laborCost ?? ''));
  const [saving, setSaving] = useState(false);

  const pCost = Number(partsCost) || 0;
  const lCost = Number(laborCost) || 0;
  const totalCost = pCost + lCost;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? newId(),
        truckId,
        date: `${date}T12:00:00.000Z`,
        odometerAtService: Number(odometerAtService) || 0,
        type,
        category,
        description: description.trim() || formatCategory(category),
        partsCost: pCost,
        laborCost: lCost,
        totalCost: totalCost > 0 ? totalCost : 0.01,
        supplierName: supplierName.trim() || 'Oficina',
        nextServiceOdometerAlert: nextServiceOdometerAlert
          ? Number(nextServiceOdometerAlert)
          : null,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Editar Manutenção' : 'Registrar Manutenção / Revisão'}
      subtitle="Lance revisões, trocas de óleo ou consertos realizados na frota."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Field label="Caminhão *">
            <select
              className={inputCls}
              value={truckId}
              onChange={(e) => {
                setTruckId(e.target.value);
                const trk = trucks.find((x) => x.id === e.target.value);
                if (trk && !initial) setOdometerAtService(String(trk.currentOdometer));
              }}
            >
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} — {t.model}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de Manutenção">
            <select
              className={inputCls}
              value={type}
              onChange={(e) => setType(e.target.value as MaintenanceType)}
            >
              <option value="PREVENTIVA">Preventiva (Revisão / Troca programada)</option>
              <option value="CORRETIVA">Corretiva (Conserto / Reparo)</option>
            </select>
          </Field>

          <Field label="Categoria">
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Data do Serviço *">
            <input
              required
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Hodômetro na Revisão (KM) *">
            <input
              required
              type="number"
              min="0"
              className={inputCls}
              value={odometerAtService}
              onChange={(e) => setOdometerAtService(e.target.value)}
            />
          </Field>

          <Field label="Próxima Troca em qual KM? (Opcional)">
            <input
              type="number"
              min="0"
              className={inputCls}
              value={nextServiceOdometerAlert}
              onChange={(e) => setNextServiceOdometerAlert(e.target.value)}
              placeholder={
                Number(odometerAtService) > 0
                  ? `Ex: ${Number(odometerAtService) + 20000}`
                  : 'Ex: 250000'
              }
            />
          </Field>

          <Field label="Oficina / Mecânico *" className="sm:col-span-3">
            <input
              required
              className={inputCls}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ex: Oficina Mecânica Diesel Sul"
            />
          </Field>

          <Field label="O que foi feito? (Descrição) *" className="sm:col-span-3">
            <input
              required
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Troca de óleo do motor, filtro de ar e filtro separador"
            />
          </Field>

          <Field label="Valor das Peças (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={partsCost}
              onChange={(e) => setPartsCost(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <Field label="Mão de Obra (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-col justify-center">
            <span className="text-[11px] text-slate-400">Custo Total do Serviço</span>
            <strong className="text-lg text-emerald-400">{formatBRL(totalCost)}</strong>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar Manutenção'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
