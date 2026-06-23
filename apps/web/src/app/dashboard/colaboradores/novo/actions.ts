'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export async function criarColaboradorAction(_prev: { error?: string } | undefined, formData: FormData) {
  const session = await requireSession()

  const body = {
    nome_completo:     formData.get('nome_completo') as string,
    cpf:               (formData.get('cpf') as string).replace(/\D/g, ''),
    pis_nit:           (formData.get('pis_nit') as string).replace(/\D/g, ''),
    matricula:         formData.get('matricula') as string,
    cnpj_estab_id:     formData.get('cnpj_estab_id') as string,
    regime:            formData.get('regime') as string,
    tipo_jornada_id:   formData.get('tipo_jornada_id') as string,
    data_admissao:     formData.get('data_admissao') as string,
    centro_custo:      formData.get('centro_custo') as string,
    operacao_cliente:  formData.get('operacao_cliente') as string,
    email_corporativo: formData.get('email_corporativo') as string || undefined,
    whatsapp:          formData.get('whatsapp') as string || undefined,
  }

  try {
    await api.post('/v1/colaboradores', body, session.token)
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message }
    return { error: 'Erro ao cadastrar colaborador' }
  }

  redirect('/dashboard/colaboradores')
}
