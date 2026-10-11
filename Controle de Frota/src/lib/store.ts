'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Truck,
  Driver,
  Customer,
  TireSupplier,
  FuelLog,
  MaintenanceLog,
  FreightTrip,
  CargoSchedule,
} from '@/types';

export interface FleetData {
  trucks: Truck[];
  drivers: Driver[];
  customers: Customer[];
  tireSuppliers: TireSupplier[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  trips: FreightTrip[];
  schedules: CargoSchedule[];
}

const emptyData: FleetData = {
  trucks: [],
  drivers: [],
  customers: [],
  tireSuppliers: [],
  fuelLogs: [],
  maintenanceLogs: [],
  trips: [],
  schedules: [],
};

const PATHS: Record<keyof FleetData, string> = {
  trucks: '/api/trucks',
  drivers: '/api/drivers',
  customers: '/api/customers',
  tireSuppliers: '/api/tire-suppliers',
  fuelLogs: '/api/fuel-logs',
  maintenanceLogs: '/api/maintenance-logs',
  trips: '/api/freight-trips',
  schedules: '/api/cargo-schedules',
};

type ItemOf<K extends keyof FleetData> = FleetData[K][number];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status} ao falar com o servidor.`);
  return body as T;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado.');

/**
 * Estado central da aplicação, sincronizado com o PostgreSQL pelas rotas /api.
 * Cada alteração é gravada no banco primeiro; a tela só reflete o que o banco confirmou.
 */
export function useFleetStore() {
  const [data, setData] = useState<FleetData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fleet = await api<FleetData>('/api/fleet');
      setData({ ...emptyData, ...fleet });
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addItem = useCallback(async <K extends keyof FleetData>(key: K, item: ItemOf<K>) => {
    try {
      const created = await api<ItemOf<K>>(PATHS[key], { method: 'POST', body: JSON.stringify(item) });
      setData((d) => ({ ...d, [key]: [...(d[key] as unknown[]), created] }));
      setError(null);
      return created;
    } catch (e) {
      setError(messageOf(e));
      return null;
    }
  }, []);

  const updateItem = useCallback(
    async <K extends keyof FleetData>(key: K, id: string, patch: Partial<ItemOf<K>>) => {
      try {
        const updated = await api<ItemOf<K>>(`${PATHS[key]}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        setData((d) => ({
          ...d,
          [key]: (d[key] as { id: string }[]).map((it) => (it.id === id ? { ...it, ...updated } : it)),
        }));
        setError(null);
        return updated;
      } catch (e) {
        setError(messageOf(e));
        return null;
      }
    },
    []
  );

  const removeItem = useCallback(async <K extends keyof FleetData>(key: K, id: string) => {
    try {
      await api(`${PATHS[key]}/${id}`, { method: 'DELETE' });
      setData((d) => ({ ...d, [key]: (d[key] as { id: string }[]).filter((it) => it.id !== id) }));
      setError(null);
      return true;
    } catch (e) {
      setError(messageOf(e));
      return false;
    }
  }, []);

  /** Registra abastecimento; o servidor também atualiza o hodômetro do caminhão. */
  const addFuelLog = useCallback(
    async (log: FuelLog) => {
      const created = await addItem('fuelLogs', log);
      if (created) {
        setData((d) => ({
          ...d,
          trucks: d.trucks.map((t) =>
            t.id === created.truckId && created.odometer > t.currentOdometer
              ? { ...t, currentOdometer: created.odometer }
              : t
          ),
        }));
      }
      return created;
    },
    [addItem]
  );

  const clearError = useCallback(() => setError(null), []);

  return { data, loading, error, clearError, reload, addItem, updateItem, removeItem, addFuelLog };
}

export type FleetStore = ReturnType<typeof useFleetStore>;
