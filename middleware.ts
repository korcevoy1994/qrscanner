import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Публичные маршруты, которые не требуют авторизации
const publicPaths = ['/login', '/api/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Разрешаем доступ к публичным маршрутам
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Разрешаем доступ к статическим файлам
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Проверяем наличие токена авторизации
  const token = request.cookies.get('scanner_token');

  if (!token) {
    // Если токена нет, перенаправляем на страницу входа
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
