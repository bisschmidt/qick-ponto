import type { PrismaClient } from '@prisma/client'

export function m10Service(db: PrismaClient) {
  return {
    // ── Dashboard de KPIs ──────────────────────────────────────────────────────

    async dashboard(tenantId: string, dataInicio: Date, dataFim: Date) {
      const [totalColaboradores, apuracoes, ajustesPendentes, horasVencendo] = await Promise.all([
        // Total de colaboradores ativos
        db.colaborador.count({ where: { tenant_id: tenantId, ativo: true } }),

        // Totais de apuração do período
        db.jornadaApurada.aggregate({
          where: {
            tenant_id: tenantId,
            data_referencia: { gte: dataInicio, lte: dataFim },
          },
          _sum: {
            minutos_trabalhados: true,
            minutos_he_50: true,
            minutos_he_100: true,
            minutos_atraso: true,
            minutos_ad_noturno: true,
          },
          _count: { _all: true },
        }),

        // Ajustes pendentes
        db.ajuste.count({
          where: {
            tenant_id: tenantId,
            status: { in: ['PENDENTE_GESTOR', 'PENDENTE_RH'] },
          },
        }),

        // Horas a vencer em 30 dias
        db.bancoHoras.count({
          where: {
            tenant_id: tenantId,
            minutos: { gt: 0 },
            compensado: false,
            data_vencimento: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ])

      // Taxa de conformidade NR-17
      const [diasTotal, diasConformes] = await Promise.all([
        db.jornadaApurada.count({
          where: {
            tenant_id: tenantId,
            data_referencia: { gte: dataInicio, lte: dataFim },
          },
        }),
        db.jornadaApurada.count({
          where: {
            tenant_id: tenantId,
            data_referencia: { gte: dataInicio, lte: dataFim },
            pausas_nr17_conformes: true,
          },
        }),
      ])

      return {
        periodo: { inicio: dataInicio, fim: dataFim },
        totalColaboradores,
        totaisApuracao: {
          diasApurados: apuracoes._count._all,
          minutosTrabalhados: apuracoes._sum.minutos_trabalhados ?? 0,
          minutosHe50: apuracoes._sum.minutos_he_50 ?? 0,
          minutosHe100: apuracoes._sum.minutos_he_100 ?? 0,
          minutosAtraso: apuracoes._sum.minutos_atraso ?? 0,
          minutosAdNoturno: apuracoes._sum.minutos_ad_noturno ?? 0,
        },
        conformidadeNr17: {
          diasTotal,
          diasConformes,
          taxa: diasTotal > 0 ? Math.round((diasConformes / diasTotal) * 100) : 100,
        },
        alertas: {
          ajustesPendentes,
          horasVencendoEm30Dias: horasVencendo,
        },
      }
    },

    // ── Relatório de faltas por colaborador ─────────────────────────────────────

    async relatorioFaltas(tenantId: string, dataInicio: Date, dataFim: Date) {
      const faltas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: dataInicio, lte: dataFim },
          status: 'FALTA',
        },
        include: {
          colaborador: { select: { nome_completo: true, matricula: true } },
        },
        orderBy: [{ colaborador_id: 'asc' }, { data_referencia: 'asc' }],
      })

      // Agrupar por colaborador
      const porColab = new Map<
        string,
        { nome: string; matricula: string; datas: string[] }
      >()
      for (const f of faltas) {
        const chave = f.colaborador_id
        const atual = porColab.get(chave) ?? {
          nome: f.colaborador.nome_completo,
          matricula: f.colaborador.matricula,
          datas: [],
        }
        atual.datas.push(f.data_referencia.toISOString().slice(0, 10))
        porColab.set(chave, atual)
      }

      return {
        periodo: { inicio: dataInicio, fim: dataFim },
        colaboradores: Array.from(porColab.entries()).map(([id, d]) => ({
          colaboradorId: id,
          nome: d.nome,
          matricula: d.matricula,
          totalFaltas: d.datas.length,
          datas: d.datas,
        })),
      }
    },

    // ── Relatório de HE por colaborador ────────────────────────────────────────

    async relatorioHE(tenantId: string, dataInicio: Date, dataFim: Date) {
      const resumo = await db.jornadaApurada.groupBy({
        by: ['colaborador_id'],
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: dataInicio, lte: dataFim },
          OR: [{ minutos_he_50: { gt: 0 } }, { minutos_he_100: { gt: 0 } }],
        },
        _sum: {
          minutos_he_50: true,
          minutos_he_100: true,
          minutos_ad_noturno: true,
        },
        orderBy: { _sum: { minutos_he_50: 'desc' } },
      })

      const colaboradorIds = resumo.map((r) => r.colaborador_id)
      const colaboradores = await db.colaborador.findMany({
        where: { id: { in: colaboradorIds } },
        select: { id: true, nome_completo: true, matricula: true },
      })
      const coLabMap = new Map(colaboradores.map((c) => [c.id, c]))

      return {
        periodo: { inicio: dataInicio, fim: dataFim },
        colaboradores: resumo.map((r) => {
          const c = coLabMap.get(r.colaborador_id)
          return {
            colaboradorId: r.colaborador_id,
            nome: c?.nome_completo ?? '',
            matricula: c?.matricula ?? '',
            minutosHe50: r._sum.minutos_he_50 ?? 0,
            minutosHe100: r._sum.minutos_he_100 ?? 0,
            minutosAdNoturno: r._sum.minutos_ad_noturno ?? 0,
          }
        }),
      }
    },

    // ── Alertas automáticos (chamado pelo job de hora em hora) ──────────────────

    async verificarAlertas(tenantId: string) {
      const alertas: Array<{ tipo: string; descricao: string; referencia?: string }> = []

      // Ajustes pendentes há mais de 5 dias
      const limite5Dias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      const ajustesAntigos = await db.ajuste.count({
        where: {
          tenant_id: tenantId,
          status: { in: ['PENDENTE_GESTOR', 'PENDENTE_RH'] },
          created_at: { lt: limite5Dias },
        },
      })
      if (ajustesAntigos > 0) {
        alertas.push({
          tipo: 'AJUSTE_PENDENTE_LONGO',
          descricao: `${ajustesAntigos} ajuste(s) pendente(s) há mais de 5 dias`,
        })
      }

      // Espelhos não assinados após 10 dias do fechamento
      const espelhosSemAssinatura = await db.espelhoPonto.findMany({
        where: {
          tenant_id: tenantId,
          assinado: false,
          nao_manifestado: false,
          periodo: {
            fechado: true,
            fechado_at: { lt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
          },
        },
        select: { id: true, colaborador: { select: { nome_completo: true } } },
        take: 20,
      })
      if (espelhosSemAssinatura.length > 0) {
        alertas.push({
          tipo: 'ESPELHO_SEM_ASSINATURA',
          descricao: `${espelhosSemAssinatura.length} espelho(s) sem assinatura após 10 dias`,
        })
      }

      // Banco de horas a vencer em 15 dias
      const bhVencendo = await db.bancoHoras.count({
        where: {
          tenant_id: tenantId,
          minutos: { gt: 0 },
          compensado: false,
          data_vencimento: {
            gte: new Date(),
            lte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          },
        },
      })
      if (bhVencendo > 0) {
        alertas.push({
          tipo: 'BANCO_HORAS_VENCENDO',
          descricao: `${bhVencendo} registro(s) de banco de horas vencem em 15 dias`,
        })
      }

      return alertas
    },
  }
}
