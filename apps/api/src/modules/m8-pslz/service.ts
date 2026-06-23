import type { PrismaClient } from '@prisma/client'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Payload enviado à PSLZ Pay após fechamento de período
interface EventoFolhaPonto {
  evento: 'folha.eventos_ponto'
  periodo: { inicio: string; fim: string }
  cnpj: string
  colaboradores: Array<{
    cpf: string
    matricula: string
    he_50_minutos: number
    he_100_minutos: number
    ad_noturno_minutos: number
    atraso_minutos: number
    faltas: number
    dias_trabalhados: number
  }>
}

// Evento recebido da PSLZ
interface EventoDesligamento {
  evento: 'colaborador.desligado'
  cpf: string
  cnpj: string
  data_desligamento: string // YYYY-MM-DD
}

export function m8Service(db: PrismaClient) {
  return {
    // Configura (ou atualiza) a integração PSLZ do tenant
    async configurarIntegracao(
      tenantId: string,
      endpointUrl: string,
      apiKey: string,
      webhookSecret: string,
    ) {
      // Criptografia real deve ser feita com KMS/AWS Secrets Manager em produção.
      // Em dev, armazena em base64 como placeholder (não é segurança real).
      const apiKeyEnc = Buffer.from(apiKey).toString('base64')
      const secretEnc = Buffer.from(webhookSecret).toString('base64')

      return db.integracaoPslz.upsert({
        where: { tenant_id: tenantId },
        create: {
          tenant_id: tenantId,
          endpoint_url: endpointUrl,
          api_key_enc: apiKeyEnc,
          webhook_secret_enc: secretEnc,
        },
        update: {
          endpoint_url: endpointUrl,
          api_key_enc: apiKeyEnc,
          webhook_secret_enc: secretEnc,
        },
      })
    },

    // Envia eventos de ponto para a PSLZ Pay após fechamento de período
    async enviarEventosFolha(tenantId: string, periodoId: string, cnpjEstabId: string) {
      const config = await db.integracaoPslz.findUnique({
        where: { tenant_id: tenantId },
      })
      if (!config || !config.ativo) {
        return { enviado: false, motivo: 'Integração PSLZ não configurada ou inativa' }
      }

      const periodo = await db.periodoFechamento.findFirst({
        where: { id: periodoId, tenant_id: tenantId },
      })
      if (!periodo) throw new Error('Período não encontrado')

      const estab = await db.cnpjEstabelecimento.findFirst({
        where: { id: cnpjEstabId, tenant_id: tenantId },
      })
      if (!estab) throw new Error('Estabelecimento não encontrado')

      // Busca totais da apuração do período por colaborador
      const resumos = await db.jornadaApurada.groupBy({
        by: ['colaborador_id'],
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: periodo.data_inicio, lte: periodo.data_fim },
        },
        _sum: {
          minutos_he_50: true,
          minutos_he_100: true,
          minutos_ad_noturno: true,
          minutos_atraso: true,
          minutos_trabalhados: true,
        },
        _count: { _all: true },
      })

      const colaboradorIds = resumos.map((r) => r.colaborador_id)
      const colaboradores = await db.colaborador.findMany({
        where: { id: { in: colaboradorIds }, tenant_id: tenantId },
        select: { id: true, cpf: true, matricula: true },
      })

      const faltas = await db.jornadaApurada.groupBy({
        by: ['colaborador_id'],
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: periodo.data_inicio, lte: periodo.data_fim },
          status: 'FALTA',
        },
        _count: { _all: true },
      })
      const faltasPorColab = new Map(faltas.map((f) => [f.colaborador_id, f._count._all]))

      const coLabMap = new Map(colaboradores.map((c) => [c.id, c]))

      const payload: EventoFolhaPonto = {
        evento: 'folha.eventos_ponto',
        periodo: {
          inicio: periodo.data_inicio.toISOString().slice(0, 10),
          fim: periodo.data_fim.toISOString().slice(0, 10),
        },
        cnpj: estab.cnpj,
        colaboradores: resumos.map((r) => {
          const colab = coLabMap.get(r.colaborador_id)
          return {
            cpf: colab?.cpf ?? '',
            matricula: colab?.matricula ?? '',
            he_50_minutos: r._sum.minutos_he_50 ?? 0,
            he_100_minutos: r._sum.minutos_he_100 ?? 0,
            ad_noturno_minutos: r._sum.minutos_ad_noturno ?? 0,
            atraso_minutos: r._sum.minutos_atraso ?? 0,
            faltas: faltasPorColab.get(r.colaborador_id) ?? 0,
            dias_trabalhados: r._count._all,
          }
        }),
      }

      const apiKey = Buffer.from(config.api_key_enc, 'base64').toString()

      let status = 'ENVIADO'
      let resposta: unknown = null
      let erroMsg: string | null = null

      try {
        const response = await fetch(config.endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        })

        resposta = { status: response.status, ok: response.ok }
        if (!response.ok) {
          status = 'ERRO'
          erroMsg = `HTTP ${response.status}`
        }
      } catch (err) {
        status = 'ERRO'
        erroMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      }

      await db.webhookPslzLog.create({
        data: {
          tenant_id: tenantId,
          direcao: 'SAIDA',
          evento: 'folha.eventos_ponto',
          payload: payload as object,
          status,
          resposta: resposta as object ?? null,
          erro_msg: erroMsg ?? null,
        },
      })

      return { enviado: status === 'ENVIADO', status, erroMsg }
    },

    // Processa evento de desligamento recebido da PSLZ
    async processarEventoEntrada(
      tenantId: string,
      rawBody: string,
      assinatura: string,
    ) {
      const config = await db.integracaoPslz.findUnique({
        where: { tenant_id: tenantId },
      })
      if (!config) throw new Error('Integração não configurada')

      // Valida assinatura HMAC-SHA256
      const secret = Buffer.from(config.webhook_secret_enc, 'base64').toString()
      const esperado = createHmac('sha256', secret).update(rawBody).digest('hex')
      const recebido = assinatura.replace('sha256=', '')

      const esperadoBuf = Buffer.from(esperado, 'hex')
      const recebidoBuf = Buffer.from(recebido.padEnd(esperado.length, '0').slice(0, esperado.length), 'hex')

      if (esperadoBuf.length !== recebidoBuf.length || !timingSafeEqual(esperadoBuf, recebidoBuf)) {
        throw new Error('Assinatura inválida')
      }

      const evento = JSON.parse(rawBody) as EventoDesligamento

      await db.webhookPslzLog.create({
        data: {
          tenant_id: tenantId,
          direcao: 'ENTRADA',
          evento: evento.evento,
          payload: evento as object,
          status: 'RECEBIDO',
        },
      })

      if (evento.evento === 'colaborador.desligado') {
        await db.colaborador.updateMany({
          where: {
            tenant_id: tenantId,
            cpf: evento.cpf,
          },
          data: {
            ativo: false,
            data_desligamento: new Date(evento.data_desligamento),
          },
        })
        return { processado: true, acao: 'colaborador desligado', cpf: evento.cpf }
      }

      return { processado: true, acao: 'evento ignorado', evento: evento.evento }
    },

    async listarLogs(tenantId: string, limite = 50) {
      return db.webhookPslzLog.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: limite,
      })
    },
  }
}
