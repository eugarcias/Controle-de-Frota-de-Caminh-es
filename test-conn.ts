import { prisma } from './src/lib/prisma';

async function main() {
  const t0 = Date.now();
  const trucks = await prisma.truck.count();
  console.log(`CONEXAO_OK em ${Date.now() - t0}ms. Caminhoes: ${trucks}`);
}

main()
  .catch((e) => {
    console.error('FALHA_CONEXAO:', e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
