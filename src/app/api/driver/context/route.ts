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
        select: { id: true, name: true, cnhExpiry: true, commissionPercent: true, avatarUrl: true },
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
          status: { in: ['AGENDADA', 'EM_TRANSITO'] },
          OR: [{ driverId: profile.driverId }, { driverId: null }],
        },
        orderBy: { pickupDate: 'asc' },
        take: 15,
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
        take: 80,
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
          endDate: true,
          notes: true,
          grossFreightValue: true,
          driverCommission: true,
        },
      }),
    ]);

  // % padrão de comissão do motorista (definido pelo admin)
  const commissionPct =
    driver?.commissionPercent !== null && driver?.commissionPercent !== undefined
      ? Number(driver.commissionPercent)
      : 10;

  /** Comissão da viagem: valor definido no agendamento, ou estimativa pelo % do motorista. */
  const calcCommission = (fixed: unknown, gross: unknown) => {
    if (fixed !== null && fixed !== undefined) {
      return { commission: Number(fixed) || 0, commissionIsEstimate: false };
    }
    return {
      commission: Number((((Number(gross) || 0) * commissionPct) / 100).toFixed(2)),
      commissionIsEstimate: true,
    };
  };

  // Mapa de comissão por viagem (para cargas ativas também)
  const commissionByTrip = new Map(
    allDriverTrips.map((t) => [t.id, calcCommission(t.driverCommission, t.grossFreightValue)])
  );

  // Histórico do motorista para a dashboard (sem expor valores de frete)
  const tripHistory = allDriverTrips
    .filter((t) => t.status !== 'CANCELADO')
    .map(({ grossFreightValue: _g, driverCommission: _d, ...rest }) => ({
      ...rest,
      ...(commissionByTrip.get(rest.id) ?? { commission: 0, commissionIsEstimate: true }),
    }));

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
      driver: driver
        ? {
            id: driver.id,
            name: driver.name,
            cnhExpiry: driver.cnhExpiry,
            commissionPercent: commissionPct,
            avatarUrl: driver.avatarUrl || profile.avatarUrl || null,
          }
        : null,
      avatarUrl: profile.avatarUrl || driver?.avatarUrl || null,
      canChangeTruck: profile.canChangeTruck ?? true,
      preferredTruckId,
      trucks,
      trips: trips.map((t) => ({
        ...t,
        ...(commissionByTrip.get(t.id) ?? {}),
      })),
      recentTrips: tripHistory.slice(0, 8),
      tripHistory,
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
        deliveryDate: s.deliveryDate,
        distanceKm: s.distanceKm,
        status: s.status,
        notes: s.notes ?? '',
        ...calcCommission(s.driverCommission, s.freightValue),
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

  if (guard.profile.canChangeTruck === false) {
    return NextResponse.json(
      { error: 'Você não tem permissão do administrador para trocar de caminhão.' },
      { status: 403 }
    );
  }

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
