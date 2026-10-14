'use client';

import React, { useState } from 'react';
import { Users, Truck as TruckIcon, Building2, CircleDot, Plus, Trash2, Phone, Mail, MapPin } from 'lucide-react';
import { Truck, Driver, Customer, TireSupplier, TruckStatus, DriverStatus } from '@/types';
import {
  Field,
  Modal,
  EmptyState,
  Badge,
  inputCls,
  primaryBtn,
  secondaryBtn,
  newId,
} from '@/components/ui';

interface Props {
  trucks: Truck[];
  drivers: Driver[];
  customers: Customer[];
  tireSuppliers: TireSupplier[];
  onAddTruck: (t: Truck) => void;
  onAddDriver: (d: Driver) => void;
  onAddCustomer: (c: Customer) => void;
  onAddSupplier: (s: TireSupplier) => void;
  onRemove: (key: 'trucks' | 'drivers' | 'customers' | 'tireSuppliers', id: string) => void;
}

type Tab = 'drivers' | 'trucks' | 'customers' | 'tireSuppliers';

const PLATE_RE = /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/;
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

function useForm<T extends Record<string, string>>(initial: T) {
  const [v, setV] = useState<T>(initial);
  const bind = (k: keyof T) => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value })),
  });
  return { v, bind, reset: () => setV(initial) };
}

const FormActions = ({ onCancel, error }: { onCancel: () => void; error: string }) => (
  <div className="space-y-3 pt-2">
    {error && (
      <p role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl">
        {error}
      </p>
    )}
    <div className="flex justify-end gap-2">
      <button type="button" className={secondaryBtn} onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" className={primaryBtn}>
        Salvar cadastro
      </button>
    </div>
  </div>
);

/* ---------------- Formulários ---------------- */

