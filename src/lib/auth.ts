import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { UserProfile } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Autorização dentro das rotas /api (defesa em profundidade: o middleware já filtra por
 * app_metadata.role; aqui o papel é conferido de novo na tabela user_profiles, que é a
 * fonte da verdade e permite desativar um usuário na hora).
 */
export async function getAuthProfile(): Promise<UserProfile | null> {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Em ambiente local sem variáveis de Auth, retorna o primeiro admin cadastrado
    return prisma.userProfile.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        /* renovação de cookies feita no middleware */
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let profile = await prisma.userProfile.findUnique({ where: { id: user.id } });
  if (!profile && user.email) {
    profile = await prisma.userProfile.findUnique({ where: { email: user.email } });
  }
  return profile && profile.active ? profile : null;
}

type Guard<T> = { ok: true; profile: T } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<Guard<UserProfile>> {
  const profile = await getAuthProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  if (profile.role !== 'ADMIN')
    return { ok: false, response: NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 }) };
  return { ok: true, profile };
}

/**
 * Motorista logado e vinculado a um cadastro de motorista.
 * Se o perfil ainda não tiver driverId preenchido, vincula automaticamente pelo nome ou ao 1º motorista ativo.
 */
export async function requireDriver(): Promise<Guard<UserProfile & { driverId: string }>> {
  const profile = await getAuthProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };

  let driverId = profile.driverId;
  if (!driverId) {
    const byName = await prisma.driver.findFirst({
      where: { name: { equals: profile.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byName) {
      driverId = byName.id;
      await prisma.userProfile.update({ where: { id: profile.id }, data: { driverId } }).catch(() => {});
    } else {
      const firstDriver = await prisma.driver.findFirst({
        where: { status: 'ATIVO' },
        orderBy: { name: 'asc' },
        select: { id: true },
      });
      driverId = firstDriver?.id ?? null;
    }
  }

  if (!driverId)
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Nenhum motorista cadastrado no sistema. Peça ao administrador para cadastrar.' },
        { status: 403 }
      ),
    };
  return { ok: true, profile: { ...profile, driverId } };
}

/**
 * Caminhões que o motorista pode utilizar:
 * Todos os caminhões ativos da frota + caminhão preferido do perfil + caminhões em viagem.
 */
export async function allowedTruckIds(profile: { role?: string; driverId: string; truckId: string | null }) {
  if (profile.role === 'ADMIN') {
    const all = await prisma.truck.findMany({ select: { id: true }, orderBy: { plate: 'asc' } });
    return all.map((t) => t.id);
  }
  const [activeTrucks, trips] = await Promise.all([
    prisma.truck.findMany({
      where: { status: { in: ['ATIVO', 'MANUTENCAO'] } },
      select: { id: true },
      orderBy: { plate: 'asc' },
    }),
    prisma.freightTrip.findMany({
      where: { driverId: profile.driverId, status: { in: ['PLANEJADO', 'EM_VIAGEM'] } },
      select: { truckId: true },
    }),
  ]);
  return Array.from(
    new Set([
      ...(profile.truckId ? [profile.truckId] : []),
      ...trips.map((t) => t.truckId),
      ...activeTrucks.map((t) => t.id),
    ])
  );
}
