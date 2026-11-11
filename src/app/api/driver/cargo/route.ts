import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver } from '@/lib/auth';
import { splitDestination } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const StartCargoSchema = z.object({
  id: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional().nullable(),
  tripId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid(),
  origin: z.string().trim().min(2, 'Informe a origem da carga.'),
  destination: z.string().trim().min(2, 'Informe o destino da carga.'),
  customerName: z.string().trim().max(150).optional().default(''),
  cargoDescription: z.string().trim().min(2, 'Informe qual carga está transportando.'),
  cargoWeightKg: z.number().int().min(0).optional().nullable(),
  initialKm: z.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(300).optional().default(''),
});

const UpdateCargoSchema = z.object({
  tripId: z.string().uuid(),
  status: z.enum(['EM_VIAGEM', 'CONCLUIDO', 'CANCELADO']),
  finalKm: z.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(300).optional(),
});

/**
 * POST /api/driver/cargo
 * Permite ao motorista informar qual carga está realizando no momento
 * (seja iniciando uma carga agendada ou declarando uma nova carga direto do celular).
 */
export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  try {
    const body = StartCargoSchema.parse(await req.json());

    // Se o motorista selecionou uma viagem PLANEJADA existente para iniciar:
    if (body.tripId) {
      const existingTrip = await prisma.freightTrip.findUnique({ where: { id: body.tripId } });
      if (existingTrip) {
        const updated = await prisma.freightTrip.update({
          where: { id: existingTrip.id },
          data: {
            status: 'EM_VIAGEM',
            truckId: body.truckId,
            origin: body.origin || existingTrip.origin,
            destination: body.destination || existingTrip.destination,
            cargoDescription: body.cargoDescription || existingTrip.cargoDescription,
            ...(body.initialKm && body.initialKm > 0 ? { initialKm: body.initialKm } : {}),
          },
        });

        if (body.initialKm && body.initialKm > 0) {
          await prisma.truck.updateMany({
            where: { id: body.truckId, currentOdometer: { lt: body.initialKm } },
            data: { currentOdometer: body.initialKm },
          });
        }

        return NextResponse.json(serialize(updated), { status: 200 });
      }
    }

    // Proteção contra duplicidade por ID (fila offline / clique duplo)
    if (body.id) {
      const existingById = await prisma.freightTrip.findUnique({ where: { id: body.id } });
      if (existingById) {
        return NextResponse.json(serialize({ ...existingById, deduplicated: true }), { status: 200 });
      }
    }

    const truck = await prisma.truck.findUnique({ where: { id: body.truckId } });
    if (!truck) {
      return NextResponse.json({ error: 'Caminhão não encontrado.' }, { status: 404 });
    }

    // Verifica se veio de um agendamento (CargoSchedule)
    let customerId: string | null = null;
    let customerName = body.customerName.trim() || 'À definir (Informado pelo Motorista)';
    let grossFreightValue = 0;
    let distanceKm = 0;

    if (body.scheduleId) {
      const schedule = await prisma.cargoSchedule.findUnique({
        where: { id: body.scheduleId },
        include: { customer: true },
      });
      if (schedule) {
        customerId = schedule.customerId;
        customerName = schedule.customer?.name || customerName;
        grossFreightValue = Number(schedule.freightValue) || 0;
        distanceKm = schedule.distanceKm || 0;
        await prisma.cargoSchedule
          .update({
            where: { id: schedule.id },
            data: { status: 'EM_TRANSITO', truckId: truck.id, driverId: profile.driverId },
          })
          .catch(() => {});
      }
    }

    const parsedDest = splitDestination(body.destination);
    const destCity = parsedDest?.city ?? body.destination;
    const destState = parsedDest?.state ?? 'RS';
    const startKm =
      body.initialKm && body.initialKm > 0 ? body.initialKm : truck.currentOdometer;

    const trip = await prisma.freightTrip.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        truckId: truck.id,
        driverId: profile.driverId,
        customerId,
        customerName,
        origin: body.origin,
        destination: body.destination,
        destinationCity: destCity,
        destinationState: destState,
        startDate: new Date(),
        initialKm: startKm,
        distanceKm: distanceKm > 0 ? distanceKm : null,
        cargoDescription: body.cargoDescription,
        cargoWeightKg: body.cargoWeightKg ?? null,
        status: 'EM_VIAGEM',
        notes: body.notes || null,
        grossFreightValue,
        tollCosts: 0,
        loadingUnloadingCosts: 0,
        otherExpenses: 0,
        netFreightValue: grossFreightValue,
      },
    });

    if (startKm > truck.currentOdometer) {
      await prisma.truck.update({
        where: { id: truck.id },
        data: { currentOdometer: startKm },
      });
    }

    await prisma.userProfile
      .update({ where: { id: profile.id }, data: { truckId: truck.id } })
      .catch(() => {});

    return NextResponse.json(serialize(trip), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join('; ') },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao registrar carga atual.' }, { status: 500 });
  }
}

/**
 * PATCH /api/driver/cargo
 * Permite ao motorista finalizar a entrega da carga atual ou atualizar o status/KM final.
 */
export async function PATCH(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;

  try {
    const body = UpdateCargoSchema.parse(await req.json());
    const trip = await prisma.freightTrip.findUnique({ where: { id: body.tripId } });
    if (!trip) {
      return NextResponse.json({ error: 'Carga/Viagem não encontrada.' }, { status: 404 });
    }

    const finalKm =
      body.finalKm && body.finalKm >= trip.initialKm ? body.finalKm : trip.finalKm;
    const distanceKm =
      finalKm && finalKm > trip.initialKm ? finalKm - trip.initialKm : trip.distanceKm;

    const updated = await prisma.freightTrip.update({
      where: { id: trip.id },
      data: {
        status: body.status,
        ...(body.status === 'CONCLUIDO' ? { endDate: new Date() } : {}),
        ...(finalKm ? { finalKm } : {}),
        ...(distanceKm ? { distanceKm } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    if (finalKm && finalKm > 0) {
      await prisma.truck.updateMany({
        where: { id: trip.truckId, currentOdometer: { lt: finalKm } },
        data: { currentOdometer: finalKm },
      });
    }

    return NextResponse.json(serialize(updated));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join('; ') },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao atualizar carga.' }, { status: 500 });
  }
}
