import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

const Body = z.object({
  truckId: z.string().uuid(),
  odometer: z.number().int().positive(),
});

/** Atualiza o hodômetro — idempotente para o mesmo valor e nunca diminui. */
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

  // Se já foi atualizado com esse exato valor (ex: reenvio de fila offline), responde sucesso sem duplicar
  if (odometer === truck.currentOdometer) {
    return NextResponse.json({ ok: true, currentOdometer: odometer, deduplicated: true });
  }

  if (odometer < truck.currentOdometer)
    return NextResponse.json(
      { error: `O hodômetro deve ser maior que o atual (${truck.currentOdometer.toLocaleString('pt-BR')} km).` },
      { status: 400 }
    );

  await Promise.all([
    prisma.truck.update({ where: { id: truckId }, data: { currentOdometer: odometer } }),
    prisma.userProfile
      .update({ where: { id: guard.profile.id }, data: { truckId } })
      .catch(() => {}),
  ]);

  return NextResponse.json({ ok: true, currentOdometer: odometer });
}
