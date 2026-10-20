import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a SERVICE ROLE KEY: ignora RLS e pode criar usuários e definir app_metadata.
 * Só pode ser importado em código de servidor (o pacote 'server-only' quebra o build se vazar
 * para o navegador). Nunca exponha esta chave com prefixo NEXT_PUBLIC_.
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL não configurados.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const RECEIPTS_BUCKET = 'receipts';
