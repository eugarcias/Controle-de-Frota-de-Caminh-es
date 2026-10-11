/**
 * Popula o banco com os dados de exemplo (3 caminhões, motoristas, clientes etc.).
 * Só roda se o banco estiver vazio — nunca apaga dados existentes.
 * Uso: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  mockTrucks,
  mockDrivers,
  mockFuelLogs,
  mockMaintenanceLogs,
  mockFreightTrips,
} from '../src/mock-data';
import { mockCustomers, mockTireSuppliers, mockCargoSchedules } from '../src/mock-extra';

const prisma = new PrismaClient();

// IDs de exemplo (ex.: "f-101") viram UUIDs reais, mantendo as relações
const ids = new Map<string, string>();
const uid = (old: string) => {
  if (!ids.has(old)) ids.set(old, randomUUID());
  return ids.get(old) as string;
};

async function main() {
  if ((await prisma.truck.count()) > 0) {
    console.log('O banco já possui caminhões cadastrados. Seed ignorado (nada foi alterado).');
    return;
  }

  await prisma.truck.createMany({
    data: mockTrucks.map((t) => ({
      id: uid(t.id),
      plate: t.plate,
      model: t.model,
      brand: t.brand,
      year: t.year,
      tankCapacityLiters: t.tankCapacityLiters,
      initialOdometer: t.initialOdometer,
      currentOdometer: t.currentOdometer,
      status: t.status,
      createdAt: new Date(t.createdAt),
    })),
  });

  await prisma.driver.createMany({
    data: mockDrivers.map((d) => ({ ...d, id: uid(d.id) })),
  });

  await prisma.customer.createMany({
    data: mockCustomers.map((c) => ({ ...c, id: uid(c.id), notes: c.notes ?? null })),
  });

  await prisma.tireSupplier.createMany({
    data: mockTireSuppliers.map((s) => ({ ...s, id: uid(s.id), notes: s.notes ?? null })),
  });

  await prisma.fuelLog.createMany({
    data: mockFuelLogs.map((f) => ({
      id: uid(f.id),
      truckId: uid(f.truckId),
      driverId: uid(f.driverId),
      date: new Date(f.date),
      odometer: f.odometer,
      fuelType: f.fuelType,
      liters: f.liters,
      pricePerLiter: f.pricePerLiter,
      totalAmount: f.totalAmount,
      arlaLiters: f.arlaLiters,
      arlaAmount: f.arlaAmount,
      isFullTank: f.isFullTank,
      gasStationName: f.gasStationName,
      createdAt: new Date(f.createdAt),
    })),
  });

  await prisma.maintenanceLog.createMany({
    data: mockMaintenanceLogs.map((m) => ({
      id: uid(m.id),
      truckId: uid(m.truckId),
      date: new Date(m.date),
      odometerAtService: m.odometerAtService,
      type: m.type,
      category: m.category,
      description: m.description,
      partsCost: m.partsCost,
      laborCost: m.laborCost,
      totalCost: m.totalCost,
      supplierName: m.supplierName,
      nextServiceOdometerAlert: m.nextServiceOdometerAlert ?? null,
      createdAt: new Date(m.createdAt),
    })),
  });

  // Vincula cada frete ao cliente cadastrado pelo primeiro nome (ex.: "Bunge Alimentos" -> Bunge Alimentos S.A.)
  const customerIdFor = (name: string) => {
    const first = name.split(' ')[0].toLowerCase();
    const found = mockCustomers.find((c) => c.name.toLowerCase().startsWith(first));
    return found ? uid(found.id) : null;
  };

  await prisma.freightTrip.createMany({
    data: mockFreightTrips.map((t) => ({
      id: uid(t.id),
      truckId: uid(t.truckId),
      driverId: uid(t.driverId),
      customerId: customerIdFor(t.customerName),
      customerName: t.customerName,
      origin: t.origin,
      destination: t.destination,
      startDate: new Date(t.startDate),
      endDate: t.endDate ? new Date(t.endDate) : null,
      initialKm: t.initialKm,
      finalKm: t.finalKm ?? null,
      distanceKm: t.finalKm ? t.finalKm - t.initialKm : null,
      grossFreightValue: t.grossFreightValue,
      tollCosts: t.tollCosts,
      loadingUnloadingCosts: t.loadingUnloadingCosts,
      otherExpenses: t.otherExpenses,
      netFreightValue: t.netFreightValue,
      status: 'CONCLUIDO',
    })),
  });

  await prisma.cargoSchedule.createMany({
    data: mockCargoSchedules.map((s) => ({
      id: uid(s.id),
      customerId: uid(s.customerId),
      truckId: s.truckId ? uid(s.truckId) : null,
      driverId: s.driverId ? uid(s.driverId) : null,
      origin: s.origin,
      destination: s.destination,
      distanceKm: s.distanceKm,
      cargoDescription: s.cargoDescription,
      cargoWeightKg: s.cargoWeightKg,
      pickupDate: new Date(s.pickupDate),
      deliveryDate: s.deliveryDate ? new Date(s.deliveryDate) : null,
      freightValue: s.freightValue,
      status: s.status,
      notes: s.notes ?? null,
    })),
  });

  console.log('Seed concluído: caminhões, motoristas, clientes, fornecedores, abastecimentos, manutenções, fretes e agenda.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
