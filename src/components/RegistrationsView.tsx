'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Truck as TruckIcon,
  Building2,
  CircleDot,
  Plus,
  Trash2,
  Pencil,
  Phone,
  Mail,
  MapPin,
  KeyRound,
  ShieldCheck,
  Star,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
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

interface UserAccount {
  id: string;
  email: string;
  loginDisplay: string;
  name: string;
  role: 'ADMIN' | 'DRIVER';
  active: boolean;
  driverId: string | null;
  truckId: string | null;
}

interface Props {
  trucks: Truck[];
  drivers: Driver[];
  customers: Customer[];
  tireSuppliers: TireSupplier[];
  onAddTruck: (t: Truck) => Promise<Truck | null>;
  onUpdateTruck: (id: string, patch: Partial<Truck>) => Promise<Truck | null>;
  onAddDriver: (d: Driver) => Promise<Driver | null>;
  onUpdateDriver: (id: string, patch: Partial<Driver>) => Promise<Driver | null>;
  onAddCustomer: (c: Customer) => Promise<Customer | null>;
  onUpdateCustomer: (id: string, patch: Partial<Customer>) => Promise<Customer | null>;
  onAddSupplier: (s: TireSupplier) => Promise<TireSupplier | null>;
  onUpdateSupplier: (id: string, patch: Partial<TireSupplier>) => Promise<TireSupplier | null>;
  onRemove: (key: 'trucks' | 'drivers' | 'customers' | 'tireSuppliers', id: string) => Promise<boolean>;
}

type Tab = 'trucks' | 'drivers' | 'customers' | 'tireSuppliers' | 'users';

const PLATE_RE = /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/;
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

const FormActions = ({
  onCancel,
  error,
  saving,
  saveLabel = 'Salvar',
}: {
  onCancel: () => void;
  error: string;
  saving?: boolean;
  saveLabel?: string;
}) => (
  <div className="space-y-3 pt-2">
    {error && (
      <p role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl">
        {error}
      </p>
    )}
    <div className="flex justify-end gap-2">
      <button type="button" className={secondaryBtn} onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" disabled={saving} className={primaryBtn}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? 'Salvando…' : saveLabel}
      </button>
    </div>
  </div>
);

/* ---------------- Formulário de Caminhão (Criar e Editar) ---------------- */

function TruckForm({
  trucks,
  initial,
  onSave,
  onCancel,
}: {
  trucks: Truck[];
  initial?: Truck | null;
  onSave: (t: Truck) => Promise<void>;
  onCancel: () => void;
}) {
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? 'Volvo');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(String(initial?.year ?? new Date().getFullYear()));
  const [tankCapacityLiters, setTankCapacityLiters] = useState(
    String(initial?.tankCapacityLiters ?? 600)
  );
  const [currentOdometer, setCurrentOdometer] = useState(String(initial?.currentOdometer ?? 0));
  const [status, setStatus] = useState<TruckStatus>(initial?.status ?? 'ATIVO');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPlate = plate.trim().toUpperCase();
    if (!PLATE_RE.test(cleanPlate)) {
      return setError('Placa inválida. Digite no formato ABC-1234 ou ABC-1D23.');
    }
    const norm = (p: string) => p.replace('-', '').toUpperCase();
    if (trucks.some((t) => t.id !== initial?.id && norm(t.plate) === norm(cleanPlate))) {
      return setError('Já existe um caminhão cadastrado com esta placa.');
    }
    const odo = Number(currentOdometer) || 0;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? newId(),
        plate: cleanPlate,
        brand: brand.trim() || 'Volvo',
        model: model.trim() || 'Não informado',
        year: Number(year) || new Date().getFullYear(),
        tankCapacityLiters: Number(tankCapacityLiters) || 600,
        initialOdometer: initial ? initial.initialOdometer : odo,
        currentOdometer: odo,
        status,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <Field label="Placa do Caminhão *">
        <input
          required
          maxLength={8}
          className={`${inputCls} uppercase font-bold`}
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Ex: LBQ-2G04"
        />
      </Field>
      <Field label="Marca *">
        <input
          required
          className={inputCls}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Volvo, Scania, Mercedes..."
        />
      </Field>
      <Field label="Modelo *">
        <input
          required
          className={inputCls}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Ex: FH 420, NH 380, EDC"
        />
      </Field>
      <Field label="Ano">
        <input
          required
          type="number"
          min="1980"
          max="2035"
          className={inputCls}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </Field>
      <Field label="Capacidade do Tanque (Litros)">
        <input
          required
          type="number"
          min="50"
          className={inputCls}
          value={tankCapacityLiters}
          onChange={(e) => setTankCapacityLiters(e.target.value)}
        />
      </Field>
      <Field label="Hodômetro Atual (KM)">
        <input
          required
          type="number"
          min="0"
          className={inputCls}
          value={currentOdometer}
          onChange={(e) => setCurrentOdometer(e.target.value)}
        />
      </Field>
      <Field label="Situação do Caminhão" className="sm:col-span-3">
        <select
          className={inputCls}
          value={status}
          onChange={(e) => setStatus(e.target.value as TruckStatus)}
        >
          <option value="ATIVO">Ativo (Rodando normalmente)</option>
          <option value="MANUTENCAO">Em Manutenção (Na oficina)</option>
          <option value="PARADO">Parado / Reserva</option>
        </select>
      </Field>
      <div className="sm:col-span-3">
        <FormActions
          onCancel={onCancel}
          error={error}
          saving={saving}
          saveLabel={initial ? 'Salvar Alterações' : 'Cadastrar Caminhão'}
        />
      </div>
    </form>
  );
}

