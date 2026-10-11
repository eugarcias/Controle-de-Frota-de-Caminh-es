'use client';

import React, { useMemo, useState } from 'react';
import { Navigation, ArrowRight, Plus, Package, Route } from 'lucide-react';
import { FreightTrip, Truck, Driver, Customer, TripStatus } from '@/types';
import {
  Field,
  Modal,
  EmptyState,
  Badge,
  inputCls,
  primaryBtn,
  secondaryBtn,
  formatBRL,
  formatDate,
  newId,
} from '@/components/ui';

interface FreightTripsViewProps {
  trips: FreightTrip[];
  trucks: Truck[];
  drivers: Driver[];
  customers: Customer[];
  /** Consumo médio da frota (km/L) e último preço do diesel, usados na estimativa de lucro */
  estKmL: number;
  estDieselPrice: number;
  onAdd: (trip: FreightTrip) => void;
  onUpdate: (id: string, patch: Partial<FreightTrip>) => void;
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
}) => {
  const [selectedTruck, setSelectedTruck] = useState<string>('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      startDate: new Date().toISOString().slice(0, 10),
      paymentTerms: customers[0] ? `${customers[0].paymentTermsDays} dias` : '',
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.customerId);
    const truck = trucks.find((t) => t.id === form.truckId);
    if (!customer || !truck) return;

    const km = Number(form.distanceKm);
    const trip: FreightTrip = {
      id: newId(),
      truckId: form.truckId,
      driverId: form.driverId,
      customerId: customer.id,
      customerName: customer.name,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
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

  return (
    <div className="space-y-6">
      {/* Header com Filtros e botão */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-sky-600" />
            Gestão de Fretes e Viagens
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rotas, carga, distância, valor do frete e lucratividade apurada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filtrar por caminhão"
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            className="text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="ALL">Todos os caminhões ({trucks.length})</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model}
              </option>
            ))}
          </select>
          <button type="button" onClick={openModal} className={primaryBtn}>
            <Plus className="w-5 h-5" />
            Novo Frete
          </button>
        </div>
      </div>

      {filteredTrips.length === 0 && <EmptyState text="Nenhum frete encontrado para este filtro." />}

      {/* Lista de Fretes */}
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

          return (
            <div
              key={trip.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-900 text-sky-300 text-xs font-bold px-2.5 py-0.5 rounded">
                      {getTruckPlate(trip.truckId)}
                    </span>
                    <span className="text-xs font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                      {trip.customerName}
                    </span>
                    <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
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

                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Frete bruto contratado</span>
                  <span className="text-xl font-bold text-sky-700">{formatBRL(trip.grossFreightValue)}</span>
                  {kmDistance > 0 && (
                    <span className="text-[11px] text-slate-500 block">
                      {formatBRL(trip.grossFreightValue / kmDistance)} / km
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
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
                  <span className="font-semibold text-amber-700">{formatBRL(trip.tollCosts)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Chapa / Outras</span>
                  <span className="font-semibold text-slate-800">
                    {formatBRL(trip.loadingUnloadingCosts + trip.otherExpenses)}
                  </span>
                </div>
              </div>

              {trip.notes && <p className="text-xs text-slate-500 italic">Obs.: {trip.notes}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>
                    Custos deduzidos: <strong className="text-slate-800">{formatBRL(costsTotal)}</strong>
                  </span>
                  {trip.paymentTerms && <span>Pagamento: {trip.paymentTerms}</span>}
                  <select
                    aria-label="Alterar status do frete"
                    value={status}
                    onChange={(e) => onUpdate(trip.id, { status: e.target.value as TripStatus })}
                    className="text-xs p-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {(Object.keys(statusLabel) as TripStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-sky-100 text-sky-800 px-2 py-1 rounded font-bold">
                    Margem: {margin}%
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Lucro líquido apurado</span>
                    <span className="text-base font-bold text-slate-900">
                      {formatBRL(trip.netFreightValue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal
          title="Novo Frete"
          subtitle="Cadastre a rota, a carga e os valores. O lucro é estimado automaticamente."
          onClose={() => setOpen(false)}
        >
          {customers.length === 0 || trucks.length === 0 || drivers.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              Antes de lançar um frete, cadastre ao menos um cliente, um veículo e um motorista na aba
              &quot;Cadastros&quot;.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <legend className="text-xs font-bold text-sky-700 uppercase mb-2">Quem e com o quê</legend>
                <Field label="Cliente">
                  <select
                    required
                    className={inputCls}
                    value={form.customerId}
                    onChange={(e) => {
                      const c = customers.find((x) => x.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        customerId: e.target.value,
                        paymentTerms: c ? `${c.paymentTermsDays} dias` : f.paymentTerms,
                      }));
                    }}
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Caminhão">
                  <select required className={inputCls} value={form.truckId} onChange={set('truckId')}>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate} - {t.model}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Motorista">
                  <select required className={inputCls} value={form.driverId} onChange={set('driverId')}>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </fieldset>

              <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <legend className="text-xs font-bold text-sky-700 uppercase mb-2">Rota</legend>
                <Field label="Origem">
                  <input required className={inputCls} value={form.origin} onChange={set('origin')} placeholder="Ex: Campinas - SP" />
                </Field>
                <Field label="Destino">
                  <input required className={inputCls} value={form.destination} onChange={set('destination')} placeholder="Ex: Belo Horizonte - MG" />
                </Field>
                <Field label="Distância (km)">
                  <input required type="number" min="1" className={inputCls} value={form.distanceKm} onChange={set('distanceKm')} placeholder="Ex: 600" />
                </Field>
                <Field label="Data de saída">
                  <input required type="date" className={inputCls} value={form.startDate} onChange={set('startDate')} />
                </Field>
                <Field label="Previsão de entrega">
                  <input type="date" className={inputCls} value={form.endDate} onChange={set('endDate')} />
                </Field>
              </fieldset>

              <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <legend className="text-xs font-bold text-sky-700 uppercase mb-2">Carga</legend>
                <Field label="O que será carregado" className="sm:col-span-2">
                  <input required className={inputCls} value={form.cargoDescription} onChange={set('cargoDescription')} placeholder="Ex: Soja a granel, bebidas em paletes..." />
                </Field>
                <Field label="Peso (kg)">
                  <input type="number" min="0" className={inputCls} value={form.cargoWeightKg} onChange={set('cargoWeightKg')} placeholder="Ex: 27000" />
                </Field>
              </fieldset>

              <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <legend className="text-xs font-bold text-sky-700 uppercase mb-2">Valores (R$)</legend>
                <Field label="Valor do frete">
                  <input required type="number" min="1" step="0.01" className={inputCls} value={form.grossFreightValue} onChange={set('grossFreightValue')} />
                </Field>
                <Field label="Pedágios">
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.tollCosts} onChange={set('tollCosts')} />
                </Field>
                <Field label="Chapa / ajudante">
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.loadingUnloadingCosts} onChange={set('loadingUnloadingCosts')} />
                </Field>
                <Field label="Outras despesas">
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.otherExpenses} onChange={set('otherExpenses')} />
                </Field>
                <Field label="Condição de pagamento" className="col-span-2">
                  <input className={inputCls} value={form.paymentTerms} onChange={set('paymentTerms')} placeholder="Ex: 30 dias, à vista" />
                </Field>
                <Field label="Observações" className="col-span-2">
                  <input className={inputCls} value={form.notes} onChange={set('notes')} placeholder="Ex: carga frágil, agendar descarga" />
                </Field>
              </fieldset>

              <div className="bg-slate-900 text-white rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Diesel estimado</span>
                  <strong className="text-sm">{formatBRL(preview.fuel)}</strong>
                  <span className="text-slate-500 block">{estKmL} km/L • R$ {estDieselPrice.toFixed(2)}/L</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Frete por km</span>
                  <strong className="text-sm">{formatBRL(preview.perKm)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Lucro estimado</span>
                  <strong className={`text-sm ${preview.net < 0 ? 'text-rose-400' : 'text-sky-300'}`}>
                    {formatBRL(preview.net)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Margem</span>
                  <strong className={`text-sm ${preview.margin < 0 ? 'text-rose-400' : 'text-sky-300'}`}>
                    {preview.margin.toFixed(1)}%
                  </strong>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={primaryBtn}>
                  Salvar frete
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
