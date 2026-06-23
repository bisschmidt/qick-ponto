import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'qick-ponto-dev-secret-2025',
)

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('qp_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const role = payload['role'] as string

    // Colaborador só acessa /ponto
    if (role === 'COLABORADOR' && !pathname.startsWith('/ponto')) {
      return NextResponse.redirect(new URL('/ponto', req.url))
    }

    // Auditor não acessa /admin
    if (role === 'AUDITOR' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('qp_token')
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
