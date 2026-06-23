import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { GerarAfdForm } from './gerar-afd-form'
import { fmtDataCurta } from '@/lib/utils'

interface Historico {
  id: string
  cnpj: string
  tipo: string
  data_inicio: string
  data_fim: string
  gerado_at: string
}

interface CnpjEstab { id: string; cnpj: string; razao_social: string }

export default async function AfdPage() {
  const session = await requireSession()
  const [historico, estabs] = await Promise.all([
    api.get<Historico[]>('/v1/afd/historico', session.token).catch(() => []),
    api.get<CnpjEstab[]>('/v1/cnpjs', session.token).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AFD / AEJ</h1>
        <p className="text-gray-500 text-sm mt-1">Arquivos fiscais Portaria MTP 671/2021</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerar arquivo</CardTitle>
          <CardDescription>O arquivo será gerado no formato ISO 8859-1 com CRC-16 e SHA-256 conforme Anexos V e VI.</CardDescription>
        </CardHeader>
        <CardContent>
          <GerarAfdForm estabs={estabs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de geração</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historico.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhum arquivo gerado ainda</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">CNPJ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Período</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Gerado em</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{h.cnpj}</td>
                    <td className="px-4 py-3 text-gray-600">{h.tipo}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDataCurta(h.data_inicio)} – {fmtDataCurta(h.data_fim)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDataCurta(h.gerado_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
