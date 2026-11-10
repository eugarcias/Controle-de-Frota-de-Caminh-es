import { createBrowserClient } from '@supabase/ssr';

export const INTERNAL_DOMAIN = '@frota.com';

/**
 * Normaliza o nome de usuário digitado (ex: "admin", "motorista", "carlos")
 * para o formato interno exigido pelo Supabase Auth.
 * NUNCA é exibido para o usuário final — todo o sistema opera apenas como usuário.
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

/**
 * Remove qualquer sufixo interno para exibir SEMPRE apenas o nome do usuário limpo.
 */
export function formatLoginDisplay(emailOrLogin?: string | null): string {
  if (!emailOrLogin) return '';
  if (emailOrLogin.endsWith(INTERNAL_DOMAIN)) {
    return emailOrLogin.slice(0, -INTERNAL_DOMAIN.length);
  }
  if (emailOrLogin.endsWith('@acesso.vsmfrota.com')) {
    return emailOrLogin.slice(0, -'@acesso.vsmfrota.com'.length);
  }
  if (emailOrLogin.endsWith('@empresa.com')) {
    return emailOrLogin.slice(0, -'@empresa.com'.length);
  }
  return emailOrLogin;
}

/**
 * Cliente Supabase para navegador com sessão persistente de longa duração (1 ano),
 * garantindo que o motorista ou administrador não precise redigitar a senha toda vez.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365, // 365 dias
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
