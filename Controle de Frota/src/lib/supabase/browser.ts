import { createBrowserClient } from '@supabase/ssr';

const INTERNAL_DOMAIN = '@acesso.vsmfrota.com';

/**
 * Permite que motoristas e administradores entrem tanto com um usuário simples
 * (ex: "carlos", "vinicius") quanto com um e-mail completo (ex: "teste@frota.com").
 */
export function normalizeLoginIdentifier(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  const cleanUser = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '');
  return `${cleanUser}${INTERNAL_DOMAIN}`;
}

/** Exibe o usuário de forma amigável (oculta o domínio interno se foi criado apenas com nome de usuário). */
export function formatLoginDisplay(email?: string | null): string {
  if (!email) return '';
  if (email.endsWith(INTERNAL_DOMAIN)) {
    return email.slice(0, -INTERNAL_DOMAIN.length);
  }
  return email;
}

/**
 * Cliente Supabase para navegador com sessão persistente de longa duração (1 ano),
 * garantindo que o motorista não precise digitar a senha toda vez que abrir o app.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365, // 365 dias salvo no celular/navegador
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