function DriverForm({ drivers, onSave, onCancel }: { drivers: Driver[]; onSave: (d: Driver) => void; onCancel: () => void }) {
  const f = useForm({ name: '', cnhNumber: '', cnhCategory: 'E', phone: '', status: 'ATIVO' });
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnh = digits(f.v.cnhNumber);
    if (cnh.length !== 11) return setError('A CNH deve ter 11 dígitos.');
    if (drivers.some((d) => digits(d.cnhNumber) === cnh)) return setError('Já existe um motorista com esta CNH.');
    onSave({
      id: newId(),
      name: f.v.name.trim(),
      cnhNumber: cnh,
      cnhCategory: f.v.cnhCategory,
      phone: f.v.phone.trim(),
      status: f.v.status as DriverStatus,
    });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Nome completo" className="sm:col-span-2">
        <input required minLength={3} className={inputCls} {...f.bind('name')} />
      </Field>
      <Field label="Nº da CNH">
        <input required inputMode="numeric" className={inputCls} {...f.bind('cnhNumber')} placeholder="11 dígitos" />
      </Field>
      <Field label="Categoria">
        <select className={inputCls} {...f.bind('cnhCategory')}>
          {['C', 'D', 'E'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Telefone / WhatsApp">
        <input required type="tel" className={inputCls} {...f.bind('phone')} placeholder="(00) 90000-0000" />
      </Field>
      <Field label="Status">
        <select className={inputCls} {...f.bind('status')}>
          <option value="ATIVO">Ativo</option>
          <option value="FERIAS">Férias</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <FormActions onCancel={onCancel} error={error} />
      </div>
    </form>
  );
}

function TruckForm({ trucks, onSave, onCancel }: { trucks: Truck[]; onSave: (t: Truck) => void; onCancel: () => void }) {
  const f = useForm({
    plate: '',
    brand: '',
    model: '',
    year: String(new Date().getFullYear()),
    tankCapacityLiters: '600',
    initialOdometer: '',
    status: 'ATIVO',
  });
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const plate = f.v.plate.trim().toUpperCase();
    if (!PLATE_RE.test(plate)) return setError('Placa inválida. Use o formato ABC1D23 ou ABC-1234.');
    if (trucks.some((t) => t.plate.replace('-', '') === plate.replace('-', '')))
      return setError('Já existe um veículo com esta placa.');
    const odo = Number(f.v.initialOdometer);
    onSave({
      id: newId(),
      plate,
      brand: f.v.brand.trim(),
      model: f.v.model.trim(),
      year: Number(f.v.year),
      tankCapacityLiters: Number(f.v.tankCapacityLiters),
      initialOdometer: odo,
      currentOdometer: odo,
      status: f.v.status as TruckStatus,
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field label="Placa">
        <input required maxLength={8} className={`${inputCls} uppercase`} {...f.bind('plate')} placeholder="ABC1D23" />
      </Field>
      <Field label="Marca">
        <input required className={inputCls} {...f.bind('brand')} placeholder="Scania, Volvo..." />
      </Field>
      <Field label="Modelo">
        <input required className={inputCls} {...f.bind('model')} placeholder="R450 6x2" />
      </Field>
      <Field label="Ano">
        <input required type="number" min="1990" max="2035" className={inputCls} {...f.bind('year')} />
      </Field>
      <Field label="Tanque (litros)">
        <input required type="number" min="1" className={inputCls} {...f.bind('tankCapacityLiters')} />
      </Field>
      <Field label="Hodômetro atual (km)">
        <input required type="number" min="0" className={inputCls} {...f.bind('initialOdometer')} />
      </Field>
      <Field label="Status">
        <select className={inputCls} {...f.bind('status')}>
          <option value="ATIVO">Ativo</option>
          <option value="MANUTENCAO">Manutenção</option>
          <option value="PARADO">Parado</option>
        </select>
      </Field>
      <div className="sm:col-span-3">
        <FormActions onCancel={onCancel} error={error} />
      </div>
    </form>
  );
}

function PartyForm<T extends Customer | TireSupplier>({
  kind,
  existing,
  onSave,
  onCancel,
}: {
  kind: 'customer' | 'supplier';
  existing: { cnpj?: string | null }[];
  onSave: (x: T) => void;
  onCancel: () => void;
}) {
  const f = useForm({
    name: '',
    cnpj: '',
    contactName: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    extra: kind === 'customer' ? '30' : '',
    notes: '',
  });
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpj = digits(f.v.cnpj);
    if (cnpj.length !== 14) return setError('O CNPJ deve ter 14 dígitos.');
    if (existing.some((x) => digits(x.cnpj) === cnpj)) return setError('Já existe um cadastro com este CNPJ.');
    const base = {
      id: newId(),
      name: f.v.name.trim(),
      cnpj,
      contactName: f.v.contactName.trim(),
      phone: f.v.phone.trim(),
      email: f.v.email.trim(),
      city: f.v.city.trim(),
      state: f.v.state.trim().toUpperCase(),
      notes: f.v.notes.trim(),
    };
    onSave(
      (kind === 'customer'
        ? { ...base, paymentTermsDays: Number(f.v.extra) || 0 }
        : { ...base, brandsSold: f.v.extra.trim() }) as T
    );
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label={kind === 'customer' ? 'Razão social / nome' : 'Nome do fornecedor'} className="sm:col-span-2">
        <input required className={inputCls} {...f.bind('name')} />
      </Field>
      <Field label="CNPJ">
        <input required inputMode="numeric" className={inputCls} {...f.bind('cnpj')} placeholder="00.000.000/0000-00" />
      </Field>
      <Field label="Contato">
        <input required className={inputCls} {...f.bind('contactName')} />
      </Field>
      <Field label="Telefone">
        <input required type="tel" className={inputCls} {...f.bind('phone')} />
      </Field>
      <Field label="E-mail">
        <input type="email" className={inputCls} {...f.bind('email')} />
      </Field>
      <Field label="Cidade">
        <input required className={inputCls} {...f.bind('city')} />
      </Field>
      <Field label="UF">
        <input required maxLength={2} className={`${inputCls} uppercase`} {...f.bind('state')} />
      </Field>
      {kind === 'customer' ? (
        <Field label="Prazo de pagamento (dias)">
          <input required type="number" min="0" className={inputCls} {...f.bind('extra')} />
        </Field>
      ) : (
        <Field label="Marcas de pneus que vende">
          <input required className={inputCls} {...f.bind('extra')} placeholder="Michelin, Pirelli..." />
        </Field>
      )}
      <Field label="Observações">
        <input className={inputCls} {...f.bind('notes')} />
      </Field>
      <div className="sm:col-span-2">
        <FormActions onCancel={onCancel} error={error} />
      </div>
    </form>
  );
}

/* ---------------- Tela principal ---------------- */

const formatCnpj = (c?: string | null) => {
  if (!c) return 'Não informado';
  return digits(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const Row = ({
  title,
  badges,
  lines,
  onDelete,
}: {
  title: string;
  badges?: React.ReactNode;
  lines: React.ReactNode[];
  onDelete: () => void;
}) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between gap-3">
    <div className="space-y-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-900">{title}</span>
        {badges}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
          {l}
        </div>
      ))}
    </div>
    <button
      type="button"
      aria-label={`Excluir ${title}`}
      onClick={() => confirm(`Excluir "${title}"?`) && onDelete()}
      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
);