/* ---------------- Formulário de Motorista (Criar e Editar + Login/Senha) ---------------- */

function DriverForm({
  drivers,
  trucks,
  initial,
  existingAccount,
  onSave,
  onCancel,
}: {
  drivers: Driver[];
  trucks: Truck[];
  initial?: Driver | null;
  existingAccount?: UserAccount | null;
  onSave: (
    d: Driver,
    credentials?: { login: string; password: string; truckId: string | null }
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [cnhNumber, setCnhNumber] = useState(initial?.cnhNumber ?? '');
  const [cnhCategory, setCnhCategory] = useState(initial?.cnhCategory || 'E');
  const [status, setStatus] = useState<DriverStatus>(initial?.status ?? 'ATIVO');

  // Campos de acesso ao App do Motorista
  const [login, setLogin] = useState(existingAccount?.loginDisplay ?? '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [truckId, setTruckId] = useState<string>(existingAccount?.truckId ?? trucks[0]?.id ?? '');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Informe o nome do motorista.');
    if (digits(phone).length < 8) return setError('Informe um telefone válido com DDD.');

    const cleanCnh = digits(cnhNumber);
    if (
      cleanCnh &&
      drivers.some((d) => d.id !== initial?.id && digits(d.cnhNumber) === cleanCnh)
    ) {
      return setError('Já existe outro motorista com este número de CNH.');
    }

    if (login.trim() && !existingAccount && password.trim().length < 4) {
      return setError('Defina uma senha de pelo menos 4 caracteres para o motorista entrar no app.');
    }

    setSaving(true);
    try {
      await onSave(
        {
          id: initial?.id ?? newId(),
          name: name.trim(),
          cnhNumber: cleanCnh || null,
          cnhCategory,
          phone: phone.trim(),
          status,
        },
        login.trim()
          ? {
              login: login.trim(),
              password: password.trim(),
              truckId: truckId || null,
            }
          : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar motorista.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Nome completo do motorista *" className="sm:col-span-2">
          <input
            required
            minLength={2}
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Carlos Alberto Silva"
          />
        </Field>
        <Field label="Telefone / WhatsApp *">
          <input
            required
            type="tel"
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex: (51) 99999-9999"
          />
        </Field>
        <Field label="Situação">
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as DriverStatus)}
          >
            <option value="ATIVO">Ativo</option>
            <option value="FERIAS">Em Férias</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </Field>
        <Field label="Nº da CNH (Opcional)">
          <input
            inputMode="numeric"
            className={inputCls}
            value={cnhNumber}
            onChange={(e) => setCnhNumber(e.target.value)}
            placeholder="11 dígitos (se tiver em mãos)"
          />
        </Field>
        <Field label="Categoria da CNH">
          <select
            className={inputCls}
            value={cnhCategory}
            onChange={(e) => setCnhCategory(e.target.value)}
          >
            {['C', 'D', 'E'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Bloco Simples de Acesso ao Aplicativo e Caminhão Preferido */}
      <div className="rounded-2xl bg-sky-50/70 border border-sky-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sky-950 font-bold text-sm">
          <KeyRound className="w-4 h-4 text-sky-600" />
          <span>Acesso do Motorista no Celular &amp; Caminhão Preferido</span>
        </div>
        <p className="text-xs text-slate-600">
          Defina um usuário simples (ex: <strong>carlos</strong>) e uma senha para o motorista entrar no aplicativo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Usuário de Login (ou E-mail)">
            <input
              className={inputCls}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Ex: carlos"
            />
          </Field>

          <Field
            label={
              existingAccount
                ? 'Nova Senha (deixe vazio p/ manter)'
                : 'Senha do Motorista'
            }
          >
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={`${inputCls} pr-16`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={existingAccount ? 'Manter atual' : 'Ex: 123456'}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field label="Caminhão Principal / Preferido ⭐">
            <select
              className={inputCls}
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
            >
              <option value="">Sem caminhão fixo</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} — {t.model}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <FormActions
        onCancel={onCancel}
        error={error}
        saving={saving}
        saveLabel={initial ? 'Salvar Alterações' : 'Cadastrar Motorista'}
      />
    </form>
  );
}

/* ---------------- Formulário de Clientes e Fornecedores ---------------- */

function PartyForm<T extends Customer | TireSupplier>({
  kind,
  existing,
  initial,
  onSave,
  onCancel,
}: {
  kind: 'customer' | 'supplier';
  existing: { id?: string; cnpj?: string | null }[];
  initial?: T | null;
  onSave: (x: T) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? '');
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? 'RS');
  const [extra, setExtra] = useState(
    kind === 'customer'
      ? String((initial as Customer | null)?.paymentTermsDays ?? 30)
      : String((initial as TireSupplier | null)?.brandsSold ?? 'Michelin, Pirelli')
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanCnpj = digits(cnpj);
    if (kind === 'supplier' && cleanCnpj.length < 8) {
      return setError('Informe o CNPJ ou CPF do fornecedor.');
    }
    if (
      cleanCnpj &&
      existing.some((x) => x.id !== initial?.id && digits(x.cnpj) === cleanCnpj)
    ) {
      return setError('Já existe um cadastro com este CNPJ.');
    }

    setSaving(true);
    try {
      const base = {
        id: initial?.id ?? newId(),
        name: name.trim(),
        cnpj: cleanCnpj || (kind === 'supplier' ? '00000000000000' : null),
        contactName: contactName.trim() || name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        notes: notes.trim(),
      };
      await onSave(
        (kind === 'customer'
          ? { ...base, paymentTermsDays: Number(extra) || 30 }
          : { ...base, cnpj: cleanCnpj || '00000000000000', brandsSold: extra.trim() || 'Diversas' }) as T
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <Field
        label={kind === 'customer' ? 'Nome / Empresa Cliente *' : 'Nome do Fornecedor *'}
        className="sm:col-span-2"
      >
        <input
          required
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Telefone / WhatsApp *">
        <input
          required
          type="tel"
          className={inputCls}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(00) 90000-0000"
        />
      </Field>
      <Field label={kind === 'customer' ? 'CNPJ (Opcional)' : 'CNPJ *'}>
        <input
          required={kind === 'supplier'}
          inputMode="numeric"
          className={inputCls}
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
        />
      </Field>
      <Field label="Pessoa de Contato">
        <input
          className={inputCls}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
      </Field>
      <Field label="E-mail (Opcional)">
        <input
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Cidade">
        <input
          className={inputCls}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </Field>
      <Field label="UF (Estado)">
        <input
          maxLength={2}
          className={`${inputCls} uppercase`}
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </Field>
      {kind === 'customer' ? (
        <Field label="Prazo de pagamento (dias)">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </Field>
      ) : (
        <Field label="Marcas de pneus que trabalha">
          <input
            className={inputCls}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Michelin, Pirelli..."
          />
        </Field>
      )}
      <Field label="Observações">
        <input
          className={inputCls}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <FormActions
          onCancel={onCancel}
          error={error}
          saving={saving}
          saveLabel={initial ? 'Salvar Alterações' : 'Salvar Cadastro'}
        />
      </div>
    </form>
  );
}

/* ---------------- Modal Dedicado de Acesso / Senha (Usuário ou Admin) ---------------- */

function UserAccessModal({
  initialUser,
  presetDriver,
  drivers,
  trucks,
  onSaved,
  onClose,
}: {
  initialUser?: UserAccount | null;
  presetDriver?: Driver | null;
  drivers: Driver[];
  trucks: Truck[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<'ADMIN' | 'DRIVER'>(
    initialUser?.role ?? (presetDriver ? 'DRIVER' : 'DRIVER')
  );
  const [name, setName] = useState(initialUser?.name ?? presetDriver?.name ?? '');
  const [login, setLogin] = useState(
    initialUser?.loginDisplay ??
      (presetDriver ? presetDriver.name.split(' ')[0].toLowerCase() : '')
  );
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [driverId, setDriverId] = useState<string>(
    initialUser?.driverId ?? presetDriver?.id ?? drivers[0]?.id ?? ''
  );
  const [truckId, setTruckId] = useState<string>(
    initialUser?.truckId ?? trucks[0]?.id ?? ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login.trim()) return setError('Informe o usuário ou e-mail de login.');
    if (!initialUser && password.trim().length < 4) {
      return setError('Informe uma senha de pelo menos 4 caracteres.');
    }

    setSaving(true);
    try {
      const url = initialUser ? `/api/admin/users/${initialUser.id}` : '/api/admin/users';
      const method = initialUser ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: login.trim(),
          ...(password.trim() ? { password: password.trim() } : {}),
          name: name.trim() || login.trim(),
          role,
          driverId: role === 'DRIVER' ? driverId || null : null,
          truckId: role === 'DRIVER' ? truckId || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar acesso.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initialUser ? `Alterar Acesso / Senha (${initialUser.name})` : 'Criar Usuário e Senha de Acesso'}
      subtitle="O usuário criado aqui poderá entrar no sistema pelo celular ou computador."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Tipo de Acesso">
            <select
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'DRIVER')}
            >
              <option value="DRIVER">Motorista (Apenas App de Lançamentos)</option>
              <option value="ADMIN">Administrador (Painel Completo da Frota)</option>
            </select>
          </Field>

          <Field label="Nome da Pessoa *">
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vinicius Garcia"
            />
          </Field>

          <Field label="Usuário para Login (ou E-mail) *">
            <input
              required
              className={`${inputCls} font-bold`}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Ex: vinicius ou carlos"
            />
          </Field>

          <Field label={initialUser ? 'Nova Senha (deixe vazio p/ manter)' : 'Senha de Acesso *'}>
            <div className="relative">
              <input
                required={!initialUser}
                type={showPass ? 'text' : 'password'}
                className={`${inputCls} pr-20 font-bold`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initialUser ? 'Digite p/ trocar a senha' : 'Ex: 123456'}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700"
              >
                {showPass ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </Field>

          {role === 'DRIVER' && (
            <>
              <Field label="Motorista Vinculado">
                <select
                  className={inputCls}
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                >
                  <option value="">Selecione o motorista</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Caminhão Preferido / Principal ⭐">
                <select
                  className={inputCls}
                  value={truckId}
                  onChange={(e) => setTruckId(e.target.value)}
                >
                  <option value="">Automático (último utilizado)</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plate} — {t.model}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        <FormActions
          onCancel={onClose}
          error={error}
          saving={saving}
          saveLabel="Salvar Usuário e Senha"
        />
      </form>
    </Modal>
  );
}

/* ---------------- Tela Principal de Cadastros ---------------- */

const formatCnpj = (c?: string | null) => {
  if (!c) return 'Não informado';
  return digits(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const Row = ({
  title,
  badges,
  lines,
  extraActions,
  onEdit,
  onDelete,
}: {
  title: string;
  badges?: React.ReactNode;
  lines: React.ReactNode[];
  extraActions?: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
}) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-3">
    <div className="space-y-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-base text-slate-900">{title}</span>
        {badges}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
          {l}
        </div>
      ))}
    </div>
    <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
      {extraActions}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Editar</span>
        </button>
      )}
      <button
        type="button"
        aria-label={`Excluir ${title}`}
        onClick={() => confirm(`Tem certeza que deseja excluir "${title}"?`) && onDelete()}
        className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
      >
        <Trash2 className="w-4 h-4" />
        <span className="sm:hidden">Excluir</span>
      </button>
    </div>
  </div>
);

