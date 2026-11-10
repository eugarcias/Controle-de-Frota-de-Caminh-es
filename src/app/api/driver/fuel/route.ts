import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

const Body = z.object({
  id: z.string().uuid().optional(),
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

    // 1. Proteção contra duplicidade por ID (reenvio de fila offline ou clique duplo)
    if (body.id) {
      const existingById = await prisma.fuelLog.findUnique({ where: { id: body.id } });
      if (existingById) {
        return NextResponse.json(serialize({ ...existingById, deduplicated: true }), { status: 200 });
      }
    }

    // 2. Proteção inteligente contra duplicidade de conteúdo:
    // Mesmo caminhão com o mesmo odômetro OU mesmo caminhão, litros e valor nos últimos 30 minutos
    const parsedDate = new Date(body.date);
    const windowStart = new Date(parsedDate.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(parsedDate.getTime() + 30 * 60 * 1000);

    const existingDuplicate = await prisma.fuelLog.findFirst({
      where: {
        truckId: body.truckId,
        OR: [
          { odometer: body.odometer },
          {
            liters: body.liters,
            totalAmount: body.totalAmount,
            date: { gte: windowStart, lte: windowEnd },
          },
        ],
      },
    });

    if (existingDuplicate) {
      return NextResponse.json(serialize({ ...existingDuplicate, deduplicated: true }), { status: 200 });
    }

    const pricePerLiter = body.pricePerLiter ?? Number((body.totalAmount / body.liters).toFixed(3));

    const row = await prisma.fuelLog.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        truckId: body.truckId,
        driverId: profile.driverId,
        date: parsedDate,
        odometer: body.odometer,
        fuelType: body.fuelType,
        liters: body.liters,
        pricePerLiter,
        totalAmount: body.totalAmount,
        arlaLiters: body.arlaLiters,
        arlaAmount: body.arlaAmount,
        gasStationName: body.gasStationName,
        receiptPhotoUrl: body.receiptPhotoUrl ?? null,
      },
    });

    // Atualiza o hodômetro do caminhão e memoriza como último caminhão usado pelo motorista
    await Promise.all([
      prisma.truck.updateMany({
        where: { id: body.truckId, currentOdometer: { lt: body.odometer } },
        data: { currentOdometer: body.odometer },
      }),
      prisma.userProfile
        .update({
          where: { id: profile.id },
          data: { truckId: body.truckId },
        })
        .catch(() => {}),
    ]);

    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'Erro ao registrar abastecimento.' }, { status: 500 });
  }
}
