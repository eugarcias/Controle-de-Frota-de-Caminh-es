import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
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

    const supabaseAdmin = createSupabaseAdmin();
    const authUpdate: Record<string, unknown> = {
      email,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { name, role },
    };
    if (body.password && body.password.trim().length >= 4) {
      authUpdate.password = body.password.trim();
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(params.id, authUpdate);
    if (authErr) {
      return NextResponse.json({ error: `Erro ao atualizar no Auth: ${authErr.message}` }, { status: 400 });
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
    const supabaseAdmin = createSupabaseAdmin();
    await supabaseAdmin.auth.admin.deleteUser(params.id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro ao remover usuário.' }, { status: 500 });
  }
}