export const RegistrationsView: React.FC<Props> = (p) => {
  const [tab, setTab] = useState<Tab>('trucks');
  const [open, setOpen] = useState(false);

  // Estados de Edição
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<TireSupplier | null>(null);

  // Contas de Acesso (Logins de Motoristas e Administradores)
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [accessModal, setAccessModal] = useState<{
    open: boolean;
    user?: UserAccount | null;
    driver?: Driver | null;
  }>({ open: false });
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const list = (await res.json()) as UserAccount[];
        setAccounts(list);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const showSuccess = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4500);
  };

  const close = () => {
    setOpen(false);
    setEditingTruck(null);
    setEditingDriver(null);
    setEditingCustomer(null);
    setEditingSupplier(null);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number; newLabel: string }[] = [
    {
      id: 'trucks',
      label: 'Caminhões / Placas',
      icon: TruckIcon,
      count: p.trucks.length,
      newLabel: 'Novo Caminhão',
    },
    {
      id: 'drivers',
      label: 'Motoristas',
      icon: Users,
      count: p.drivers.length,
      newLabel: 'Novo Motorista',
    },
    {
      id: 'users',
      label: 'Logins e Senhas',
      icon: KeyRound,
      count: accounts.length,
      newLabel: 'Novo Login / Senha',
    },
    {
      id: 'customers',
      label: 'Clientes',
      icon: Building2,
      count: p.customers.length,
      newLabel: 'Novo Cliente',
    },
    {
      id: 'tireSuppliers',
      label: 'Fornecedores',
      icon: CircleDot,
      count: p.tireSuppliers.length,
      newLabel: 'Novo Fornecedor',
    },
  ];
  const current = tabs.find((t) => t.id === tab)!;

  const getTruckLabel = (id?: string | null) => {
    if (!id) return null;
    const t = p.trucks.find((x) => x.id === id);
    return t ? `${t.plate} (${t.model})` : null;
  };

  return (
    <div className="space-y-6">
      {bannerMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 text-white p-4 text-sm font-bold shadow-md"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cadastros e Acessos da Frota</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adicione, edite ou exclua caminhões, motoristas, senhas do aplicativo e clientes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (tab === 'users') {
                setAccessModal({ open: true, user: null, driver: null });
              } else {
                setOpen(true);
              }
            }}
            className={primaryBtn}
          >
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
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  active
                    ? 'bg-slate-900 text-sky-300 shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                    active ? 'bg-sky-500 text-slate-950' : 'bg-white text-slate-700'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Caminhões Dinâmicos */}
      {tab === 'trucks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {p.trucks.length === 0 ? (
            <EmptyState text="Nenhum caminhão cadastrado." />
          ) : (
            p.trucks.map((t) => (
              <Row
                key={t.id}
                title={`${t.plate} — ${t.brand} ${t.model}`}
                badges={
                  <Badge
                    tone={
                      t.status === 'ATIVO'
                        ? 'green'
                        : t.status === 'MANUTENCAO'
                        ? 'red'
                        : 'slate'
                    }
                  >
                    {t.status === 'ATIVO'
                      ? 'Ativo'
                      : t.status === 'MANUTENCAO'
                      ? 'Em Manutenção'
                      : 'Parado'}
                  </Badge>
                }
                lines={[
                  `Ano ${t.year} • Tanque de ${t.tankCapacityLiters} Litros`,
                  <>
                    Hodômetro atual:{' '}
                    <strong className="text-slate-900">
                      {t.currentOdometer.toLocaleString('pt-BR')} km
                    </strong>
                  </>,
                ]}
                onEdit={() => {
                  setEditingTruck(t);
                  setOpen(true);
                }}
                onDelete={() => p.onRemove('trucks', t.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Lista de Motoristas + Senha do App + Caminhão Preferido */}
      {tab === 'drivers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {p.drivers.length === 0 ? (
            <EmptyState text="Nenhum motorista cadastrado." />
          ) : (
            p.drivers.map((d) => {
              const acc = accounts.find((a) => a.driverId === d.id);
              const prefTruck = getTruckLabel(acc?.truckId);
              return (
                <Row
                  key={d.id}
                  title={d.name}
                  badges={
                    <>
                      <Badge
                        tone={
                          d.status === 'ATIVO'
                            ? 'green'
                            : d.status === 'FERIAS'
                            ? 'amber'
                            : 'red'
                        }
                      >
                        {d.status === 'FERIAS'
                          ? 'Férias'
                          : d.status === 'ATIVO'
                          ? 'Ativo'
                          : 'Inativo'}
                      </Badge>
                      {acc ? (
                        <Badge tone="dark">Login: {acc.loginDisplay}</Badge>
                      ) : (
                        <Badge tone="amber">Sem senha do App</Badge>
                      )}
                    </>
                  }
                  lines={[
                    <>
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{d.phone}</span>
                      {d.cnhNumber ? (
                        <span>
                          • CNH {d.cnhNumber} (Cat. {d.cnhCategory})
                        </span>
                      ) : null}
                    </>,
                    prefTruck ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        Caminhão preferido: {prefTruck}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Caminhão selecionado automaticamente pelo último uso
                      </span>
                    ),
                  ]}
                  extraActions={
                    <button
                      type="button"
                      onClick={() =>
                        setAccessModal({ open: true, user: acc ?? null, driver: d })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-xl"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                      <span>{acc ? 'Trocar Senha' : 'Criar Senha'}</span>
                    </button>
                  }
                  onEdit={() => {
                    setEditingDriver(d);
                    setOpen(true);
                  }}
                  onDelete={() => p.onRemove('drivers', d.id)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Lista de Logins e Senhas (Administradores e Motoristas) */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Como funciona o login dos motoristas e administradores:</p>
              <p>
                Os motoristas não precisam criar conta. Você cria o <strong>Usuário</strong> (ex:{' '}
                <code>carlos</code>) e a <strong>Senha</strong> (ex: <code>123456</code>) aqui mesmo. Quando o
                motorista entra no celular, o login dele fica salvo para sempre.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {accounts.length === 0 ? (
              <EmptyState text="Nenhum login cadastrado." />
            ) : (
              accounts.map((u) => {
                const drv = p.drivers.find((d) => d.id === u.driverId);
                const trk = getTruckLabel(u.truckId);
                return (
                  <Row
                    key={u.id}
                    title={u.name}
                    badges={
                      <>
                        <Badge tone={u.role === 'ADMIN' ? 'dark' : 'green'}>
                          {u.role === 'ADMIN' ? 'Administrador (Painel Total)' : 'Motorista (App)'}
                        </Badge>
                        {!u.active && <Badge tone="red">Desativado</Badge>}
                      </>
                    }
                    lines={[
                      <>
                        Usuário para digitar no login:{' '}
                        <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {u.loginDisplay}
                        </strong>
                      </>,
                      u.role === 'DRIVER' ? (
                        <>
                          Motorista: <strong>{drv?.name ?? 'Automático'}</strong>
                          {trk ? ` • Caminhão preferido: ${trk}` : ''}
                        </>
                      ) : (
                        'Acesso completo a relatórios, fretes, manutenções e cadastros'
                      ),
                    ]}
                    extraActions={
                      <button
                        type="button"
                        onClick={() => setAccessModal({ open: true, user: u, driver: drv ?? null })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-xl"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                        <span>Alterar Senha / Acesso</span>
                      </button>
                    }
                    onDelete={async () => {
                      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        alert(data?.error || 'Não foi possível remover.');
                        return;
                      }
                      showSuccess('Acesso removido com sucesso.');
                      loadAccounts();
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Lista de Clientes */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {p.customers.length === 0 ? (
            <EmptyState text="Nenhum cliente cadastrado." />
          ) : (
            p.customers.map((c) => (
              <Row
                key={c.id}
                title={c.name}
                badges={<Badge tone="dark">{c.paymentTermsDays} dias</Badge>}
                lines={[
                  `CNPJ: ${formatCnpj(c.cnpj)}${c.contactName ? ` • Contato: ${c.contactName}` : ''}`,
                  c.city || c.state ? (
                    <>
                      <MapPin className="w-3.5 h-3.5" />
                      {c.city}/{c.state}
                    </>
                  ) : null,
                  <>
                    <Phone className="w-3.5 h-3.5" />
                    {c.phone}
                    {c.email ? (
                      <>
                        <Mail className="w-3.5 h-3.5 ml-2" />
                        {c.email}
                      </>
                    ) : null}
                  </>,
                ].filter(Boolean)}
                onEdit={() => {
                  setEditingCustomer(c);
                  setOpen(true);
                }}
                onDelete={() => p.onRemove('customers', c.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Lista de Fornecedores */}
      {tab === 'tireSuppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {p.tireSuppliers.length === 0 ? (
            <EmptyState text="Nenhum fornecedor cadastrado." />
          ) : (
            p.tireSuppliers.map((s) => (
              <Row
                key={s.id}
                title={s.name}
                lines={[
                  `CNPJ: ${formatCnpj(s.cnpj)} • Contato: ${s.contactName}`,
                  `Marcas: ${s.brandsSold}`,
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    {s.city}/{s.state} • <Phone className="w-3.5 h-3.5" />
                    {s.phone}
                  </>,
                ]}
                onEdit={() => {
                  setEditingSupplier(s);
                  setOpen(true);
                }}
                onDelete={() => p.onRemove('tireSuppliers', s.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de Criação / Edição de Caminhão, Motorista, Cliente ou Fornecedor */}
      {open && (
        <Modal
          title={
            editingTruck
              ? `Editar Caminhão (${editingTruck.plate})`
              : editingDriver
              ? `Editar Motorista (${editingDriver.name})`
              : editingCustomer
              ? `Editar Cliente (${editingCustomer.name})`
              : editingSupplier
              ? `Editar Fornecedor (${editingSupplier.name})`
              : current.newLabel
          }
          onClose={close}
        >
          {tab === 'trucks' && (
            <TruckForm
              trucks={p.trucks}
              initial={editingTruck}
              onCancel={close}
              onSave={async (t) => {
                if (editingTruck) {
                  const saved = await p.onUpdateTruck(editingTruck.id, t);
                  if (saved) {
                    showSuccess(`Caminhão ${t.plate} atualizado!`);
                    close();
                  }
                } else {
                  const saved = await p.onAddTruck(t);
                  if (saved) {
                    showSuccess(`Caminhão ${t.plate} adicionado à frota!`);
                    close();
                  }
                }
              }}
            />
          )}

          {tab === 'drivers' && (
            <DriverForm
              drivers={p.drivers}
              trucks={p.trucks}
              initial={editingDriver}
              existingAccount={
                editingDriver
                  ? accounts.find((a) => a.driverId === editingDriver.id) ?? null
                  : null
              }
              onCancel={close}
              onSave={async (d, creds) => {
                let savedDriver: Driver | null = null;
                if (editingDriver) {
                  savedDriver = await p.onUpdateDriver(editingDriver.id, d);
                } else {
                  savedDriver = await p.onAddDriver(d);
                }
                if (!savedDriver) return;

                if (creds && creds.login) {
                  const existingAcc = accounts.find((a) => a.driverId === savedDriver!.id);
                  const url = existingAcc
                    ? `/api/admin/users/${existingAcc.id}`
                    : '/api/admin/users';
                  const method = existingAcc ? 'PATCH' : 'POST';
                  const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      login: creds.login,
                      ...(creds.password ? { password: creds.password } : {}),
                      name: savedDriver.name,
                      role: 'DRIVER',
                      driverId: savedDriver.id,
                      truckId: creds.truckId,
                    }),
                  });
                  if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.error || 'Erro ao salvar login do motorista.');
                  }
                  await loadAccounts();
                }

                showSuccess(
                  editingDriver
                    ? `Dados de ${savedDriver.name} atualizados!`
                    : `Motorista ${savedDriver.name} cadastrado com sucesso!`
                );
                close();
              }}
            />
          )}

          {tab === 'customers' && (
            <PartyForm<Customer>
              kind="customer"
              existing={p.customers}
              initial={editingCustomer}
              onCancel={close}
              onSave={async (c) => {
                const saved = editingCustomer
                  ? await p.onUpdateCustomer(editingCustomer.id, c)
                  : await p.onAddCustomer(c);
                if (saved) {
                  showSuccess('Cliente salvo com sucesso!');
                  close();
                }
              }}
            />
          )}

          {tab === 'tireSuppliers' && (
            <PartyForm<TireSupplier>
              kind="supplier"
              existing={p.tireSuppliers}
              initial={editingSupplier}
              onCancel={close}
              onSave={async (s) => {
                const saved = editingSupplier
                  ? await p.onUpdateSupplier(editingSupplier.id, s)
                  : await p.onAddSupplier(s);
                if (saved) {
                  showSuccess('Fornecedor salvo com sucesso!');
                  close();
                }
              }}
            />
          )}
        </Modal>
      )}

      {/* Modal de Criar / Trocar Senha do App */}
      {accessModal.open && (
        <UserAccessModal
          initialUser={accessModal.user}
          presetDriver={accessModal.driver}
          drivers={p.drivers}
          trucks={p.trucks}
          onClose={() => setAccessModal({ open: false })}
          onSaved={() => {
            showSuccess('Login e senha salvos com sucesso!');
            loadAccounts();
          }}
        />
      )}
    </div>
  );
};
