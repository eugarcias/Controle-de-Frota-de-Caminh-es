import { createBrowserClient } from '@supabase/ssr';

/** Cliente Supabase para componentes de navegador (login/logout). Usa apenas a anon key. */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
}
