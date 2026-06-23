// Bater ponto de Hora Extra — gera marcação real (lastro AFD) contra uma HE
// previamente AGUARDANDO_MARCACAO. Reusa persistirMarcacao do M2.

import type { PrismaClient, TipoMarcacao } from '@prisma/client'
import { Queue } from 'bullmq'
import { persistirMarcacao } from '../m2-marcacao/gravar.js'
import { heService } from './service.js'

export interface BaterHeInput {
  canal?: string | undefined
  latitude?: number | null | undefined
  longitude?: number | null | undefined
  imagem_ref?: string | null | undefined
  timestamp_device?: string | null | undefined
}

export function marcacaoHe(db: PrismaClient, redisUrl: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crptQueue = redisUrl ? new Queue('crpt', { connection: { url: redisUrl } as any }) : null
  const he = heService(db)

  return {
    async baterHe(colaboradorId: string, tenantId: string, input: BaterHeInput) {
      const colaborador = await db.colaborador.findFirst({
        where: { id: colaboradorId, tenant_id: tenantId },
        include: { cnpj_estab: true },
      })
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
      if (!colaborador.onboarding_ok) {
        throw { statusCode: 403, message: 'Aceite do Aviso de Tratamento de Dados pendente' }
      }

      // Dia de hoje em BRT (UTC-3)
      const hojeBRT = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
      const dataHoje = new Date(`${hojeBRT}T00:00:00Z`)

      // HE de hoje pendente de marcação (entrada e/ou saída)
      const pendentes = await db.heExtra.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data: dataHoje,
          status: 'AGUARDANDO_MARCACAO',
        },
        orderBy: { hora_inicio: 'asc' },
      })

      // Prioriza a que já tem entrada (precisa fechar com saída), senão a primeira sem entrada
      const aFechar = pendentes.find((h) => h.entrada_marcacao_id && !h.saida_marcacao_id)
      const aAbrir = pendentes.find((h) => !h.entrada_marcacao_id)
      const heAlvo = aFechar ?? aAbrir
      if (!heAlvo) {
        throw { statusCode: 422, message: 'Nenhuma hora extra pendente de marcação para hoje' }
      }

      const ehCompensacao = heAlvo.tipo === 'COMPENSACAO' || !!heAlvo.compensacao_id
      const ehEntrada = !heAlvo.entrada_marcacao_id
      const tipo: TipoMarcacao = ehEntrada
        ? (ehCompensacao ? 'ENTRADA_COMPENSACAO' : 'ENTRADA_HE')
        : (ehCompensacao ? 'SAIDA_COMPENSACAO' : 'SAIDA_HE')

      const { marcacao, nsr, timestampMarcacao } = await persistirMarcacao(db, crptQueue, {
        tenantId,
        cnpjEstab: colaborador.cnpj_estab,
        colaborador,
        tipo,
        canal: input.canal ?? 'APP_MOBILE',
        timestampDevice: input.timestamp_device ?? null,
        imagemRef: input.imagem_ref ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      })

      if (ehEntrada) {
        await db.heExtra.update({ where: { id: heAlvo.id }, data: { entrada_marcacao_id: marcacao.id } })
      } else {
        await db.heExtra.update({
          where: { id: heAlvo.id },
          data: { saida_marcacao_id: marcacao.id, status: 'REALIZADA' },
        })
        // Dispara o destino (banco ou folha) com a HE já realizada
        await he.aplicarDestino({
          id: heAlvo.id,
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data: heAlvo.data,
          hora_inicio: heAlvo.hora_inicio,
          hora_fim: heAlvo.hora_fim,
          tipo: heAlvo.tipo,
          compensacao_id: heAlvo.compensacao_id,
        })
      }

      return {
        nsr: nsr.toString(),
        tipo,
        timestamp_marcacao: timestampMarcacao.toISOString(),
        he_id: heAlvo.id,
        concluida: !ehEntrada,
      }
    },
  }
}
