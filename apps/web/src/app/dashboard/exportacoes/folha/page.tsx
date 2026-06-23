import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { GerarFolhaForm } from './gerar-folha-form'
import { fmtDataCurta } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Settings } from 'lucide-react'

interface CnpjEstab { id: string; cnpj: string; razao_social: string }
interface Historico {
  id: string
  sistema: string
  competencia_ini: string
  competencia_fim: string
  total_linhas: number
  nome_arquivo: string
  created_at: string
}

const SISTEMA = 'QUESTOR'

export default async function ExportacaoFolhaPage() {
  const session = await requireSession()
  const [estabs, historico] = await Promise.all([
    api.get<CnpjEstab[]>('/v1/cnpjs', session.token).catch(() => []),
    api.get<Historico[]>(`/v1/exportacao-folha/historico?sistema=${SISTEMA}`, session.token).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/exportacoes" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" />
          Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exportar para folha</h1>
            <p className="text-gray-500 text-sm mt-1">
              Gera o arquivo com os eventos apurados (HE, faltas, adicional noturno, etc)
            </p>
          </div>
          <Link
            href="/dashboard/exportacoes/folha/configuracao"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-100"
          >
            <Settings className="h-4 w-4" />
            Configurar
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <GerarFolhaForm sistema={SISTEMA} estabs={estabs} />
        </CardContent>
      </Card>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Histórico</h2>
        <Card>
          <CardContent className="p-0">
            {historico.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma exportação gerada ainda</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="text-left px-4 py-3 font-medium">Sistema</th>
                    <th className="text-left px-4 py-3 font-medium">Competência</th>
                    <th className="text-left px-4 py-3 font-medium">Linhas</th>
                    <th className="text-left px-4 py-3 font-medium">Arquivo</th>
                    <th className="text-left px-4 py-3 font-medium">Gerado em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{h.sistema}</td>
                      <td className="px-4 py-3">{fmtDataCurta(h.competencia_ini)} – {fmtDataCurta(h.competencia_fim)}</td>
                      <td className="px-4 py-3">{h.total_linhas}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.nome_arquivo}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDataCurta(h.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
