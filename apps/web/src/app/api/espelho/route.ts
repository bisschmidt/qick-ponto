import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const res = await fetch(`${API_URL}/v1/espelho/${id}/pdf`, {
    headers: { Authorization: `Bearer ${session.token}` },
  })

  if (!res.ok) return NextResponse.json({ error: 'Erro ao obter PDF' }, { status: res.status })

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="espelho-${id}.pdf"`,
    },
  })
}
