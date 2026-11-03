import { prisma } from '../src/lib/prisma';

/**
 * Script para cadastrar ou atualizar usuários (Administrador ou Motorista)
 * 
 * Uso:
 *   npx tsx --env-file=.env scripts/create-user.ts <email> <senha> <nome> <role: ADMIN|DRIVER> [driverId] [truckId]
 * 
 * Exemplo:
 *   npx tsx --env-file=.env scripts/create-user.ts admin@empresa.com SenhaForte123 "João Admin" ADMIN
 */
async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4];
  const role = (process.argv[5] || 'ADMIN').toUpperCase();
  const driverId = process.argv[6] || null;
  const truckId = process.argv[7] || null;

  if (!email || !password || !name) {
    console.log(`
Uso:
  npx tsx --env-file=.env scripts/create-user.ts <email> <senha> <nome> <role: ADMIN|DRIVER> [driverId] [truckId]

Exemplo:
  npx tsx --env-file=.env scripts/create-user.ts gestor@empresa.com 123456 "Gestor da Frota" ADMIN
    `);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados no .env');
  }

  console.log(`\n⏳ Cadastrando usuário: ${email}...`);

  // 1. Cadastra no Supabase Auth via API
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const authData = await res.json();

  if (!res.ok && !authData.id) {
    throw new Error(`Erro no Supabase Auth: ${JSON.stringify(authData)}`);
  }

  const userId = authData.id || authData.user?.id;

  // 2. Confirma o e-mail e aplica o app_metadata (role) diretamente
  await prisma.$executeRawUnsafe(`
    UPDATE auth.users
    SET email_confirmed_at = now(),
        raw_app_meta_data = raw_app_meta_data || '{"role": "${role}"}'::jsonb
    WHERE email = '${email}';
  `);

  // 3. Atualiza ou cria na tabela user_profiles do sistema
  await prisma.userProfile.upsert({
    where: { email },
    create: {
      id: userId,
      email,
      name,
      role: role as any,
      active: true,
      driverId,
      truckId,
    },
    update: {
      name,
      role: role as any,
      active: true,
      driverId,
      truckId,
    },
  });

  console.log(`\n✅ Usuário ${role} criado e ativado com sucesso!`);
  console.log(`   E-mail: ${email}`);
  console.log(`   Nome:   ${name}`);
  console.log(`   Perfil: ${role}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Falha:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