export const RegistrationsView: React.FC<Props> = (p) => {
  const [tab, setTab] = useState<Tab>('drivers');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number; newLabel: string }[] = [
    { id: 'drivers', label: 'Motoristas', icon: Users, count: p.drivers.length, newLabel: 'Novo motorista' },
    { id: 'trucks', label: 'Veículos / Placas', icon: TruckIcon, count: p.trucks.length, newLabel: 'Novo veículo' },
    { id: 'customers', label: 'Clientes', icon: Building2, count: p.customers.length, newLabel: 'Novo cliente' },
    { id: 'tireSuppliers', label: 'Fornecedores de Pneu', icon: CircleDot, count: p.tireSuppliers.length, newLabel: 'Novo fornecedor' },
  ];
  const current = tabs.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cadastros</h2>
            <p className="text-xs text-slate-500 mt-0.5">Motoristas, veículos, clientes e fornecedores de pneu.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
            <Plus className="w-5 h-5" />
            {current.newLabel}
          </button>
        </div>
        <div role="tablist" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-slate-900 text-sky-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span className={`text-[11px] px-1.5 rounded-full ${active ? 'bg-sky-500 text-slate-950' : 'bg-white'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {tab === 'drivers' &&
          (p.drivers.length === 0 ? (
            <EmptyState text="Nenhum motorista cadastrado." />
          ) : (
            p.drivers.map((d) => (
              <Row
                key={d.id}
                title={d.name}
                badges={
                  <Badge tone={d.status === 'ATIVO' ? 'green' : d.status === 'FERIAS' ? 'amber' : 'red'}>
                    {d.status === 'FERIAS' ? 'Férias' : d.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                  </Badge>
                }
                lines={[`CNH ${d.cnhNumber} • Categoria ${d.cnhCategory}`, <><Phone className="w-3.5 h-3.5" />{d.phone}</>]}
                onDelete={() => p.onRemove('drivers', d.id)}
              />
            ))
          ))}

        {tab === 'trucks' &&
          (p.trucks.length === 0 ? (
            <EmptyState text="Nenhum veículo cadastrado." />
          ) : (
            p.trucks.map((t) => (
              <Row
                key={t.id}
                title={t.plate}
                badges={<Badge tone={t.status === 'ATIVO' ? 'green' : t.status === 'MANUTENCAO' ? 'red' : 'slate'}>{t.status}</Badge>}
                lines={[
                  `${t.brand} ${t.model} • ${t.year}`,
                  `Tanque ${t.tankCapacityLiters} L • ${t.currentOdometer.toLocaleString('pt-BR')} km`,
                ]}
                onDelete={() => p.onRemove('trucks', t.id)}
              />
            ))
          ))}

        {tab === 'customers' &&
          (p.customers.length === 0 ? (
            <EmptyState text="Nenhum cliente cadastrado." />
          ) : (
            p.customers.map((c) => (
              <Row
                key={c.id}
                title={c.name}
                badges={<Badge tone="dark">{c.paymentTermsDays} dias</Badge>}
                lines={[
                  `CNPJ ${formatCnpj(c.cnpj)} • Contato: ${c.contactName}`,
                  <><MapPin className="w-3.5 h-3.5" />{c.city}/{c.state}</>,
                  <><Phone className="w-3.5 h-3.5" />{c.phone}{c.email ? <><Mail className="w-3.5 h-3.5 ml-2" />{c.email}</> : null}</>,
                ]}
                onDelete={() => p.onRemove('customers', c.id)}
              />
            ))
          ))}

        {tab === 'tireSuppliers' &&
          (p.tireSuppliers.length === 0 ? (
            <EmptyState text="Nenhum fornecedor de pneu cadastrado." />
          ) : (
            p.tireSuppliers.map((s) => (
              <Row
                key={s.id}
                title={s.name}
                lines={[
                  `CNPJ ${formatCnpj(s.cnpj)} • Contato: ${s.contactName}`,
                  `Marcas: ${s.brandsSold}`,
                  <><MapPin className="w-3.5 h-3.5" />{s.city}/{s.state}</>,
                  <><Phone className="w-3.5 h-3.5" />{s.phone}{s.email ? <><Mail className="w-3.5 h-3.5 ml-2" />{s.email}</> : null}</>,
                ]}
                onDelete={() => p.onRemove('tireSuppliers', s.id)}
              />
            ))
          ))}
      </div>

      {open && (
        <Modal title={current.newLabel} onClose={close}>
          {tab === 'drivers' && (
            <DriverForm drivers={p.drivers} onCancel={close} onSave={(d) => { p.onAddDriver(d); close(); }} />
          )}
          {tab === 'trucks' && (
            <TruckForm trucks={p.trucks} onCancel={close} onSave={(t) => { p.onAddTruck(t); close(); }} />
          )}
          {tab === 'customers' && (
            <PartyForm<Customer> kind="customer" existing={p.customers} onCancel={close} onSave={(c) => { p.onAddCustomer(c); close(); }} />
          )}
          {tab === 'tireSuppliers' && (
            <PartyForm<TireSupplier> kind="supplier" existing={p.tireSuppliers} onCancel={close} onSave={(s) => { p.onAddSupplier(s); close(); }} />
          )}
        </Modal>
      )}
    </div>
  );
};
