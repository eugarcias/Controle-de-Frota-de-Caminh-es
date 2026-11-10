import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a SERVICE ROLE KEY: ignora RLS e pode criar usuários e definir app_metadata.
 * Só pode ser executado em ambiente servidor (nunca exponha esta chave com prefixo NEXT_PUBLIC_).
 */
export function createSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseAdmin só pode ser chamado no servidor.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL não configurados.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const RECEIPTS_BUCKET = 'receipts';
