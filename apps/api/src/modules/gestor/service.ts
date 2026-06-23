// Painel do gestor — visão do time, ficha de subordinado, pendências de aprovação.
// Admin tenant vê todo o tenant; gestor vê só seus subordinados.

import type { PrismaClient } from '@prisma/client'
import { portalService } from '../m2-marcacao/portal-service.js'

export function gestorService(db: PrismaClient) {
  const portal = portalService(db)

  return {
    // IDs dos subordinados do usuário logado.
    // Se for ADMIN_TENANT/RH_DP, retorna todos os colaboradores do tenant.
    async colaboradoresVisiveis(
      tenantId: string,
      usuarioId: string,
      role: string,
    ): Promise<string[]> {
      if (role === 'ADMIN_TENANT' || role === 'RH_DP' || role === 'AUDITOR') {
        const todos = await db.colaborador.findMany({
          where: { tenant_id: tenantId, ativo: true },
          select: { id: true },
        })
        return todos.map((c) => c.id)
      }
      // GESTOR vê só os subordinados diretos
      const subs = await db.colaborador.findMany({
        where: { tenant_id: tenantId, gestor_id: usuarioId, ativo: true },
        select: { id: true },
      })
      return subs.map((s) => s.id)
    },

    // Lista dos subordinados com info básica
    async meuTime(tenantId: string, usuarioId: string, role: string) {
      const ids = await this.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return []
      return db.colaborador.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nome_completo: true,
          matricula: true,
          centro_custo: true,
          operacao_cliente: true,
          email_corporativo: true,
          ativo: true,
          data_desligamento: true,
          jornadas: {
            where: { data_fim: null },
            include: { jornada: { select: { nome: true, hora_inicio: true, hora_fim: true } } },
            take: 1,
          },
        },
        orderBy: { nome_completo: 'asc' },
      })
    },

    // Status do time em uma data específica
    async timeNoDia(tenantId: string, usuarioId: string, role: string, dataStr: string) {
      const ids = await this.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return []

      const dataDia = new Date(`${dataStr}T00:00:00Z`)
      const colabs = await db.colaborador.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nome_completo: true,
          matricula: true,
        },
        orderBy: { matricula: 'asc' },
      })

      const apuradas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          data_referencia: dataDia,
        },
      })
      const apuradaMap = new Map(apuradas.map((a) => [a.colaborador_id, a]))

      // Conta marcações do dia em BRT (00:00 a 23:59 BRT = 03:00 a 02:59:59 UTC do dia seguinte)
      const inicioBRT = new Date(`${dataStr}T00:00:00-03:00`)
      const fimBRT = new Date(`${dataStr}T23:59:59.999-03:00`)
      const marcs = await db.marcacao.groupBy({
        by: ['colaborador_id'],
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          timestamp_marcacao: { gte: inicioBRT, lte: fimBRT },
        },
        _count: { _all: true },
      })
      const marcMap = new Map(marcs.map((m) => [m.colaborador_id, m._count._all]))

      // Ajustes do dia (qualquer status)
      const ajustes = await db.ajuste.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          data_ponto: dataDia,
        },
        include: { motivo: { select: { descricao: true } } },
      })
      const ajusteMap = new Map<string, typeof ajustes[number]>()
      for (const a of ajustes) ajusteMap.set(a.colaborador_id, a)

      return colabs.map((c) => {
        const ap = apuradaMap.get(c.id)
        const m = marcMap.get(c.id) ?? 0
        const aj = ajusteMap.get(c.id)
        const incs = ap && Array.isArray(ap.inconsistencias) ? (ap.inconsistencias as string[]) : []
        return {
          colaborador_id: c.id,
          nome: c.nome_completo,
          matricula: c.matricula,
          marcacoes_dia: m,
          status: ap?.status ?? (m === 0 ? 'FALTA' : 'INCOMPLETO'),
          minutos_trabalhados: ap?.minutos_trabalhados ?? 0,
          minutos_he50: ap?.minutos_he_50 ?? 0,
          minutos_atraso: ap?.minutos_atraso ?? 0,
          inconsistencias: incs,
          ajuste: aj
            ? { id: aj.id, status: aj.status, motivo: aj.motivo.descricao }
            : null,
        }
      })
    },

    // Ficha mensal de um subordinado (delega ao portalService com checagem de permissão)
    async fichaSubordinado(
      tenantId: string,
      usuarioId: string,
      role: string,
      colaboradorId: string,
      mes: string,
    ) {
      const ids = await this.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (!ids.includes(colaboradorId)) {
        throw { statusCode: 403, message: 'Sem permissão para ver este colaborador' }
      }
      return portal.minhaFicha(colaboradorId, tenantId, mes)
    },

    // Pendências de aprovação do time
    async pendenciasDoTime(tenantId: string, usuarioId: string, role: string) {
      const ids = await this.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return []
      return db.ajuste.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          status: { in: ['PENDENTE_GESTOR', 'PENDENTE_RH'] },
        },
        include: {
          colaborador: { select: { id: true, nome_completo: true, matricula: true } },
          motivo: { select: { descricao: true } },
        },
        orderBy: { data_ponto: 'desc' },
      })
    },

    // Gestor cria ajuste em nome do subordinado (atalho — já aprovado pelo gestor)
    async criarAjustePeloGestor(params: {
      tenantId: string
      gestorId: string
      role: string
      colaboradorId: string
      motivoId: string
      dataPonto: Date
      tipoAjuste: string
      justificativa: string
      novoTimestamp?: Date
      novoTipo?: string
    }) {
      const ids = await this.colaboradoresVisiveis(params.tenantId, params.gestorId, params.role)
      if (!ids.includes(params.colaboradorId)) {
        throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      }
      const now = new Date()
      return db.ajuste.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.gestorId,
          motivo_id: params.motivoId,
          data_ponto: params.dataPonto,
          tipo_ajuste: params.tipoAjuste,
          justificativa: params.justificativa,
          novo_timestamp: params.novoTimestamp ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          novo_tipo: (params.novoTipo as any) ?? null,
          status: 'PENDENTE_RH', // gestor já aprovou — vai pro RH
          gestor_id: params.gestorId,
          gestor_at: now,
          gestor_obs: 'Lançado diretamente pelo gestor',
        },
      })
    },

    // Alertas de faltas consecutivas por colaborador
    async alertasEquipe(tenantId: string, usuarioId: string, role: string) {
      const ids = await this.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return []

      const colabs = await db.colaborador.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome_completo: true, matricula: true },
        orderBy: { nome_completo: 'asc' },
      })

      const sessenta = new Date()
      sessenta.setDate(sessenta.getDate() - 60)

      const apuradas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          data_referencia: { gte: sessenta },
        },
        orderBy: { data_referencia: 'desc' },
      })

      const apPorColab = new Map<string, typeof apuradas>()
      for (const a of apuradas) {
        const lst = apPorColab.get(a.colaborador_id) ?? []
        lst.push(a)
        apPorColab.set(a.colaborador_id, lst)
      }

      return colabs.map((c) => {
        const registros = apPorColab.get(c.id) ?? []
        let streak = 0
        for (const r of registros) {
          if (r.status === 'FALTA') {
            streak++
          } else if (r.status === 'DSR' || r.status === 'FERIADO') {
            continue
          } else {
            break
          }
        }

        let alerta: string | null = null
        if (streak >= 20) alerta = 'POSSIVEL_ABANDONO'
        else if (streak >= 5) alerta = 'FALTA_CONCENTRADA'
        else if (streak > 0) alerta = 'FALTA_INJUSTIFICADA'

        return {
          colaborador_id: c.id,
          nome: c.nome_completo,
          matricula: c.matricula,
          faltas_consecutivas: streak,
          alerta,
        }
      })
    },

    // RH/Gestor marca um dia com ponto incompleto como Saída Antecipada
    async marcarSaidaAntecipada(params: {
      tenantId: string
      gestorId: string
      role: string
      colaboradorId: string
      dataPonto: Date
      justificativa: string
    }) {
      const ids = await this.colaboradoresVisiveis(params.tenantId, params.gestorId, params.role)
      if (!ids.includes(params.colaboradorId)) {
        throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      }

      let motivo = await db.motivoAjuste.findFirst({
        where: { tenant_id: params.tenantId, descricao: 'Saída Antecipada' },
      })
      if (!motivo) {
        motivo = await db.motivoAjuste.create({
          data: { tenant_id: params.tenantId, descricao: 'Saída Antecipada' },
        })
      }

      const now = new Date()
      return db.ajuste.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.gestorId,
          motivo_id: motivo.id,
          data_ponto: params.dataPonto,
          tipo_ajuste: 'SAIDA_ANTECIPADA',
          justificativa: params.justificativa,
          novo_timestamp: null,
          status: 'APROVADO_GESTOR',
          gestor_id: params.gestorId,
          gestor_at: now,
          gestor_obs: 'Marcado como Saída Antecipada',
        },
      })
    },

    // Gestor pede mais comprovação do colaborador (anota observação e mantém status)
    async pedirComprovacao(tenantId: string, gestorId: string, ajusteId: string, obs: string) {
      const ajuste = await db.ajuste.findFirst({
        where: { id: ajusteId, tenant_id: tenantId },
      })
      if (!ajuste) throw { statusCode: 404, message: 'Ajuste não encontrado' }
      return db.ajuste.update({
        where: { id: ajusteId },
        data: {
          gestor_obs: obs,
          gestor_id: gestorId,
        },
      })
    },

    // Mudar gestor de um colaborador (só admin)
    async definirGestor(tenantId: string, colaboradorId: string, gestorId: string | null) {
      return db.colaborador.update({
        where: { id: colaboradorId },
        data: { gestor_id: gestorId },
        // Garante que o gestor pertence ao mesmo tenant (validado no service caller)
      })
    },
  }
}
