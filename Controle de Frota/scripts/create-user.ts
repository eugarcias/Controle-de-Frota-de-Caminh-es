import { prisma } from '../src/lib/prisma';
import { normalizeLoginIdentifier, formatLoginDisplay } from '../src/lib/supabase/browser';

/**
 * Script para cadastrar ou atualizar usuários (Administrador ou Motorista)
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/create-user.ts <usuario_ou_email> <senha> <nome> <role: ADMIN|DRIVER> [driverId] [truckId]
 *
 * Exemplo:
 *   npx tsx --env-file=.env scripts/create-user.ts vinicius 123456 "Vinicius Garcia" ADMIN
 */
async function main() {
  const rawLogin = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4];
  const role = (process.argv[5] || 'ADMIN').toUpperCase();
  const driverId = process.argv[6] || null;
  const truckId = process.argv[7] || null;

  if (!rawLogin || !password || !name) {
    console.log(`
Uso:
  npx tsx --env-file=.env scripts/create-user.ts <usuario_ou_email> <senha> <nome> <role: ADMIN|DRIVER> [driverId] [truckId]

Exemplo:
  npx tsx --env-file=.env scripts/create-user.ts vinicius 123456 "Vinicius Garcia" ADMIN
    `);
    process.exit(1);
  }

  const email = normalizeLoginIdentifier(rawLogin);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados no .env');
  }

  console.log(`\n⏳ Cadastrando usuário: ${formatLoginDisplay(email)} (${email})...`);

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const authData = await res.json();
  let userId = authData.id || authData.user?.id;

  if (!userId) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1
    `;
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      throw new Error(`Erro no Supabase Auth: ${JSON.stringify(authData)}`);
    }
  }

  await prisma.$executeRawUnsafe(`
    UPDATE auth.users
    SET email_confirmed_at = now(),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "${role}"}'::jsonb
    WHERE lower(email) = lower('${email}');
  `);

  await prisma.userProfile.upsert({
    where: { email },
    create: {
      id: userId,
      email,
      name,
      role: role as 'ADMIN' | 'DRIVER',
      active: true,
      driverId,
      truckId,
    },
    update: {
      name,
      role: role as 'ADMIN' | 'DRIVER',
      active: true,
      driverId,
      truckId,
    },
  });

  console.log(`\n✅ Usuário ${role} criado e ativado com sucesso!`);
  console.log(`   Usuário: ${formatLoginDisplay(email)}`);
  console.log(`   Nome:    ${name}`);
  console.log(`   Perfil:  ${role}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Falha:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
