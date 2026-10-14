'use client';

import React, { useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { DashboardView } from '@/components/DashboardView';
import { QuickEntryView } from '@/components/QuickEntryView';
import { FreightTripsView } from '@/components/FreightTripsView';
import { MaintenanceView } from '@/components/MaintenanceView';
import { CargoScheduleView } from '@/components/CargoScheduleView';
import { RegistrationsView } from '@/components/RegistrationsView';
import { computeDashboardMetrics } from '@/mock-data';
import { useFleetStore } from '@/lib/store';
import { newId } from '@/components/ui';
import { CargoSchedule, FreightTrip } from '@/types';
import { splitDestination } from '@/lib/geo';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { data, loading, error, clearError, reload, addItem, updateItem, removeItem, addFuelLog } =
    useFleetStore();

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        trucks: data.trucks,
        fuelLogs: data.fuelLogs,
        maintenanceLogs: data.maintenanceLogs,
        trips: data.trips.filter((t) => t.status !== 'CANCELADO'),
      }),
    [data.trucks, data.fuelLogs, data.maintenanceLogs, data.trips]
  );

  const lastDieselPrice = metrics.dieselPriceTrend.at(-1)?.price ?? 6;

  // Transforma uma carga agendada em frete efetivo (viagem em andamento)
  const convertScheduleToTrip = async (s: CargoSchedule) => {
    const truck = data.trucks.find((t) => t.id === s.truckId);
    const customer = data.customers.find((c) => c.id === s.customerId);
    if (!truck || !s.driverId) return;

    const parsedDest = splitDestination(s.destination);
    const destCity = parsedDest?.city ?? s.destination;
    const destState = parsedDest?.state ?? 'SP';

    const fuel = (s.distanceKm / (metrics.fleetAverageKmL || 2.1)) * lastDieselPrice;
    const trip: FreightTrip = {
      id: newId(),
      truckId: truck.id,
      driverId: s.driverId,
      customerId: s.customerId,
      customerName: customer?.name ?? 'Cliente',
      origin: s.origin,
      destination: s.destination,
      destinationCity: destCity,
      destinationState: destState,
      startDate: s.pickupDate,
      endDate: s.deliveryDate ?? null,
      initialKm: truck.currentOdometer,
      finalKm: null,
      distanceKm: s.distanceKm,
      cargoDescription: s.cargoDescription,
      cargoWeightKg: s.cargoWeightKg,
      grossFreightValue: s.freightValue,
      tollCosts: 0,
      loadingUnloadingCosts: 0,
      otherExpenses: 0,
      netFreightValue: Number((s.freightValue - fuel).toFixed(2)),
      paymentTerms: customer ? `${customer.paymentTermsDays} dias` : undefined,
      notes: s.notes,
      status: 'EM_VIAGEM',
    };
    const created = await addItem('trips', trip);
    if (!created) return;
    await updateItem('schedules', s.id, { status: 'EM_TRANSITO' });
    setActiveTab('trips');
  };

  if (loading && data.trucks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-emerald-400 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Carregando dados da frota...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {error && (
        <div role="alert" className="bg-rose-50 border-b border-rose-200 text-rose-900 text-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong>Aviso:</strong> {error}
            </span>
            <span className="flex gap-2">
              <button onClick={reload} className="font-bold underline">
                Tentar novamente
              </button>
              <button onClick={clearError} className="font-bold underline">
                Fechar
              </button>
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:auto">
        {activeTab === 'dashboard' && (
          <DashboardView
            trucks={data.trucks}
            drivers={data.drivers}
            fuelLogs={data.fuelLogs}
            maintenanceLogs={data.maintenanceLogs}
            trips={data.trips}
            onOpenQuickEntry={() => setActiveTab('quick-entry')}
          />
        )}

        {activeTab === 'quick-entry' && (
          <QuickEntryView
            trucks={data.trucks}
            drivers={data.drivers}
            fuelLogs={data.fuelLogs}
            onSubmitLog={addFuelLog}
          />
        )}

        {activeTab === 'trips' && (
          <FreightTripsView
            trips={data.trips}
            trucks={data.trucks}
            drivers={data.drivers}
            customers={data.customers}
            estKmL={metrics.fleetAverageKmL || 2.1}
            estDieselPrice={lastDieselPrice}
            onAdd={(t) => addItem('trips', t)}
            onUpdate={(id, patch) => updateItem('trips', id, patch)}
            onAddCustomer={(c) => addItem('customers', c)}
            onAddDriver={(d) => addItem('drivers', d)}
            onAddTruck={(t) => addItem('trucks', t)}
          />
        )}

        {activeTab === 'schedule' && (
          <CargoScheduleView
            schedules={data.schedules}
            customers={data.customers}
            trucks={data.trucks}
            drivers={data.drivers}
            onAdd={(s) => addItem('schedules', s)}
            onUpdate={(id, patch) => updateItem('schedules', id, patch)}
            onRemove={(id) => removeItem('schedules', id)}
            onConvert={convertScheduleToTrip}
          />
        )}

        {activeTab === 'maintenance' && (
          <MaintenanceView maintenances={data.maintenanceLogs} trucks={data.trucks} />
        )}

        {activeTab === 'registrations' && (
          <RegistrationsView
            trucks={data.trucks}
            drivers={data.drivers}
            customers={data.customers}
            tireSuppliers={data.tireSuppliers}
            onAddTruck={(t) => addItem('trucks', t)}
            onAddDriver={(d) => addItem('drivers', d)}
            onAddCustomer={(c) => addItem('customers', c)}
            onAddSupplier={(s) => addItem('tireSuppliers', s)}
            onRemove={(key, id) => removeItem(key, id)}
          />
        )}
      </main>

      <footer className="bg-slate-950 text-slate-400 border-t-2 border-emerald-500 py-4 text-center text-xs">
        <span className="text-emerald-400 font-bold">VSM Garcia</span> • Gestão de Frota • &copy; 2026
      </footer>
    </div>
  );
}
