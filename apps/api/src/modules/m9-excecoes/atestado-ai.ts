// Análise de atestado via Claude API (vision/PDF).
// Quando ANTHROPIC_API_KEY estiver setado, extrai nome, datas, CID, médico e
// sinaliza anomalias (nome diferente, data fora do informado, ilegível).

import Anthropic from '@anthropic-ai/sdk'

export interface AnaliseAtestado {
  ehAtestado: boolean
  nomePaciente: string | null
  cpfPaciente: string | null
  dataAtestado: string | null     // YYYY-MM-DD
  diasAfastamento: number | null
  cid: string | null
  nomeMedico: string | null
  crmMedico: string | null
  observacoes: string | null
  anomalias: string[]
  resumo: string
}

const SYSTEM = `Você é um analista de RH que valida atestados médicos.
Receberá um arquivo (PDF ou imagem) de atestado e os dados do colaborador.
Extraia informações estruturadas e sinalize anomalias.

Anomalias relevantes:
- "Documento não parece um atestado médico"
- "Nome do paciente difere do colaborador"
- "CPF não bate com o colaborador"
- "Data do atestado fora do período informado"
- "Sem assinatura/CRM do médico"
- "Documento ilegível ou suspeito"

Retorne APENAS um objeto JSON válido, sem texto antes ou depois, no formato:
{
  "ehAtestado": boolean,
  "nomePaciente": string|null,
  "cpfPaciente": string|null,
  "dataAtestado": "YYYY-MM-DD"|null,
  "diasAfastamento": number|null,
  "cid": string|null,
  "nomeMedico": string|null,
  "crmMedico": string|null,
  "observacoes": string|null,
  "anomalias": string[],
  "resumo": string
}`

interface ContextoAnalise {
  nomeColaborador: string
  cpfColaborador: string
  dataInicioInformada: string
  dataFimInformada: string
}

export async function analisarAtestado(
  arquivo: Buffer,
  mediaType: string,
  ctx: ContextoAnalise,
): Promise<AnaliseAtestado | null> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return null // IA desativada; o ajuste ainda é criado, sem análise

  const client = new Anthropic({ apiKey })

  const base64 = arquivo.toString('base64')
  const isPdf = mediaType === 'application/pdf'

  const contexto = `Dados informados pelo colaborador:
- Nome: ${ctx.nomeColaborador}
- CPF: ${ctx.cpfColaborador}
- Período de afastamento: ${ctx.dataInicioInformada} a ${ctx.dataFimInformada}`

  type Block =
    | { type: 'text'; text: string }
    | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }

  const content: Block[] = [
    { type: 'text', text: contexto },
  ]

  if (isPdf) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    })
  } else {
    const mt = (mediaType === 'image/jpg' ? 'image/jpeg' : mediaType) as
      'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mt, data: base64 },
    })
  }

  content.push({
    type: 'text',
    text: 'Analise o atestado acima e retorne o JSON estruturado.',
  })

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const textBlock = msg.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as AnaliseAtestado
    return parsed
  } catch (err) {
    console.error('Erro análise atestado:', err)
    return null
  }
}
