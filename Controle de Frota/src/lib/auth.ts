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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* leitura apenas: a renovação de cookies é feita pelo middleware */
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await prisma.userProfile.findUnique({ where: { id: user.id } });
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

/** Motorista logado e vinculado a um cadastro de motorista (admin também passa, se vinculado). */
export async function requireDriver(): Promise<Guard<UserProfile & { driverId: string }>> {
  const profile = await getAuthProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  if (!profile.driverId)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Usuário sem motorista vinculado. Fale com o administrador.' }, { status: 403 }),
    };
  return { ok: true, profile: profile as UserProfile & { driverId: string } };
}

/** Caminhões que o motorista pode usar: o padrão do perfil + os de fretes em aberto dele. */
export async function allowedTruckIds(profile: { driverId: string; truckId: string | null }) {
  const trips = await prisma.freightTrip.findMany({
    where: { driverId: profile.driverId, status: { in: ['PLANEJADO', 'EM_VIAGEM'] } },
    select: { truckId: true },
  });
  return Array.from(new Set([...(profile.truckId ? [profile.truckId] : []), ...trips.map((t) => t.truckId)]));
}
