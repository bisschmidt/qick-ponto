import { requireSession } from '@/lib/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileText, FileSpreadsheet, ArrowRight } from 'lucide-react'
import { SectionTabs, adminTabsFor } from '@/components/dashboard/section-tabs'

export default async function ExportacoesPage() {
  const session = await requireSession()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Central de Exportações</h1>
        <p className="text-gray-500 text-sm mt-1">
          Geração de arquivos para fiscalização e folha de pagamento
        </p>
      </div>

      <SectionTabs tabs={adminTabsFor(session.role)} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Fiscal */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-900 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Exportações fiscais</CardTitle>
                <CardDescription>AFD e AEJ — Portaria MTP 671/2021</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Arquivos exigidos pelo Ministério do Trabalho. Assinados digitalmente com certificado ICP-Brasil A1.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/afd">
                Acessar AFD / AEJ
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Folha */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Exportações para folha</CardTitle>
                <CardDescription>Questor, e outros sistemas de folha</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Envio dos eventos apurados (HE, faltas, adicional noturno, etc) para o sistema de folha.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="w-full">
                <Link href="/dashboard/exportacoes/folha">
                  Gerar arquivo
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/exportacoes/folha/configuracao">
                  Configurar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
