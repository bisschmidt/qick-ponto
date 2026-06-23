import type { PrismaClient, ModalidadeBancoHoras } from '@prisma/client'

// Prazo de vencimento por modalidade (em meses)
const PRAZO_VENCIMENTO: Record<ModalidadeBancoHoras, number> = {
  ACORDO_INDIVIDUAL: 6,
  ACT_CCT: 12,
  COMPENSACAO_MENSAL: 1,
}

export function m5Service(db: PrismaClient) {
  return {
    // Credita horas extras no banco após apuração do período
    async creditarHorasExtras(
      tenantId: string,
      colaboradorId: string,
      dataReferencia: Date,
      minutosHe50: number,
      minutosHe100: number,
      modalidade: ModalidadeBancoHoras,
    ) {
      const totalMinutos = minutosHe50 + minutosHe100
      if (totalMinutos <= 0) return null

      const prazoMeses = PRAZO_VENCIMENTO[modalidade]
      const dataVencimento = new Date(dataReferencia)
      dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + prazoMeses)

      return db.bancoHoras.create({
        data: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data_referencia: dataReferencia,
          minutos: totalMinutos,
          descricao: `HE apurada: ${minutosHe50}min (50%) + ${minutosHe100}min (100%)`,
          modalidade,
          data_vencimento: dataVencimento,
        },
      })
    },

    // Debita compensação (quando o colaborador tira horas como folga)
    async debitarCompensacao(
      tenantId: string,
      colaboradorId: string,
      dataCompensacao: Date,
      minutos: number,
      descricao: string,
    ) {
      const saldo = await this.calcularSaldo(tenantId, colaboradorId)
      if (saldo < minutos) {
        throw new Error(`Saldo insuficiente: ${saldo} min disponíveis, solicitado ${minutos} min`)
      }

      return db.bancoHoras.create({
        data: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data_referencia: dataCompensacao,
          minutos: -minutos, // negativo = débito
          descricao,
          modalidade: 'ACORDO_INDIVIDUAL',
          data_vencimento: dataCompensacao, // débito não vence
          compensado: true,
        },
      })
    },

    // Saldo atual (não-expirado, não-compensado)
    async calcularSaldo(tenantId: string, colaboradorId: string): Promise<number> {
      const hoje = new Date()

      const resultado = await db.bancoHoras.aggregate({
        where: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          OR: [
            { minutos: { lt: 0 } }, // débitos sempre contam
            {
              minutos: { gt: 0 },
              compensado: false,
              data_vencimento: { gte: hoje },
            },
          ],
        },
        _sum: { minutos: true },
      })

      return resultado._sum.minutos ?? 0
    },

    // Extrato do banco de horas
    async buscarExtrato(
      tenantId: string,
      colaboradorId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      const movimentos = await db.bancoHoras.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          data_referencia: { gte: dataInicio, lte: dataFim },
        },
        orderBy: { data_referencia: 'desc' },
      })

      const saldoAtual = await this.calcularSaldo(tenantId, colaboradorId)

      return { movimentos, saldoAtual }
    },

    // Verifica horas que vencerão nos próximos X dias (para alertas M10)
    async verificarVencimentos(tenantId: string, diasAntecedencia: number = 30) {
      const hoje = new Date()
      const limite = new Date(hoje)
      limite.setUTCDate(limite.getUTCDate() + diasAntecedencia)

      return db.bancoHoras.findMany({
        where: {
          tenant_id: tenantId,
          minutos: { gt: 0 },
          compensado: false,
          data_vencimento: { gte: hoje, lte: limite },
        },
        include: {
          colaborador: {
            select: { nome_completo: true, matricula: true },
          },
        },
        orderBy: { data_vencimento: 'asc' },
      })
    },

    // Horas vencidas não compensadas (perdidas — para relatório)
    async buscarHorasVencidas(tenantId: string) {
      const hoje = new Date()
      return db.bancoHoras.findMany({
        where: {
          tenant_id: tenantId,
          minutos: { gt: 0 },
          compensado: false,
          data_vencimento: { lt: hoje },
        },
        include: {
          colaborador: {
            select: { nome_completo: true, matricula: true },
          },
        },
        orderBy: { data_vencimento: 'asc' },
      })
    },

    // Resumo do banco de horas por colaborador (para dashboard)
    async buscarResumoTenant(tenantId: string) {
      const hoje = new Date()

      const colaboradores = await db.colaborador.findMany({
        where: { tenant_id: tenantId, ativo: true },
        select: {
          id: true,
          nome_completo: true,
          matricula: true,
          banco_horas: {
            where: {
              OR: [
                { minutos: { lt: 0 } },
                {
                  minutos: { gt: 0 },
                  compensado: false,
                  data_vencimento: { gte: hoje },
                },
              ],
            },
          },
        },
      })

      return colaboradores.map((c) => ({
        colaboradorId: c.id,
        nome: c.nome_completo,
        matricula: c.matricula,
        saldoMinutos: c.banco_horas.reduce((s, m) => s + m.minutos, 0),
      }))
    },
  }
}
