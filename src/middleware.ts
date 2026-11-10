import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type Role = 'ADMIN' | 'DRIVER';

const PUBLIC_PATHS = ['/login'];
const DRIVER_PAGE_PREFIXES = ['/app/driver'];
const DRIVER_API_PREFIXES = ['/api/driver'];
const DRIVER_HOME = '/app/driver';

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'));

const LONG_LIVED_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      maxAge: LONG_LIVED_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            maxAge: options?.maxAge ?? LONG_LIVED_MAX_AGE,
            path: options?.path ?? '/',
            sameSite: options?.sameSite ?? 'lax',
          })
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = '';
    Object.entries(params ?? {}).forEach(([k, v]) => target.searchParams.set(k, v));
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  const isPublic = startsWithAny(pathname, PUBLIC_PATHS);

  // ---- Sem sessão ---------------------------------------------------------
  if (!user) {
    if (isPublic) return response;
    if (isApi) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    return redirectTo('/login', { next: pathname });
  }

  const role = (user.app_metadata?.role || user.user_metadata?.role) as Role | undefined;
  if (role !== 'ADMIN' && role !== 'DRIVER') {
    if (isApi) return NextResponse.json({ error: 'Usuário sem perfil de acesso.' }, { status: 403 });
    if (isPublic) return response;
    return redirectTo('/login', { error: 'sem-perfil' });
  }

  // ---- Logado tentando abrir /login --------------------------------------
  if (isPublic) return redirectTo(role === 'ADMIN' ? '/' : DRIVER_HOME);

  // ---- ADMIN: acesso total -----------------------------------------------
  if (role === 'ADMIN') return response;

  // ---- DRIVER: apenas a área do motorista --------------------------------
  if (isApi) {
    return startsWithAny(pathname, DRIVER_API_PREFIXES)
      ? response
      : NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
  }
  return startsWithAny(pathname, DRIVER_PAGE_PREFIXES) ? response : redirectTo(DRIVER_HOME);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
