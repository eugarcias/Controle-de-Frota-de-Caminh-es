'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Plus, ArrowRight, Package, Route, Play, Trash2, AlertTriangle } from 'lucide-react';
import { CargoSchedule, Customer, Driver, ScheduleStatus, Truck } from '@/types';
import {
  Field,
  Modal,
  EmptyState,
  Badge,
  inputCls,
  primaryBtn,
  secondaryBtn,
  formatBRL,
  newId,
} from '@/components/ui';

interface Props {
  schedules: CargoSchedule[];
  customers: Customer[];
  trucks: Truck[];
  drivers: Driver[];
  onAdd: (s: CargoSchedule) => void;
  onUpdate: (id: string, patch: Partial<CargoSchedule>) => void;
  onRemove: (id: string) => void;
  /** Converte o agendamento em um frete (viagem) efetivo */
  onConvert: (s: CargoSchedule) => void;
}

const statusLabel: Record<ScheduleStatus, string> = {
  AGENDADA: 'Agendada',
  EM_TRANSITO: 'Em trânsito',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};
const statusTone: Record<ScheduleStatus, 'amber' | 'green' | 'slate' | 'red'> = {
  AGENDADA: 'amber',
  EM_TRANSITO: 'green',
  CONCLUIDA: 'slate',
  CANCELADA: 'red',
};

const emptyForm = {
  customerId: '',
  truckId: '',
  driverId: '',
  origin: '',
  destination: '',
  distanceKm: '',
  cargoDescription: '',
  cargoWeightKg: '',
  pickupDate: '',
  pickupTime: '07:00',
  deliveryDate: '',
  freightValue: '',
  notes: '',
};

