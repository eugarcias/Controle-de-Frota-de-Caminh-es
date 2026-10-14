'use client';

import React, { useMemo, useState } from 'react';
import {
  Navigation,
  ArrowRight,
  Plus,
  Package,
  Route,
  UserPlus,
  Truck as TruckIcon,
  Phone,
  CheckCircle2,
  AlertCircle,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { FreightTrip, Truck, Driver, Customer, TripStatus } from '@/types';
import {
  Field,
  Modal,
  EmptyState,
  Badge,
  inputCls,
  primaryBtn,
  secondaryBtn,
  cardCls,
  formatBRL,
  formatDate,
  newId,
} from '@/components/ui';
import { Combobox } from '@/components/ui/combobox';
import { BR_STATES, splitDestination, routeLabel } from '@/lib/geo';

interface FreightTripsViewProps {
  trips: FreightTrip[];
  trucks: Truck[];
  drivers: Driver[];
  customers: Customer[];
  /** Consumo médio da frota (km/L) e último preço do diesel */
  estKmL: number;
  estDieselPrice: number;
  onAdd: (trip: FreightTrip) => void;
  onUpdate: (id: string, patch: Partial<FreightTrip>) => void;
  onAddCustomer?: (customer: Customer) => Promise<any> | void;
  onAddDriver?: (driver: Driver) => Promise<any> | void;
  onAddTruck?: (truck: Truck) => Promise<any> | void;
}

const statusLabel: Record<TripStatus, string> = {
  PLANEJADO: 'Planejado',
  EM_VIAGEM: 'Em viagem',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};
const statusTone: Record<TripStatus, 'slate' | 'green' | 'amber' | 'red'> = {
  PLANEJADO: 'amber',
  EM_VIAGEM: 'green',
  CONCLUIDO: 'slate',
  CANCELADO: 'red',
};

const emptyForm = {
  customerId: '',
  truckId: '',
  driverId: '',
  origin: '',
  destinationCity: '',
  destinationState: 'SP',
  destination: '',
  distanceKm: '',
  cargoDescription: '',
  cargoWeightKg: '',
  grossFreightValue: '',
  tollCosts: '',
  loadingUnloadingCosts: '',
  otherExpenses: '',
  startDate: '',
  endDate: '',
  paymentTerms: '',
  notes: '',
};

export const FreightTripsView: React.FC<FreightTripsViewProps> = ({
  trips,
  trucks,
  drivers,
  customers,
  estKmL,
  estDieselPrice,
  onAdd,
  onUpdate,
  onAddCustomer,
  onAddDriver,
  onAddTruck,
}) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Sub-modais de criação rápida (Inline Creation)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');

  const [quickTruckOpen, setQuickTruckOpen] = useState(false);
  const [quickTruckPlate, setQuickTruckPlate] = useState('');

  const [quickDriverOpen, setQuickDriverOpen] = useState(false);
  const [quickDriverName, setQuickDriverName] = useState('');
  const [quickDriverPhone, setQuickDriverPhone] = useState('');

  const filteredTrips = (selectedTruck === 'ALL'
    ? trips
    : trips.filter((t) => t.truckId === selectedTruck)
  )
    .slice()
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const getTruckPlate = (id: string) => trucks.find((t) => t.id === id)?.plate || 'Caminhão';
  const getDriverName = (id: string) => drivers.find((d) => d.id === id)?.name || 'Motorista';

  const set = (k: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Pré-visualização financeira em tempo real
  const preview = useMemo(() => {
    const km = Number(form.distanceKm) || 0;
    const gross = Number(form.grossFreightValue) || 0;
    const fuel = estKmL > 0 ? (km / estKmL) * estDieselPrice : 0;
    const costs =
      fuel +
      (Number(form.tollCosts) || 0) +
      (Number(form.loadingUnloadingCosts) || 0) +
      (Number(form.otherExpenses) || 0);
    const net = gross - costs;
    return {
      fuel,
      net,
      margin: gross > 0 ? (net / gross) * 100 : 0,
      perKm: km > 0 ? gross / km : 0,
    };
  }, [form, estKmL, estDieselPrice]);

  const openModal = () => {
    setForm({
      ...emptyForm,
      truckId: trucks[0]?.id ?? '',
      driverId: drivers[0]?.id ?? '',
      customerId: customers[0]?.id ?? '',
      destinationState: 'SP',
      startDate: new Date().toISOString().slice(0, 10),
      paymentTerms: customers[0] ? `${customers[0].paymentTermsDays} dias` : '',
    });
    setOpen(true);
  };

  // Handlers para salvamento de cadastro rápido
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerName.trim() || !quickCustomerPhone.trim()) return;

    const newCust: Customer = {
      id: newId(),
      name: quickCustomerName.trim(),
      phone: quickCustomerPhone.trim(),
      cnpj: null,
      contactName: quickCustomerName.trim(),
      email: '',
      city: '',
      state: '',
      paymentTermsDays: 30,
    };

    if (onAddCustomer) {
      await onAddCustomer(newCust);
    }
    setForm((f) => ({ ...f, customerId: newCust.id }));
    setQuickCustomerName('');
    setQuickCustomerPhone('');
    setQuickCustomerOpen(false);
  };

  const handleSaveQuickTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = quickTruckPlate.trim().toUpperCase();
    if (!cleanPlate) return;

    const newTrk: Truck = {
      id: newId(),
      plate: cleanPlate,
      model: 'Caminhão Cadastrado Rápido',
      brand: 'Diversas',
      year: new Date().getFullYear(),
      tankCapacityLiters: 600,
      initialOdometer: 0,
      currentOdometer: 0,
      status: 'ATIVO',
      createdAt: new Date().toISOString(),
    };

    if (onAddTruck) {
      await onAddTruck(newTrk);
    }
    setForm((f) => ({ ...f, truckId: newTrk.id }));
    setQuickTruckPlate('');
    setQuickTruckOpen(false);
  };

  const handleSaveQuickDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDriverName.trim() || !quickDriverPhone.trim()) return;

    const newDrv: Driver = {
      id: newId(),
      name: quickDriverName.trim(),
      phone: quickDriverPhone.trim(),
      cnhNumber: null,
      cnhCategory: 'E',
      status: 'ATIVO',
    };

    if (onAddDriver) {
      await onAddDriver(newDrv);
    }
    setForm((f) => ({ ...f, driverId: newDrv.id }));
    setQuickDriverName('');
    setQuickDriverPhone('');
    setQuickDriverOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.customerId);
    const truck = trucks.find((t) => t.id === form.truckId);
    if (!customer || !truck) return;

    const city = form.destinationCity.trim();
    const state = form.destinationState.trim().toUpperCase();
    if (!city || !state) return;

    const fullDestination = `${city} - ${state}`;
    const km = Number(form.distanceKm);

    const trip: FreightTrip = {
      id: newId(),
      truckId: form.truckId,
      driverId: form.driverId,
      customerId: customer.id,
      customerName: customer.name,
      origin: form.origin.trim(),
      destination: fullDestination,
      destinationCity: city,
      destinationState: state,
      startDate: `${form.startDate}T00:00:00.000Z`,
      endDate: form.endDate ? `${form.endDate}T00:00:00.000Z` : null,
      initialKm: truck.currentOdometer,
      finalKm: null,
      distanceKm: km,
      cargoDescription: form.cargoDescription.trim(),
      cargoWeightKg: Number(form.cargoWeightKg) || 0,
      grossFreightValue: Number(form.grossFreightValue),
      tollCosts: Number(form.tollCosts) || 0,
      loadingUnloadingCosts: Number(form.loadingUnloadingCosts) || 0,
      otherExpenses: Number(form.otherExpenses) || 0,
      netFreightValue: Number(preview.net.toFixed(2)),
      paymentTerms: form.paymentTerms.trim(),
      notes: form.notes.trim(),
      status: 'PLANEJADO',
    };
    onAdd(trip);
    setOpen(false);
  };

  // Opções para Comboboxes
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.phone || undefined,
  }));

  const truckOptions = trucks.map((t) => ({
    value: t.id,
    label: t.plate,
    hint: `${t.model} • ${t.currentOdometer.toLocaleString()} km`,
  }));

  const driverOptions = drivers.map((d) => ({
    value: d.id,
    label: d.name,
    hint: d.phone || undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header com Filtros e botão */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-600" />
            Gestão de Fretes e Viagens
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mapeamento de rotas, rentabilidade por destino e custos operacionais por frete.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-3">
          <select
            aria-label="Filtrar por caminhão"
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            className="text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="ALL">Todos os caminhões ({trucks.length})</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model}
              </option>
            ))}
          </select>
          <button type="button" onClick={openModal} className={primaryBtn}>
            <Plus className="w-4 h-4" />
            Novo Frete
          </button>
        </div>
      </div>

      {filteredTrips.length === 0 && <EmptyState text="Nenhum frete encontrado para este filtro." />}

      {/* Lista de Fretes em Cards Mobile-First */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTrips.map((trip) => {
          const kmDistance =
            trip.distanceKm ?? (trip.finalKm && trip.initialKm ? trip.finalKm - trip.initialKm : 0);
          const costsTotal = trip.tollCosts + trip.loadingUnloadingCosts + trip.otherExpenses;
          const margin =
            trip.grossFreightValue > 0
              ? ((trip.netFreightValue / trip.grossFreightValue) * 100).toFixed(1)
              : '0';
          const status = trip.status ?? 'CONCLUIDO';
          const isPositive = trip.netFreightValue >= 0;

          return (
            <div
              key={trip.id}
              className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 hover:ring-sky-400 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-900 text-sky-300 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                      {getTruckPlate(trip.truckId)}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {trip.customerName}
                    </span>
                    <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
                    {trip.destinationState && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md">
                        <MapPin className="w-3 h-3 text-sky-600" />
                        {trip.destinationCity ? `${trip.destinationCity}/${trip.destinationState}` : trip.destinationState}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    <span>{trip.origin}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span>{trip.destination}</span>
                  </div>
                  {trip.cargoDescription && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-sky-600" />
                      {trip.cargoDescription}
                      {trip.cargoWeightKg ? ` • ${trip.cargoWeightKg.toLocaleString('pt-BR')} kg` : ''}
                    </div>
                  )}
                </div>

                <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                  <span className="text-xs text-slate-500 block">Frete bruto</span>
                  <span className="text-xl font-bold text-slate-900">{formatBRL(trip.grossFreightValue)}</span>
                  {kmDistance > 0 && (
                    <span className="text-[11px] text-slate-500 block">
                      {formatBRL(trip.grossFreightValue / kmDistance)} / km
                    </span>
                  )}
                </div>
              </div>

              {/* Grid de detalhes com suporte a Mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Motorista</span>
                  <span className="font-semibold text-slate-800">{getDriverName(trip.driverId)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Distância</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-sky-600" />
                    {kmDistance > 0 ? `${kmDistance.toLocaleString('pt-BR')} km` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Período</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Pedágios</span>
                  <span className="font-semibold text-rose-600">{formatBRL(trip.tollCosts)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Chapa / Outros</span>
                  <span className="font-semibold text-rose-600">
                    {formatBRL(trip.loadingUnloadingCosts + trip.otherExpenses)}
                  </span>
                </div>
              </div>

              {trip.notes && <p className="text-xs text-slate-500 italic">Obs.: {trip.notes}</p>}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>
                    Custos deduzidos: <strong className="text-rose-600">{formatBRL(costsTotal)}</strong>
                  </span>
                  {trip.paymentTerms && <span>Pagamento: {trip.paymentTerms}</span>}
                  <select
                    aria-label="Alterar status do frete"
                    value={status}
                    onChange={(e) => onUpdate(trip.id, { status: e.target.value as TripStatus })}
                    className="text-xs p-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    {(Object.keys(statusLabel) as TripStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                      isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    Margem: {margin}%
                  </span>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Lucro líquido</span>
                    <span
                      className={`text-base font-bold ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatBRL(trip.netFreightValue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Principal de Lançamento de Frete */}
      {open && (
        <Modal
          title="Novo Frete"
          subtitle="Preencha cliente, rota e valores para análise de lucro em tempo real."
          onClose={() => setOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Seção 1: Cliente, Veículo e Motorista com Combobox + Criação Inline */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <legend className="text-xs font-bold text-sky-700 uppercase mb-2">
                Quem e com o quê
              </legend>

              <Field label="Cliente">
                <Combobox
                  options={customerOptions}
                  value={form.customerId}
                  onChange={(v) => {
                    const c = customers.find((x) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      customerId: v,
                      paymentTerms: c ? `${c.paymentTermsDays} dias` : f.paymentTerms,
                    }));
                  }}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar por nome..."
                  createLabel="+ Novo Cliente"
                  onCreate={(search) => {
                    setQuickCustomerName(search);
                    setQuickCustomerOpen(true);
                  }}
                />
              </Field>

              <Field label="Veículo (Caminhão)">
                <Combobox
                  options={truckOptions}
                  value={form.truckId}
                  onChange={(v) => setForm((f) => ({ ...f, truckId: v }))}
                  placeholder="Selecione o caminhão"
                  searchPlaceholder="Buscar por placa..."
                  createLabel="+ Novo Veículo"
                  onCreate={(search) => {
                    setQuickTruckPlate(search);
                    setQuickTruckOpen(true);
                  }}
                />
              </Field>

              <Field label="Motorista">
                <Combobox
                  options={driverOptions}
                  value={form.driverId}
                  onChange={(v) => setForm((f) => ({ ...f, driverId: v }))}
                  placeholder="Selecione o motorista"
                  searchPlaceholder="Buscar por nome..."
                  createLabel="+ Novo Motorista"
                  onCreate={(search) => {
                    setQuickDriverName(search);
                    setQuickDriverOpen(true);
                  }}
                />
              </Field>
            </fieldset>

            {/* Seção 2: Rota com Cidade e UF de Destino Obrigatórias */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <legend className="text-xs font-bold text-sky-700 uppercase mb-2">
                Rota & Destino (Obrigatórios para Mapeamento de Lucro)
              </legend>

              <Field label="Origem">
                <input
                  required
                  className={inputCls}
                  value={form.origin}
                  onChange={set('origin')}
                  placeholder="Ex: Campinas - SP"
                />
              </Field>

              <Field label="Cidade de Destino *">
                <input
                  required
                  className={inputCls}
                  value={form.destinationCity}
                  onChange={set('destinationCity')}
                  placeholder="Ex: Belo Horizonte"
                />
              </Field>

              <Field label="UF de Destino *">
                <select
                  required
                  aria-label="UF de Destino"
                  className={inputCls}
                  value={form.destinationState}
                  onChange={set('destinationState')}
                >
                  {BR_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Distância (km) *">
                <input
                  required
                  type="number"
                  min="1"
                  className={inputCls}
                  value={form.distanceKm}
                  onChange={set('distanceKm')}
                  placeholder="Ex: 600"
                />
              </Field>

              <Field label="Data de Saída *">
                <input
                  required
                  type="date"
                  className={inputCls}
                  value={form.startDate}
                  onChange={set('startDate')}
                />
              </Field>

              <Field label="Previsão de Entrega">
                <input
                  type="date"
                  className={inputCls}
                  value={form.endDate}
                  onChange={set('endDate')}
                />
              </Field>
            </fieldset>

            {/* Seção 3: Carga */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <legend className="text-xs font-bold text-sky-700 uppercase mb-2">Carga</legend>
              <Field label="O que será carregado" className="sm:col-span-2">
                <input
                  required
                  className={inputCls}
                  value={form.cargoDescription}
                  onChange={set('cargoDescription')}
                  placeholder="Ex: Soja a granel, Bobinas de aço, Bebidas..."
                />
              </Field>
              <Field label="Peso da Carga (kg)">
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={form.cargoWeightKg}
                  onChange={set('cargoWeightKg')}
                  placeholder="Ex: 27000"
                />
              </Field>
            </fieldset>

            {/* Seção 4: Valores Financeiros */}
            <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <legend className="text-xs font-bold text-sky-700 uppercase mb-2">
                Valores Financeiros (R$)
              </legend>
              <Field label="Valor do Frete (R$) *">
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  className={inputCls}
                  value={form.grossFreightValue}
                  onChange={set('grossFreightValue')}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Pedágios">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.tollCosts}
                  onChange={set('tollCosts')}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Chapa / Ajudante">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.loadingUnloadingCosts}
                  onChange={set('loadingUnloadingCosts')}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Outras Despesas">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.otherExpenses}
                  onChange={set('otherExpenses')}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Condição de Pagamento" className="col-span-2">
                <input
                  className={inputCls}
                  value={form.paymentTerms}
                  onChange={set('paymentTerms')}
                  placeholder="Ex: 30 dias, 50% adiantado"
                />
              </Field>
              <Field label="Observações" className="col-span-2">
                <input
                  className={inputCls}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Ex: Exige agendamento prévio, descarga rápida"
                />
              </Field>
            </fieldset>

            {/* Simulação em Tempo Real */}
            <div className="bg-slate-900 text-white rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Diesel Estimado</span>
                <strong className="text-sm font-semibold">{formatBRL(preview.fuel)}</strong>
                <span className="text-slate-500 block text-[11px]">
                  {estKmL} km/L • R$ {estDieselPrice.toFixed(2)}/L
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Frete / km</span>
                <strong className="text-sm font-semibold">{formatBRL(preview.perKm)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Lucro Estimado</span>
                <strong
                  className={`text-sm font-bold ${
                    preview.net < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatBRL(preview.net)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Margem Líquida</span>
                <strong
                  className={`text-sm font-bold ${
                    preview.margin < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {preview.margin.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={primaryBtn}>
                Salvar Frete
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Criação Rápida de Cliente (Apenas Nome e Telefone) */}
      {quickCustomerOpen && (
        <Modal
          title="Cadastro Rápido de Cliente"
          subtitle="Preencha apenas o essencial para emitir o frete imediatamente."
          onClose={() => setQuickCustomerOpen(false)}
        >
          <form onSubmit={handleSaveQuickCustomer} className="space-y-4">
            <Field label="Nome / Razão Social *">
              <input
                required
                autoFocus
                className={inputCls}
                value={quickCustomerName}
                onChange={(e) => setQuickCustomerName(e.target.value)}
                placeholder="Ex: Transportadora Santos & Cia"
              />
            </Field>
            <Field label="Telefone / WhatsApp *">
              <input
                required
                type="tel"
                className={inputCls}
                value={quickCustomerPhone}
                onChange={(e) => setQuickCustomerPhone(e.target.value)}
                placeholder="Ex: (11) 98765-4321"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setQuickCustomerOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={primaryBtn}>
                Salvar e Selecionar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Criação Rápida de Veículo (Apenas Placa) */}
      {quickTruckOpen && (
        <Modal
          title="Cadastro Rápido de Veículo"
          subtitle="Apenas a placa é necessária para dar continuidade ao frete."
          onClose={() => setQuickTruckOpen(false)}
        >
          <form onSubmit={handleSaveQuickTruck} className="space-y-4">
            <Field label="Placa do Veículo (Mercosul ou Antiga) *">
              <input
                required
                autoFocus
                className={inputCls}
                value={quickTruckPlate}
                onChange={(e) => setQuickTruckPlate(e.target.value)}
                placeholder="Ex: ABC1D23 ou ABC-1234"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setQuickTruckOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={primaryBtn}>
                Salvar e Selecionar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Criação Rápida de Motorista (Apenas Nome e Telefone) */}
      {quickDriverOpen && (
        <Modal
          title="Cadastro Rápido de Motorista"
          subtitle="Apenas o nome e telefone para contato em viagem."
          onClose={() => setQuickDriverOpen(false)}
        >
          <form onSubmit={handleSaveQuickDriver} className="space-y-4">
            <Field label="Nome Completo do Motorista *">
              <input
                required
                autoFocus
                className={inputCls}
                value={quickDriverName}
                onChange={(e) => setQuickDriverName(e.target.value)}
                placeholder="Ex: João da Silva"
              />
            </Field>
            <Field label="Telefone / Celular *">
              <input
                required
                type="tel"
                className={inputCls}
                value={quickDriverPhone}
                onChange={(e) => setQuickDriverPhone(e.target.value)}
                placeholder="Ex: (19) 99876-5432"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setQuickDriverOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={primaryBtn}>
                Salvar e Selecionar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
