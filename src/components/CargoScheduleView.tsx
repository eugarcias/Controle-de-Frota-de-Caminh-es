'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Plus, ArrowRight, Package, Route, Play, Trash2, AlertTriangle, UserPlus, UserCheck, Loader2, BellRing, Pencil, MessageSquare } from 'lucide-react';
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
  /** Deve devolver o registro salvo (ou null em caso de erro) */
  onAdd: (s: CargoSchedule) => Promise<unknown>;
  /** Cadastro básico do cliente feito no próprio agendamento; devolve o cliente salvo (com o id do banco) */
  onAddCustomer: (c: Customer) => Promise<Customer | null>;
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
  // Cliente: digita o nome; se não existir, os campos abaixo viram o cadastro básico
  customerName: '',
  customerPhone: '',
  customerCnpj: '',
  customerCity: '',
  customerState: '',
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
  onAddCustomer,
  onUpdate,
  onRemove,
  onConvert,
}) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<'ATIVAS' | 'TODAS'>('ATIVAS');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const quickInstructions = [
    '⛽ Abastecer antes de carregar',
    '⚖️ Passar na balança',
    '⏰ Chegar com 30 min de antecedência',
    '📄 Conferir nota fiscal na portaria',
    '🔧 Conferir calibragem dos pneus',
  ];

  const set = (k: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Cliente digitado já existe? (compara sem acento/maiúsculas/espaços extras)
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  const matchedCustomer = useMemo(() => {
    const n = norm(form.customerName);
    return n ? customers.find((c) => norm(c.name) === n) ?? null : null;
  }, [customers, form.customerName]);
  const isNewCustomer = form.customerName.trim().length >= 2 && !matchedCustomer;

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
    setEditingId(null);
    setForm({
      ...emptyForm,
      pickupDate: new Date().toISOString().slice(0, 10),
    });
    setSaveError(null);
    setOpen(true);
  };

  const openEditModal = (s: CargoSchedule) => {
    setEditingId(s.id);
    const cust = customers.find((c) => c.id === s.customerId);
    const timePart = s.pickupDate.includes('T') ? s.pickupDate.slice(11, 16) : '07:00';
    setForm({
      ...emptyForm,
      customerName: cust?.name ?? '',
      truckId: s.truckId ?? '',
      driverId: s.driverId ?? '',
      origin: s.origin,
      destination: s.destination,
      distanceKm: String(s.distanceKm || ''),
      cargoDescription: s.cargoDescription,
      cargoWeightKg: String(s.cargoWeightKg || ''),
      pickupDate: s.pickupDate.slice(0, 10),
      pickupTime: timePart || '07:00',
      deliveryDate: s.deliveryDate ? s.deliveryDate.slice(0, 10) : '',
      freightValue: String(s.freightValue || ''),
      notes: s.notes ?? '',
    });
    setSaveError(null);
    setOpen(true);
  };

  const appendQuickInstruction = (text: string) => {
    setForm((f) => {
      const current = f.notes.trim();
      if (current.includes(text)) return f;
      return {
        ...f,
        notes: current ? `${current} | ${text}` : text,
      };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaveError(null);

    const customerName = form.customerName.trim().replace(/\s+/g, ' ');
    if (customerName.length < 2) {
      setSaveError('Informe o nome do cliente.');
      return;
    }

    setSaving(true);
    try {
      // 1) Cliente: usa o existente ou faz o cadastro básico agora
      let customerId = matchedCustomer?.id;
      if (!customerId) {
        const phone = form.customerPhone.trim();
        if (phone.replace(/\D/g, '').length < 8) {
          setSaveError('Informe um telefone válido para cadastrar o novo cliente.');
          return;
        }
        const created = await onAddCustomer({
          id: newId(), // o banco gera o id definitivo; usamos o que voltar da API
          name: customerName,
          contactName: customerName,
          phone,
          cnpj: form.customerCnpj.trim() || null,
          email: '',
          city: form.customerCity.trim(),
          state: form.customerState.trim().toUpperCase().slice(0, 2),
          paymentTermsDays: 30,
        });
        if (!created?.id) {
          setSaveError('Não foi possível cadastrar o cliente (CNPJ já cadastrado ou sem conexão). Confira e tente de novo.');
          return;
        }
        customerId = created.id;
      }

      // 2) Agendamento (Criação ou Edição)
      const pickupIso = `${form.pickupDate}T${form.pickupTime || '07:00'}:00.000Z`;
      const deliveryIso = form.deliveryDate ? `${form.deliveryDate}T12:00:00.000Z` : null;

      if (editingId) {
        onUpdate(editingId, {
          customerId,
          truckId: form.truckId || null,
          driverId: form.driverId || null,
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          distanceKm: Number(form.distanceKm),
          cargoDescription: form.cargoDescription.trim(),
          cargoWeightKg: Number(form.cargoWeightKg) || 0,
          pickupDate: pickupIso,
          deliveryDate: deliveryIso,
          freightValue: Number(form.freightValue),
          notes: form.notes.trim(),
        });
        setOpen(false);
        setEditingId(null);
        return;
      }

      const s: CargoSchedule = {
        id: newId(),
        customerId,
        truckId: form.truckId || null,
        driverId: form.driverId || null,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        distanceKm: Number(form.distanceKm),
        cargoDescription: form.cargoDescription.trim(),
        cargoWeightKg: Number(form.cargoWeightKg) || 0,
        pickupDate: pickupIso,
        deliveryDate: deliveryIso,
        freightValue: Number(form.freightValue),
        status: 'AGENDADA',
        notes: form.notes.trim(),
      };
      const saved = await onAdd(s);
      if (!saved) {
        setSaveError('Não foi possível salvar o agendamento. Verifique a conexão e tente novamente.');
        return;
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
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
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            aria-label="Filtro da agenda"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ATIVAS' | 'TODAS')}
            className="min-h-11 sm:min-h-10 text-xs font-semibold px-2.5 bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="ATIVAS">Somente ativas</option>
            <option value="TODAS">Todas</option>
          </select>
          <button type="button" onClick={openModal} className={`${primaryBtn} flex-1 sm:flex-none`}>
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
              <div className="sm:text-right">
                <span className="text-xs text-slate-500 block">Frete</span>
                <span className="text-xl font-bold text-sky-700">{formatBRL(s.freightValue)}</span>
              </div>
            </div>

            {s.notes && (
              <div className="flex items-start gap-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-xl">
                <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-800 block">
                    Instrução / Observação do Admin para o Motorista
                  </span>
                  <span className="font-semibold">{s.notes}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Caminhão: <strong>{name.truck(s.truckId)}</strong> • Motorista: <strong>{name.driver(s.driverId)}</strong>
                </span>
                {s.status === 'AGENDADA' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    <BellRing className="w-3 h-3 text-emerald-600" />
                    Notificado no App do Motorista
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => openEditModal(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <select
                  aria-label="Alterar status"
                  value={s.status}
                  onChange={(e) => onUpdate(s.id, { status: e.target.value as ScheduleStatus })}
                  className="p-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
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
          </div>
        ))}
      </div>

      {open && (
        <Modal
          title={editingId ? 'Editar Agendamento de Carga' : 'Agendar Carga'}
          subtitle="Defina horário, destino, motorista e instruções — o motorista será notificado imediatamente no painel dele."
          onClose={() => {
            setOpen(false);
            setEditingId(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            {/* Cliente: escolhe um existente pela lista ou digita um novo nome */}
            <div className="space-y-3">
              <Field
                label="Cliente"
                hint={customers.length > 0 ? 'Comece a digitar para escolher um cliente já cadastrado.' : undefined}
              >
                <input
                  required
                  minLength={2}
                  list="schedule-customers"
                  autoComplete="off"
                  className={inputCls}
                  value={form.customerName}
                  onChange={set('customerName')}
                  placeholder="Nome / razão social do cliente"
                />
                <datalist id="schedule-customers">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>

              {matchedCustomer && (
                <p className="flex items-center gap-2 text-xs text-sky-900 bg-sky-50 ring-1 ring-sky-200 p-2.5 rounded-xl">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  Cliente cadastrado{matchedCustomer.phone ? ` • ${matchedCustomer.phone}` : ''}
                  {matchedCustomer.city ? ` • ${matchedCustomer.city}/${matchedCustomer.state}` : ''}
                </p>
              )}

              {isNewCustomer && (
                <fieldset className="rounded-xl ring-1 ring-amber-200 bg-amber-50/60 p-3 space-y-3">
                  <legend className="sr-only">Cadastro básico do novo cliente</legend>
                  <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <UserPlus className="w-4 h-4 shrink-0" />
                    Cliente novo — será cadastrado junto com o agendamento.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <Field label="Telefone / WhatsApp" className="sm:col-span-2">
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        className={inputCls}
                        value={form.customerPhone}
                        onChange={set('customerPhone')}
                        placeholder="(00) 00000-0000"
                      />
                    </Field>
                    <Field label="CNPJ (opcional)" className="sm:col-span-2">
                      <input
                        inputMode="numeric"
                        className={inputCls}
                        value={form.customerCnpj}
                        onChange={set('customerCnpj')}
                        placeholder="00.000.000/0000-00"
                      />
                    </Field>
                    <Field label="Cidade (opcional)" className="sm:col-span-3">
                      <input className={inputCls} value={form.customerCity} onChange={set('customerCity')} />
                    </Field>
                    <Field label="UF">
                      <input
                        maxLength={2}
                        autoCapitalize="characters"
                        className={`${inputCls} uppercase`}
                        value={form.customerState}
                        onChange={set('customerState')}
                        placeholder="SP"
                      />
                    </Field>
                  </div>
                </fieldset>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <Field label="Distância (km)">
                <input required type="number" inputMode="numeric" min="1" className={inputCls} value={form.distanceKm} onChange={set('distanceKm')} />
              </Field>
              <Field label="Origem">
                <input required className={inputCls} value={form.origin} onChange={set('origin')} />
              </Field>
              <Field label="Destino">
                <input required className={inputCls} value={form.destination} onChange={set('destination')} />
              </Field>
              <Field label="Peso (kg)">
                <input required type="number" inputMode="numeric" min="1" className={inputCls} value={form.cargoWeightKg} onChange={set('cargoWeightKg')} />
              </Field>
              <Field label="Carga" className="sm:col-span-3">
                <input required className={inputCls} value={form.cargoDescription} onChange={set('cargoDescription')} placeholder="O que será transportado" />
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
                <input required type="number" inputMode="decimal" min="1" step="0.01" className={inputCls} value={form.freightValue} onChange={set('freightValue')} />
              </Field>
              <Field
                label="Instruções / Observações para o Motorista"
                hint="Aparece em destaque na agenda e na notificação do motorista."
                className="sm:col-span-2"
              >
                <input
                  className={inputCls}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Avisos sobre abastecimento, horário ou portaria"
                />
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {quickInstructions.map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => appendQuickInstruction(inst)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition"
                    >
                      + {inst}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {conflict && (
              <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Este caminhão já tem uma carga agendada nesse dia ({conflict.origin} → {conflict.destination}).
              </p>
            )}

            {saveError && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-900 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {saveError}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={primaryBtn}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving
                  ? 'Salvando…'
                  : editingId
                    ? 'Salvar alterações'
                    : isNewCustomer
                      ? 'Cadastrar cliente e agendar'
                      : 'Salvar e notificar motorista'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