export const CargoScheduleView: React.FC<Props> = ({
  schedules,
  customers,
  trucks,
  drivers,
  onAdd,
  onUpdate,
  onRemove,
  onConvert,
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<'ATIVAS' | 'TODAS'>('ATIVAS');

  const set = (k: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const list = useMemo(
    () =>
      schedules
        .filter((s) => filter === 'TODAS' || s.status === 'AGENDADA' || s.status === 'EM_TRANSITO')
        .slice()
        .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()),
    [schedules, filter]
  );

  // Alerta de conflito: mesmo caminhão já agendado no mesmo dia
  const conflict = useMemo(() => {
    if (!form.truckId || !form.pickupDate) return null;
    return (
      schedules.find(
        (s) =>
          s.truckId === form.truckId &&
          (s.status === 'AGENDADA' || s.status === 'EM_TRANSITO') &&
          s.pickupDate.slice(0, 10) === form.pickupDate
      ) ?? null
    );
  }, [schedules, form.truckId, form.pickupDate]);

  const name = {
    customer: (id: string) => customers.find((c) => c.id === id)?.name ?? 'Cliente',
    truck: (id?: string | null) => trucks.find((t) => t.id === id)?.plate ?? 'A definir',
    driver: (id?: string | null) => drivers.find((d) => d.id === id)?.name ?? 'A definir',
  };

  const openModal = () => {
    setForm({
      ...emptyForm,
      customerId: customers[0]?.id ?? '',
      pickupDate: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s: CargoSchedule = {
      id: newId(),
      customerId: form.customerId,
      truckId: form.truckId || null,
      driverId: form.driverId || null,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      distanceKm: Number(form.distanceKm),
      cargoDescription: form.cargoDescription.trim(),
      cargoWeightKg: Number(form.cargoWeightKg) || 0,
      pickupDate: `${form.pickupDate}T${form.pickupTime || '07:00'}:00.000Z`,
      deliveryDate: form.deliveryDate ? `${form.deliveryDate}T12:00:00.000Z` : null,
      freightValue: Number(form.freightValue),
      status: 'AGENDADA',
      notes: form.notes.trim(),
    };
    onAdd(s);
    setOpen(false);
  };

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-sky-600" />
            Agenda de Cargas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Programe coletas futuras e converta em frete quando o caminhão sair.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="Filtro da agenda"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ATIVAS' | 'TODAS')}
            className="text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="ATIVAS">Somente ativas</option>
            <option value="TODAS">Todas</option>
          </select>
          <button type="button" onClick={openModal} className={primaryBtn}>
            <Plus className="w-5 h-5" />
            Agendar Carga
          </button>
        </div>
      </div>

      {list.length === 0 && <EmptyState text="Nenhuma carga agendada." />}

      <div className="grid grid-cols-1 gap-4">
        {list.map((s) => (
          <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="dark">{fmtDateTime(s.pickupDate)}</Badge>
                  <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                  <span className="text-xs font-semibold text-sky-800">{name.customer(s.customerId)}</span>
                </div>
                <div className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  {s.origin} <ArrowRight className="w-4 h-4 text-slate-400" /> {s.destination}
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-sky-600" />
                    {s.cargoDescription} • {s.cargoWeightKg.toLocaleString('pt-BR')} kg
                  </span>
                  <span className="flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-sky-600" />
                    {s.distanceKm.toLocaleString('pt-BR')} km
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Frete</span>
                <span className="text-xl font-bold text-sky-700">{formatBRL(s.freightValue)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span>
                Caminhão: <strong>{name.truck(s.truckId)}</strong> • Motorista: <strong>{name.driver(s.driverId)}</strong>
              </span>
              <div className="flex items-center gap-2">
                {s.status === 'AGENDADA' && (
                  <button
                    type="button"
                    disabled={!s.truckId || !s.driverId}
                    title={!s.truckId || !s.driverId ? 'Defina caminhão e motorista ao agendar' : 'Gerar frete a partir desta carga'}
                    onClick={() => onConvert(s)}
                    className="inline-flex items-center gap-1 bg-slate-900 text-sky-300 font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" /> Iniciar viagem
                  </button>
                )}
                <select
                  aria-label="Alterar status"
                  value={s.status}
                  onChange={(e) => onUpdate(s.id, { status: e.target.value as ScheduleStatus })}
                  className="p-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {(Object.keys(statusLabel) as ScheduleStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {statusLabel[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Excluir agendamento"
                  onClick={() => confirm('Excluir este agendamento?') && onRemove(s.id)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {s.notes && <p className="text-xs text-slate-500 italic">Obs.: {s.notes}</p>}
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Agendar Carga" subtitle="Reserve caminhão e motorista para uma coleta futura." onClose={() => setOpen(false)}>
          {customers.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              Cadastre um cliente na aba &quot;Cadastros&quot; antes de agendar uma carga.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Cliente">
                  <select required className={inputCls} value={form.customerId} onChange={set('customerId')}>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Caminhão (opcional)">
                  <select className={inputCls} value={form.truckId} onChange={set('truckId')}>
                    <option value="">A definir</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate} - {t.model}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Motorista (opcional)">
                  <select className={inputCls} value={form.driverId} onChange={set('driverId')}>
                    <option value="">A definir</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Origem">
                  <input required className={inputCls} value={form.origin} onChange={set('origin')} />
                </Field>
                <Field label="Destino">
                  <input required className={inputCls} value={form.destination} onChange={set('destination')} />
                </Field>
                <Field label="Distância (km)">
                  <input required type="number" min="1" className={inputCls} value={form.distanceKm} onChange={set('distanceKm')} />
                </Field>
                <Field label="Carga" className="sm:col-span-2">
                  <input required className={inputCls} value={form.cargoDescription} onChange={set('cargoDescription')} placeholder="O que será transportado" />
                </Field>
                <Field label="Peso (kg)">
                  <input required type="number" min="1" className={inputCls} value={form.cargoWeightKg} onChange={set('cargoWeightKg')} />
                </Field>
                <Field label="Data da coleta">
                  <input required type="date" className={inputCls} value={form.pickupDate} onChange={set('pickupDate')} />
                </Field>
                <Field label="Hora da coleta">
                  <input required type="time" className={inputCls} value={form.pickupTime} onChange={set('pickupTime')} />
                </Field>
                <Field label="Previsão de entrega">
                  <input type="date" className={inputCls} value={form.deliveryDate} onChange={set('deliveryDate')} />
                </Field>
                <Field label="Valor do frete (R$)">
                  <input required type="number" min="1" step="0.01" className={inputCls} value={form.freightValue} onChange={set('freightValue')} />
                </Field>
                <Field label="Observações" className="sm:col-span-2">
                  <input className={inputCls} value={form.notes} onChange={set('notes')} />
                </Field>
              </div>

              {conflict && (
                <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  Este caminhão já tem uma carga agendada nesse dia ({conflict.origin} → {conflict.destination}).
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={primaryBtn}>
                  Salvar agendamento
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
