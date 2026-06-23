'use client'

import { useActionState } from 'react'
import { criarColaboradorAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface Jornada { id: string; nome: string; tipo: string }
interface CnpjEstab { id: string; cnpj: string; razao_social: string }

export function NovoColaboradorForm({ jornadas, estabs }: { jornadas: Jornada[]; estabs: CnpjEstab[] }) {
  const [state, action, isPending] = useActionState(criarColaboradorAction, undefined)

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados pessoais</h2>

          <Field label="Nome completo *" name="nome_completo" placeholder="Ex: Maria da Silva" required />

          <div className="grid grid-cols-2 gap-4">
            <Field label="CPF *" name="cpf" placeholder="000.000.000-00" required />
            <Field label="PIS/NIT *" name="pis_nit" placeholder="000.00000.00-0" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email corporativo" name="email_corporativo" type="email" placeholder="nome@empresa.com" />
            <Field label="WhatsApp" name="whatsapp" placeholder="11999998888" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados contratuais</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Matrícula *" name="matricula" placeholder="Ex: 001234" required />
            <Field label="Data de admissão *" name="data_admissao" type="date" required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Regime *</label>
            <select name="regime" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="CLT">CLT</option>
              <option value="APRENDIZ">Aprendiz</option>
              <option value="ESTAGIO">Estágio</option>
              <option value="PJ">PJ</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Centro de custo *" name="centro_custo" placeholder="Ex: Atendimento" required />
            <Field label="Operação / cliente *" name="operacao_cliente" placeholder="Ex: Pessoalize" required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Vínculo</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Estabelecimento (CNPJ) *</label>
            <select name="cnpj_estab_id" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Selecione...</option>
              {estabs.map((e) => (
                <option key={e.id} value={e.id}>{e.razao_social} — {e.cnpj}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Jornada de trabalho *</label>
            <select name="tipo_jornada_id" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Selecione...</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>{j.nome} ({j.tipo})</option>
              ))}
            </select>
            {jornadas.length === 0 && (
              <p className="text-xs text-amber-600">Nenhuma jornada cadastrada. <a href="/dashboard/jornadas/nova" className="underline">Cadastre uma jornada primeiro.</a></p>
            )}
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Cadastrar colaborador
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button>
      </div>
    </form>
  )
}

function Field({ label, name, type = 'text', placeholder, required }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  )
}
