import type { PrismaClient } from '@prisma/client'
import { duracaoMinutos } from './validacoes.js'

// Status de HE que ocupam a "cota" de limites (ativas)
const STATUS_ATIVOS = ['PENDENTE_ACEITE', 'AGUARDANDO_MARCACAO', 'REALIZADA'] as const

export function heRepository(db: PrismaClient) {
  return {
    // Jornada vigente do colaborador (para checar turno/dias de escala)
    async jornadaVigente(colaboradorId: string, data: Date) {
      const cj = await db.colaboradorJornada.findFirst({
        where: {
          colaborador_id: colaboradorId,
          data_inicio: { lte: data },
          OR: [{ data_fim: null }, { data_fim: { gte: data } }],
        },
        orderBy: { data_inicio: 'desc' },
        include: { jornada: true },
      })
      return cj?.jornada ?? null
    },

    // Soma de minutos de HE ativas num intervalo (exclui um id em edição)
    async somaMinutosHe(
      tenantId: string,
      colaboradorId: string,
      inicio: Date,
      fim: Date,
      excluirId?: string,
    ): Promise<number> {
      const hes = await db.heExtra.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data: { gte: inicio, lte: fim },
          status: { in: STATUS_ATIVOS as unknown as string[] as never },
          ...(excluirId ? { id: { not: excluirId } } : {}),
        },
        select: { hora_inicio: true, hora_fim: true },
      })
      return hes.reduce((acc, h) => acc + duracaoMinutos(h.hora_inicio, h.hora_fim), 0)
    },

    // Há feriado cobrindo o dia?
    async ehFeriado(tenantId: string, data: Date): Promise<boolean> {
      const f = await db.feriado.findFirst({
        where: {
          tenant_id: tenantId,
          data_inicio: { lte: data },
          data_fim: { gte: data },
        },
        select: { id: true },
      })
      return !!f
    },

    // Colaborador com dados fiscais para gravar marcação de HE
    async colaboradorParaMarcacao(colaboradorId: string, tenantId: string) {
      return db.colaborador.findFirst({
        where: { id: colaboradorId, tenant_id: tenantId },
        include: { cnpj_estab: true },
      })
    },
  }
}

// Limites de uma semana (Dom→Sáb) e mês que contêm a data
export function janelaSemana(data: Date): { inicio: Date; fim: Date } {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
  const inicio = new Date(d)
  inicio.setUTCDate(d.getUTCDate() - d.getUTCDay()) // volta para domingo
  const fim = new Date(inicio)
  fim.setUTCDate(inicio.getUTCDate() + 6)
  return { inicio, fim }
}

export function janelaMes(data: Date): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0))
  return { inicio, fim }
}

export function janelaDia(data: Date): { inicio: Date; fim: Date } {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
  return { inicio: d, fim: d }
}
