import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';
import { requireDriver, allowedTruckIds } from '@/lib/auth';

const Body = z.object({
  truckId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  urgent: z.boolean().default(false),
});

export async function POST(req: Request) {
  const guard = await requireDriver();
  if (!guard.ok) return guard.response;
  const { profile } = guard;
  try {
    const body = Body.parse(await req.json());
    if (body.truckId && !(await allowedTruckIds(profile)).includes(body.truckId))
      return NextResponse.json({ error: 'Caminhão não liberado.' }, { status: 403 });
    const row = await prisma.problemReport.create({
      data: { ...body, truckId: body.truckId ?? null, driverId: profile.driverId },
    });
    return NextResponse.json(serialize(row), { status: 201 });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'Erro ao relatar problema.' }, { status: 500 });
  }
}
