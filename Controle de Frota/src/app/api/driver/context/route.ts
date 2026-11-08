import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Tudo o que o app do motorista precisa — e SOMENTE o que pertence a ele. */
export async function GET() {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  const truckIds = await allowedTruckIds(profile);

  const [driver, trucks, trips, expenses] = await Promise.all([
    prisma.driver.findUnique({ where: { id: profile.driverId }, select: { id: true, name: true, cnhExpiry: true } }),
    prisma.truck.findMany({
      where: { id: { in: truckIds } },
      select: { id: true, plate: true, model: true, currentOdometer: true },
    }),
    prisma.freightTrip.findMany({
      where: { driverId: profile.driverId, status: { in: ['PLANEJADO', 'EM_VIAGEM'] } },
      orderBy: { startDate: 'desc' },
      select: { id: true, truckId: true, origin: true, destination: true, customerName: true, status: true, startDate: true },
    }),
    prisma.travelExpense.findMany({
      where: { driverId: profile.driverId },
      orderBy: { date: 'desc' },
      take: 15,
      select: { id: true, tripId: true, date: true, category: true, amount: true, description: true, receiptPhotoUrl: true },
    }),
  ]);

  return NextResponse.json(serialize({ userName: profile.name, role: profile.role, driver, trucks, trips, expenses }));
}
