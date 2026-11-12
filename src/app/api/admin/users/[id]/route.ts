import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { normalizeLoginIdentifier, formatLoginDisplay } from '@/lib/supabase/browser';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const PatchUserSchema = z.object({
  login: z.string().trim().min(2).optional(),
  password: z.string().min(4, 'A senha deve ter pelo menos 4 caracteres.').optional().or(z.literal('')),
  name: z.string().trim().min(2).optional(),
  role: z.enum(['ADMIN', 'DRIVER']).optional(),
  active: z.boolean().optional(),
  driverId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  canChangeTruck: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = PatchUserSchema.parse(await req.json());
    const existing = await prisma.userProfile.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const email = body.login ? normalizeLoginIdentifier(body.login) : existing.email;
    const role = body.role ?? existing.role;
    const name = body.name ?? existing.name;

    // Atualiza auth.users
    if (body.password && body.password.trim().length >= 4) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE auth.users
        SET email = $1,
            encrypted_password = crypt($2, gen_salt('bf')),
            updated_at = now(),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', $3::text),
            raw_user_meta_data = jsonb_build_object('role', $3::text, 'name', $4::text)
        WHERE id = $5::uuid
      `,
        email,
        body.password.trim(),
        role,
        name,
        params.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
        UPDATE auth.users
        SET email = $1,
            updated_at = now(),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', $2::text),
            raw_user_meta_data = jsonb_build_object('role', $2::text, 'name', $3::text)
        WHERE id = $4::uuid
      `,
        email,
        role,
        name,
        params.id
      );
    }

    const updated = await prisma.userProfile.update({
      where: { id: params.id },
      data: {
        email,
        name,
        role,
        active: body.active ?? existing.active,
        driverId: body.driverId !== undefined ? body.driverId : existing.driverId,
        truckId: body.truckId !== undefined ? body.truckId : existing.truckId,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
        canChangeTruck: body.canChangeTruck !== undefined ? body.canChangeTruck : existing.canChangeTruck,
      },
    });

    return NextResponse.json(
      serialize({
        ...updated,
        loginDisplay: formatLoginDisplay(updated.email),
      })
    );
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues.map((i) => i.message).join(' ') }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (guard.profile.id === params.id) {
    return NextResponse.json({ error: 'Você não pode excluir seu próprio usuário logado.' }, { status: 400 });
  }

  try {
    await prisma.userProfile.delete({ where: { id: params.id } });
    await prisma.$executeRawUnsafe('DELETE FROM auth.identities WHERE user_id = $1::uuid', params.id);
    await prisma.$executeRawUnsafe('DELETE FROM auth.users WHERE id = $1::uuid', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro ao remover usuário.' }, { status: 500 });
  }
}
