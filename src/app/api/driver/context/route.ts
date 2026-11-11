import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Tudo o que o app do motorista precisa — com ordenação inteligente do caminhão preferido/mais usado e cargas atuais. */
export async function GET() {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  const truckIds = await allowedTruckIds(profile);

  const [driver, rawTrucks, trips, scheduledLoads, expenses, driverFuelLogs, allDriverTrips] =
    await Promise.all([
      prisma.driver.findUnique({
        where: { id: profile.driverId },
        select: { id: true, name: true, cnhExpiry: true },
      }),
      prisma.truck.findMany({
        where: { id: { in: truckIds } },
        select: {
          id: true,
          plate: true,
          model: true,
          brand: true,
          currentOdometer: true,
          status: true,
        },
        orderBy: { plate: 'asc' },
      }),
      prisma.freightTrip.findMany({
        where: {
          OR: [
            { driverId: profile.driverId, status: { in: ['PLANEJADO', 'EM_VIAGEM'] } },
            { truckId: { in: truckIds }, status: 'EM_VIAGEM' },
          ],
        },
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          truckId: true,
          driverId: true,
          origin: true,
          destination: true,
          customerName: true,
          cargoDescription: true,
          cargoWeightKg: true,
          initialKm: true,
          finalKm: true,
          distanceKm: true,
          status: true,
          startDate: true,
          tollCosts: true,
          loadingUnloadingCosts: true,
          otherExpenses: true,
          notes: true,
        },
      }),
      prisma.cargoSchedule.findMany({
        where: {
          status: 'AGENDADA',
          OR: [{ driverId: profile.driverId }, { driverId: null }],
        },
        orderBy: { pickupDate: 'asc' },
        take: 10,
        include: {
          customer: { select: { name: true } },
        },
      }),
      prisma.travelExpense.findMany({
        where: { driverId: profile.driverId },
        orderBy: { date: 'desc' },
        take: 30,
        select: {
          id: true,
          tripId: true,
          truckId: true,
          date: true,
          category: true,
          amount: true,
          description: true,
          receiptPhotoUrl: true,
        },
      }),
      prisma.fuelLog.findMany({
        where: { driverId: profile.driverId },
        orderBy: { date: 'desc' },
        take: 30,
        select: {
          id: true,
          truckId: true,
          date: true,
          odometer: true,
          liters: true,
          totalAmount: true,
          pricePerLiter: true,
        },
      }),
      prisma.freightTrip.findMany({
        where: { driverId: profile.driverId },
        orderBy: { startDate: 'desc' },
        take: 30,
        select: { truckId: true, startDate: true },
      }),
    ]);

  // Contagem de uso de cada caminhão pelo motorista (abastecimentos + viagens)
  const usageMap = new Map<string, number>();
  for (const f of driverFuelLogs) {
    usageMap.set(f.truckId, (usageMap.get(f.truckId) ?? 0) + 1);
  }
  for (const t of allDriverTrips) {
    usageMap.set(t.truckId, (usageMap.get(t.truckId) ?? 0) + 2);
  }

  const lastFuelTruckId = driverFuelLogs[0]?.truckId ?? null;
  const activeTripTruckId =
    trips.find((t) => t.driverId === profile.driverId)?.truckId ?? trips[0]?.truckId ?? null;
  const mostUsedTruckId =
    Array.from(usageMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Prioridade: 1) Viagem ativa -> 2) Caminhão fixado no perfil -> 3) Último abastecido -> 4) Mais utilizado
  const preferredTruckId =
    activeTripTruckId ||
    profile.truckId ||
    lastFuelTruckId ||
    mostUsedTruckId ||
    rawTrucks[0]?.id ||
    null;

  const trucks = rawTrucks
    .map((t) => ({
      ...t,
      isPreferred: t.id === preferredTruckId,
      isProfileDefault: t.id === profile.truckId,
      isLastUsed: t.id === lastFuelTruckId || t.id === activeTripTruckId,
      usageCount: usageMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.id === preferredTruckId) return -1;
      if (b.id === preferredTruckId) return 1;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.plate.localeCompare(b.plate);
    });

  return NextResponse.json(
    serialize({
      userName: profile.name,
      role: profile.role,
      driver,
      preferredTruckId,
      trucks,
      trips,
      scheduledLoads: scheduledLoads.map((s) => ({
        id: s.id,
        truckId: s.truckId,
        driverId: s.driverId,
        customerName: s.customer?.name ?? 'Cliente',
        origin: s.origin,
        destination: s.destination,
        cargoDescription: s.cargoDescription,
        cargoWeightKg: s.cargoWeightKg,
        pickupDate: s.pickupDate,
        distanceKm: s.distanceKm,
      })),
      expenses,
      recentFuelLogs: driverFuelLogs.slice(0, 8),
    })
  );
}

const PatchTruckSchema = z.object({
  truckId: z.string().uuid(),
});

/** Salva o caminhão preferido do motorista no perfil para já abrir selecionado nas próximas vezes. */
export async function PATCH(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;

  const parsed = PatchTruckSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Caminhão inválido.' }, { status: 400 });
  }

  await prisma.userProfile
    .update({
      where: { id: guard.profile.id },
      data: { truckId: parsed.data.truckId },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, preferredTruckId: parsed.data.truckId });
}
