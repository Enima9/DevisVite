import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Économie : sans cookie de session Supabase (« sb-… »), personne n'est connecté.
  // On répond sans appeler Supabase (aucun aller-retour réseau pour les visiteurs anonymes).
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (!hasSessionCookie) {
    if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  // Filet de sécurité : si la configuration manque, on laisse passer la requête
  // au lieu de faire planter tout le site (erreur 500 MIDDLEWARE_EXECUTION_FAILED).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'DevisVite : variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)'
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isPublicRoute = isPublicPath(pathname);

    // Accueil public : un utilisateur connecté va directement à son espace.
    if (user && pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirectResponse.cookies.set(cookie.name, cookie.value));
      return redirectResponse;
    }

    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const redirectResponse = NextResponse.redirect(url);
      // On recopie les cookies rafraîchis sur la redirection (recommandation Supabase)
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirectResponse.cookies.set(cookie.name, cookie.value));
      return redirectResponse;
    }
  } catch (error) {
    // En cas de panne Supabase, on laisse passer plutôt que d'afficher une erreur 500.
    // Les pages protégées (dashboard, devis…) refont leur propre vérification côté serveur.
    console.error('DevisVite middleware : erreur Supabase', error);
    return supabaseResponse;
  }

  return supabaseResponse;
}

/** Pages publiques (consultables sans compte) : accueil et informations légales. */
const PUBLIC_PAGES = ['/', '/mentions-legales', '/confidentialite', '/cgu', '/cookies', '/cgv'];

/** Routes accessibles sans être connecté. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/q/') ||
    pathname === '/api/stripe/webhook' ||
    PUBLIC_PAGES.includes(pathname)
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
