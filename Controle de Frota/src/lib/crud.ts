import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import { prisma } from './prisma';
import { serialize } from './serialize';
import {
  TruckSchema,
  DriverSchema,
  CustomerSchema,
  TireSupplierSchema,
  FuelLogSchema,
  MaintenanceLogSchema,
  FreightTripSchema,
  CargoScheduleSchema,
} from './validations';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ResourceConfig {
  /** Nome do model no Prisma Client */
  model: string;
  /** Chave usada pelo front-end (FleetData) */
  clientKey: string;
  schema: z.ZodObject<any>;
  dateFields?: string[];
  orderBy: Record<string, 'asc' | 'desc'>;
  beforeSave?: (data: any) => any;
  afterCreate?: (row: any) => Promise<void>;
}

export const resources: Record<string, ResourceConfig> = {
  trucks: { model: 'truck', clientKey: 'trucks', schema: TruckSchema, orderBy: { plate: 'asc' } },
  drivers: { model: 'driver', clientKey: 'drivers', schema: DriverSchema, orderBy: { name: 'asc' } },
  customers: { model: 'customer', clientKey: 'customers', schema: CustomerSchema, orderBy: { name: 'asc' } },
  'tire-suppliers': {
    model: 'tireSupplier',
    clientKey: 'tireSuppliers',
    schema: TireSupplierSchema,
    orderBy: { name: 'asc' },
  },
  'fuel-logs': {
    model: 'fuelLog',
    clientKey: 'fuelLogs',
    schema: FuelLogSchema,
    dateFields: ['date'],
    orderBy: { date: 'desc' },
    // Mantém o hodômetro do caminhão sempre no maior valor lançado
    afterCreate: async (row) => {
      await prisma.truck.updateMany({
        where: { id: row.truckId, currentOdometer: { lt: row.odometer } },
        data: { currentOdometer: row.odometer },
      });
    },
  },
  'maintenance-logs': {
    model: 'maintenanceLog',
    clientKey: 'maintenanceLogs',
    schema: MaintenanceLogSchema,
    dateFields: ['date'],
    orderBy: { date: 'desc' },
    afterCreate: async (row) => {
      if (row.type === 'CORRETIVA' && row.category === 'MOTOR') {
        await prisma.truck.update({ where: { id: row.truckId }, data: { status: 'MANUTENCAO' } });
      }
    },
  },
  'freight-trips': {
    model: 'freightTrip',
    clientKey: 'trips',
    schema: FreightTripSchema,
    dateFields: ['startDate', 'endDate'],
    orderBy: { startDate: 'desc' },
    beforeSave: (d) => {
      if (d.netFreightValue === undefined && d.grossFreightValue !== undefined) {
        d.netFreightValue =
          d.grossFreightValue - (d.tollCosts ?? 0) - (d.loadingUnloadingCosts ?? 0) - (d.otherExpenses ?? 0);
      }
      return d;
    },
  },
  'cargo-schedules': {
    model: 'cargoSchedule',
    clientKey: 'schedules',
    schema: CargoScheduleSchema,
    dateFields: ['pickupDate', 'deliveryDate'],
    orderBy: { pickupDate: 'asc' },
  },
};

const delegate = (cfg: ResourceConfig) => (prisma as unknown as Record<string, any>)[cfg.model];

function toDates(cfg: ResourceConfig, data: any) {
  for (const f of cfg.dateFields ?? []) {
    if (typeof data[f] === 'string') data[f] = new Date(data[f]);
  }
  return data;
}

function fail(error: unknown) {
  if (error instanceof ZodError) {
    const msg = error.issues.map((i) => `${i.path.join('.') || 'dados'}: ${i.message}`).join('; ');
    return NextResponse.json({ error: `Dados inválidos — ${msg}` }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      return NextResponse.json({ error: 'Já existe um registro com esse valor único (placa, CNH ou CNPJ).' }, { status: 409 });
    if (error.code === 'P2003')
      return NextResponse.json(
        { error: 'Registro vinculado a outros lançamentos (abastecimentos, fretes etc.) ou referência inválida.' },
        { status: 409 }
      );
    if (error.code === 'P2025') return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: 'Erro interno ou banco de dados indisponível.' }, { status: 500 });
}

const notFound = () => NextResponse.json({ error: 'Recurso não encontrado.' }, { status: 404 });

export async function listResource(slug: string) {
  const cfg = resources[slug];
  if (!cfg) return notFound();
  try {
    const rows = await delegate(cfg).findMany({ orderBy: cfg.orderBy });
    return NextResponse.json(serialize(rows));
  } catch (e) {
    return fail(e);
  }
}

export async function createResource(slug: string, req: Request) {
  const cfg = resources[slug];
  if (!cfg) return notFound();
  try {
    let data: any = cfg.schema.parse(await req.json());
    if (cfg.beforeSave) data = cfg.beforeSave(data);
    const row = await delegate(cfg).create({ data: toDates(cfg, data) });
    if (cfg.afterCreate) await cfg.afterCreate(row);
    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function updateResource(slug: string, id: string, req: Request) {
  const cfg = resources[slug];
  if (!cfg) return notFound();
  try {
    const data = cfg.schema.partial().parse(await req.json());
    const row = await delegate(cfg).update({ where: { id }, data: toDates(cfg, data) });
    return NextResponse.json(serialize(row));
  } catch (e) {
    return fail(e);
  }
}

export async function deleteResource(slug: string, id: string) {
  const cfg = resources[slug];
  if (!cfg) return notFound();
  try {
    await delegate(cfg).delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Carrega todas as coleções, no formato esperado pelo front-end (FleetData). */
export async function loadFleet() {
  const entries = await Promise.all(
    Object.values(resources).map(async (cfg) => [
      cfg.clientKey,
      serialize(await delegate(cfg).findMany({ orderBy: cfg.orderBy })),
    ])
  );
  return Object.fromEntries(entries) as Record<string, any[]>;
}
