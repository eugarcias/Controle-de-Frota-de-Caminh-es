import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

const Body = z.object({
  truckId: z.string().uuid(),
  date: z.string().min(8),
  odometer: z.number().int().positive(),
  liters: z.number().positive(),
  totalAmount: z.number().positive(),
  pricePerLiter: z.number().positive().optional(),
  gasStationName: z.string().trim().min(2).default('Posto Rodovia'),
  fuelType: z.enum(['DIESEL_S10', 'DIESEL_S500']).default('DIESEL_S10'),
  arlaLiters: z.number().nonnegative().default(0),
  arlaAmount: z.number().nonnegative().default(0),
  receiptPhotoUrl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  try {
    const body = Body.parse(await req.json());

    if (!(await allowedTruckIds(profile)).includes(body.truckId))
      return NextResponse.json({ error: 'Este caminhão não está liberado para você.' }, { status: 403 });

    const pricePerLiter = body.pricePerLiter ?? Number((body.totalAmount / body.liters).toFixed(3));

    // driverId vem SEMPRE da sessão — nunca do corpo da requisição.
    const row = await prisma.fuelLog.create({
      data: {
        ...body,
        pricePerLiter,
        receiptPhotoUrl: body.receiptPhotoUrl ?? null,
        date: new Date(body.date),
        driverId: profile.driverId,
      },
    });
    await prisma.truck.updateMany({
      where: { id: body.truckId, currentOdometer: { lt: body.odometer } },
      data: { currentOdometer: body.odometer },
    });
    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'Erro ao registrar abastecimento.' }, { status: 500 });
  }
}
