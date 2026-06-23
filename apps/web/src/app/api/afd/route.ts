import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const cnpjEstabId = searchParams.get('cnpj_estab_id')
  const dataInicio  = searchParams.get('data_inicio')
  const dataFim     = searchParams.get('data_fim')

  if (!cnpjEstabId || !dataInicio || !dataFim) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios' }, { status: 400 })
  }

  const url = `${API_URL}/v1/afd/gerar?cnpj_estab_id=${cnpjEstabId}&data_inicio=${dataInicio}&data_fim=${dataFim}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Erro ao gerar AFD' }, { status: res.status })
  }

  const buffer = await res.arrayBuffer()
  const filename = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'AFD.txt'
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
