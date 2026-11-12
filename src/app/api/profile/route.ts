import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const ProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  avatarUrl: z.string().optional().nullable(),
});

export async function GET() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  let driver = null;
  if (profile.driverId) {
    driver = await prisma.driver.findUnique({
      where: { id: profile.driverId },
      select: {
        id: true,
        name: true,
        phone: true,
        cnhNumber: true,
        cnhCategory: true,
        cnhExpiry: true,
        avatarUrl: true,
        commissionPercent: true,
      },
    });
  }

  let truck = null;
  if (profile.truckId) {
    truck = await prisma.truck.findUnique({
      where: { id: profile.truckId },
      select: {
        id: true,
        plate: true,
        model: true,
        brand: true,
        currentOdometer: true,
      },
    });
  }

  return NextResponse.json(
    serialize({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      avatarUrl: profile.avatarUrl || driver?.avatarUrl || null,
      canChangeTruck: profile.canChangeTruck ?? true,
      driver,
      truck,
    })
  );
}

export async function PATCH(req: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { profile } = guard;

  try {
    const body = ProfileUpdateSchema.parse(await req.json());

    const updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      },
    });

    if (profile.driverId && body.avatarUrl !== undefined) {
      await prisma.driver.update({
        where: { id: profile.driverId },
        data: { avatarUrl: body.avatarUrl },
      }).catch(() => null);
    }

    return NextResponse.json(serialize(updatedProfile));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join(' ') },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao atualizar perfil.' }, { status: 500 });
  }
}
