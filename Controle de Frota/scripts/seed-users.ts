import { prisma } from '../src/lib/prisma';
import { randomUUID } from 'crypto';

async function upsertUser(
  username: string,
  pass: string,
  name: string,
  role: 'ADMIN' | 'DRIVER',
  driverId: string | null = null,
  truckId: string | null = null
) {
  const email = `${username.toLowerCase().trim()}@frota.com`;

  // 1. Check if user exists in auth.users
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
      pass,
      role,
      name,
      userId
    );
  } else {
    userId = randomUUID();
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, role, aud
      ) VALUES (
        $1::uuid, '00000000-0000-0000-0000-000000000000'::uuid, $2,
        crypt($3, gen_salt('bf')), now(), now(), now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', $4::text),
        jsonb_build_object('role', $4::text, 'name', $5::text),
        false, 'authenticated', 'authenticated'
      )
    `,
      userId,
      email,
      pass,
      role,
      name
    );

    // Insert identity (without generated column email)
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

  // 2. Upsert in user_profiles
  await prisma.userProfile.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name,
      role,
      active: true,
      driverId,
      truckId,
    },
    update: {
      email,
      name,
      role,
      active: true,
      driverId,
      truckId,
    },
  });

  console.log(`✅ Usuário configurado:`);
  console.log(`   Usuário: ${username}`);
  console.log(`   Senha:   ${pass}`);
  console.log(`   Perfil:  ${role}`);
  console.log(`   Nome:    ${name}`);
  console.log(`   ID:      ${userId}\n`);
}

async function main() {
  const driver = await prisma.driver.findFirst({ orderBy: { name: 'asc' } });
  const truck = await prisma.truck.findFirst({ orderBy: { plate: 'asc' } });

  console.log('--- Configurando contas iniciais ---');

  // Conta Admin: admin / 123456
  await upsertUser('admin', '123456', 'Administrador', 'ADMIN');

  // Conta Admin Vinicius: vinicius / 123456
  await upsertUser('vinicius', '123456', 'Vinicius Administrador', 'ADMIN');

  // Conta Motorista: motorista / 123456
  await upsertUser(
    'motorista',
    '123456',
    driver?.name ?? 'Motorista Frota',
    'DRIVER',
    driver?.id ?? null,
    truck?.id ?? null
  );

  console.log('Todas as contas foram criadas e atualizadas com sucesso no banco!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
