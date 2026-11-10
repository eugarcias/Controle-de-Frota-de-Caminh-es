import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { normalizeLoginIdentifier, formatLoginDisplay } from '@/lib/supabase/browser';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const CreateUserSchema = z.object({
  login: z.string().trim().min(2, 'Informe o nome de usuário (mínimo 2 caracteres).'),
  password: z.string().min(4, 'A senha deve ter pelo menos 4 caracteres.'),
  name: z.string().trim().min(2, 'Informe o nome da pessoa.'),
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
      return NextResponse.json({ error: 'Usuário inválido.' }, { status: 400 });
    }

    // 1. Verifica se já existe em auth.users
    const existing = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id FROM auth.users WHERE lower(email) = lower($1)',
      email
    );

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      await prisma.$executeRawUnsafe(
        `
        UPDATE auth.users
        SET encrypted_password = crypt($1, gen_salt('bf')),
            email_confirmed_at = now(),
            updated_at = now(),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', $2::text),
            raw_user_meta_data = jsonb_build_object('role', $2::text, 'name', $3::text)
        WHERE id = $4::uuid
      `,
        body.password,
        body.role,
        body.name,
        userId
      );
    } else {
      userId = randomUUID();
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
          is_super_admin, role, aud,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          email_change_token_current, phone_change, phone_change_token, reauthentication_token
        ) VALUES (
          $1::uuid, '00000000-0000-0000-0000-000000000000'::uuid, $2,
          crypt($3, gen_salt('bf')), now(), now(), now(),
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', $4::text),
          jsonb_build_object('role', $4::text, 'name', $5::text),
          false, 'authenticated', 'authenticated',
          '', '', '', '', '', '', '', ''
        )
      `,
        userId,
        email,
        body.password,
        body.role,
        body.name
      );

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          $1::uuid, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text),
          'email', $1::text, now(), now(), now()
        )
        ON CONFLICT (provider_id, provider) DO UPDATE
        SET identity_data = jsonb_build_object('sub', $1::text, 'email', $2::text),
            updated_at = now()
      `,
        userId,
        email
      );
    }

    // 2. Atualiza ou cria na tabela userProfile
    const profile = await prisma.userProfile.upsert({
      where: { id: userId },
      create: {
        id: userId,
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
    return NextResponse.json({ error: 'Erro ao salvar usuário e senha.' }, { status: 500 });
  }
}
