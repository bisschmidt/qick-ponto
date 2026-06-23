import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = `${API_URL}/v1/exportacao-folha/gerar?${req.nextUrl.searchParams.toString()}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.token}` } })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro ao gerar' }))
    return NextResponse.json(body, { status: res.status })
  }

  const buffer = await res.arrayBuffer()
  const filename = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'export.txt'
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
