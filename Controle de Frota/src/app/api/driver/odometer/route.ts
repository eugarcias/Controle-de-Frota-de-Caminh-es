import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

const Body = z.object({
  truckId: z.string().uuid(),
  odometer: z.number().int().positive(),
});

/** Atualiza o hodômetro — apenas para frente (nunca diminui). */
export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const { truckId, odometer } = parsed.data;

  if (!(await allowedTruckIds(guard.profile)).includes(truckId))
    return NextResponse.json({ error: 'Este caminhão não está liberado para você.' }, { status: 403 });

  const truck = await prisma.truck.findUnique({ where: { id: truckId }, select: { currentOdometer: true } });
  if (!truck) return NextResponse.json({ error: 'Caminhão não encontrado.' }, { status: 404 });
  if (odometer <= truck.currentOdometer)
    return NextResponse.json(
      { error: `O hodômetro deve ser maior que o atual (${truck.currentOdometer.toLocaleString('pt-BR')} km).` },
      { status: 400 }
    );

  await prisma.truck.update({ where: { id: truckId }, data: { currentOdometer: odometer } });
  return NextResponse.json({ ok: true, currentOdometer: odometer });
}
