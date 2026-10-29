import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  // One address for search engines: www.hyderabad.properties redirects permanently to the bare domain.
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(':')[0];
  if (host.startsWith('www.')) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host.slice(4)}`);
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = req.nextUrl;
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  if (!isAdmin) return NextResponse.next();
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next();

  const user = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (user) {
    const headers = new Headers(req.headers);
    headers.set('x-admin-user', user);
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's static files, so the www redirect covers every page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
