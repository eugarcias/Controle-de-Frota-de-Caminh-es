import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver } from '@/lib/auth';

const Body = z.object({
  tripId: z.string().uuid(),
  date: z.string().min(8),
  category: z.enum(['ALIMENTACAO', 'ESTACIONAMENTO', 'BORRACHARIA', 'CHAPA', 'PEDAGIO', 'HOSPEDAGEM', 'OUTROS']),
  amount: z.number().positive().max(100000),
  description: z.string().trim().max(300).default(''),
  /** Caminho devolvido por /api/driver/upload */
  receiptPhotoUrl: z.string().max(300).optional().nullable(),
});

export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  try {
    const body = Body.parse(await req.json());

    // O frete precisa ser DESTE motorista e estar em aberto.
    const trip = await prisma.freightTrip.findFirst({
      where: { id: body.tripId, driverId: profile.driverId, status: { in: ['PLANEJADO', 'EM_VIAGEM'] } },
      select: { id: true },
    });
    if (!trip) return NextResponse.json({ error: 'Frete não encontrado ou já encerrado.' }, { status: 403 });

    // O recibo precisa ter sido enviado por este próprio usuário (pasta = id do usuário).
    if (body.receiptPhotoUrl && !body.receiptPhotoUrl.startsWith(`${profile.id}/`))
      return NextResponse.json({ error: 'Recibo inválido.' }, { status: 400 });

    const row = await prisma.travelExpense.create({
      data: {
        tripId: body.tripId,
        driverId: profile.driverId, // sempre da sessão
        date: new Date(body.date),
        category: body.category,
        amount: body.amount,
        description: body.description,
        receiptPhotoUrl: body.receiptPhotoUrl ?? null,
      },
    });
    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'Erro ao registrar despesa.' }, { status: 500 });
  }
}
