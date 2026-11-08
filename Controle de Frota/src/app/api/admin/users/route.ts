import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizeLoginIdentifier, formatLoginDisplay } from '@/lib/supabase/browser';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const CreateUserSchema = z.object({
  login: z.string().trim().min(2, 'Informe o usuário ou e-mail (mínimo 2 caracteres).'),
  password: z.string().min(4, 'A senha deve ter pelo menos 4 caracteres.'),
  name: z.string().trim().min(2, 'Informe o nome do usuário.'),
  role: z.enum(['ADMIN', 'DRIVER']).default('DRIVER'),
  driverId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const profiles = await prisma.userProfile.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const formatted = profiles.map((p) => ({
    ...p,
    loginDisplay: formatLoginDisplay(p.email),
  }));

  return NextResponse.json(serialize(formatted));
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = CreateUserSchema.parse(await req.json());
    const email = normalizeLoginIdentifier(body.login);
    if (!email) {
      return NextResponse.json({ error: 'Usuário ou e-mail inválido.' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Verifica se já existe perfil com esse email ou para esse motorista
    const existingByEmail = await prisma.userProfile.findUnique({ where: { email } });

    let authUserId = existingByEmail?.id ?? null;

    if (authUserId) {
      // Atualiza senha e metadados no Supabase Auth
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: body.role },
        user_metadata: { name: body.name, role: body.role },
      });
      if (updateErr) {
        return NextResponse.json({ error: `Erro ao atualizar credenciais: ${updateErr.message}` }, { status: 400 });
      }
    } else {
      // Tenta criar no Supabase Auth
      const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: body.role },
        user_metadata: { name: body.name, role: body.role },
      });

      if (createErr || !createdAuth?.user) {
        // Caso o usuário já exista em auth.users mas não em user_profiles
        const rows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1
        `;
        if (rows.length > 0) {
          authUserId = rows[0].id;
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password: body.password,
            email_confirm: true,
            app_metadata: { role: body.role },
            user_metadata: { name: body.name, role: body.role },
          });
        } else {
          return NextResponse.json(
            { error: createErr?.message || 'Não foi possível criar o login no servidor de autenticação.' },
            { status: 400 }
          );
        }
      } else {
        authUserId = createdAuth.user.id;
      }
    }

    const profile = await prisma.userProfile.upsert({
      where: { id: authUserId! },
      create: {
        id: authUserId!,
        email,
        name: body.name,
        role: body.role,
        active: true,
        driverId: body.driverId || null,
        truckId: body.truckId || null,
      },
      update: {
        email,
        name: body.name,
        role: body.role,
        active: true,
        driverId: body.driverId !== undefined ? body.driverId || null : undefined,
        truckId: body.truckId !== undefined ? body.truckId || null : undefined,
      },
    });

    return NextResponse.json(
      serialize({
        ...profile,
        loginDisplay: formatLoginDisplay(profile.email),
      }),
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues.map((i) => i.message).join(' ') }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Erro ao salvar acesso do usuário.' }, { status: 500 });
  }
}
