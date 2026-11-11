import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver } from '@/lib/auth';

const Body = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
  date: z.string().min(8),
  category: z.enum([
    'ALIMENTACAO',
    'ESTACIONAMENTO',
    'BORRACHARIA',
    'CHAPA',
    'PEDAGIO',
    'HOSPEDAGEM',
    'OUTROS',
  ]),
  amount: z.number().positive().max(100000),
  description: z.string().trim().max(300).default(''),
  receiptPhotoUrl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  try {
    const body = Body.parse(await req.json());

    // 1. Proteção contra duplicidade por ID (fila offline / clique duplo)
    if (body.id) {
      const existingById = await prisma.travelExpense.findUnique({ where: { id: body.id } });
      if (existingById) {
        return NextResponse.json(serialize({ ...existingById, deduplicated: true }), { status: 200 });
      }
    }

    // 2. Proteção inteligente contra duplicidade de conteúdo nos últimos 15 minutos
    const parsedDate = new Date(body.date);
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingDuplicate = await prisma.travelExpense.findFirst({
      where: {
        driverId: profile.driverId,
        category: body.category,
        amount: body.amount,
        description: body.description,
        createdAt: { gte: fifteenMinAgo },
      },
    });
    if (existingDuplicate) {
      return NextResponse.json(serialize({ ...existingDuplicate, deduplicated: true }), {
        status: 200,
      });
    }

    // Se tripId foi informado, valida; se não, tenta achar um frete ativo do motorista/caminhão
    let resolvedTripId: string | null = null;
    let resolvedTruckId: string | null = body.truckId ?? profile.truckId ?? null;

    if (body.tripId) {
      const trip = await prisma.freightTrip.findFirst({
        where: { id: body.tripId },
        select: { id: true, truckId: true },
      });
      if (trip) {
        resolvedTripId = trip.id;
        resolvedTruckId = resolvedTruckId ?? trip.truckId;
      }
    } else {
      const openTrip = await prisma.freightTrip.findFirst({
        where: {
          driverId: profile.driverId,
          ...(resolvedTruckId ? { truckId: resolvedTruckId } : {}),
          status: { in: ['EM_VIAGEM', 'PLANEJADO'] },
        },
        orderBy: { startDate: 'desc' },
        select: { id: true, truckId: true },
      });
      if (openTrip) {
        resolvedTripId = openTrip.id;
        resolvedTruckId = resolvedTruckId ?? openTrip.truckId;
      }
    }

    const row = await prisma.travelExpense.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        tripId: resolvedTripId,
        truckId: resolvedTruckId,
        driverId: profile.driverId,
        date: parsedDate,
        category: body.category,
        amount: body.amount,
        description: body.description,
        receiptPhotoUrl: body.receiptPhotoUrl ?? null,
      },
    });

    // 3. Integra automaticamente a despesa diária na carga/viagem vinculada (FreightTrip)
    if (resolvedTripId) {
      const trip = await prisma.freightTrip.findUnique({ where: { id: resolvedTripId } });
      if (trip) {
        const gross = Number(trip.grossFreightValue) || 0;
        let tolls = Number(trip.tollCosts) || 0;
        let loading = Number(trip.loadingUnloadingCosts) || 0;
        let other = Number(trip.otherExpenses) || 0;

        if (body.category === 'PEDAGIO') {
          tolls += body.amount;
        } else if (body.category === 'CHAPA') {
          loading += body.amount;
        } else {
          other += body.amount;
        }

        const net = Number((gross - tolls - loading - other).toFixed(2));
        await prisma.freightTrip
          .update({
            where: { id: trip.id },
            data: {
              tollCosts: tolls,
              loadingUnloadingCosts: loading,
              otherExpenses: other,
              netFreightValue: net,
            },
          })
          .catch(() => {});
      }
    }

    if (resolvedTruckId) {
      await prisma.userProfile
        .update({ where: { id: profile.id }, data: { truckId: resolvedTruckId } })
        .catch(() => {});
    }

    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join('; ') },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao salvar despesa.' }, { status: 500 });
  }
}
