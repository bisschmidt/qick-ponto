import type { PrismaClient } from '@prisma/client'
import { gestorService } from '../gestor/service.js'
import { m5Service } from '../m5-banco-horas/service.js'
import { configHeService } from './config-service.js'
import { heRepository, janelaDia, janelaSemana, janelaMes } from './repository.js'
import { duracaoMinutos, formatarMin, validarLancamentoHe, type LimitesHe } from './validacoes.js'

// HE planejada avulsa só pode ser cancelada/ajustada enquanto não foi batida
const EDITAVEL = ['PENDENTE_ACEITE', 'AGUARDANDO_MARCACAO']

interface DiaCompensacao {
  data: string // YYYY-MM-DD
  hora_inicio: string
  hora_fim: string
}

export function heService(db: PrismaClient) {
  const gestor = gestorService(db)
  const m5 = m5Service(db)
  const config = configHeService(db)
  const repo = heRepository(db)

  // Valida um lançamento de HE contra limites/turno/intervalo
  async function checarRegras(
    tenantId: string,
    colaboradorId: string,
    data: Date,
    horaInicio: string,
    horaFim: string,
    excluirId?: string,
  ): Promise<{ ok: true } | { ok: false; erro: string }> {
    const jornada = await repo.jornadaVigente(colaboradorId, data)
    if (!jornada) return { ok: false, erro: 'Colaborador sem jornada vigente na data' }

    const cfg = await config.obter(tenantId)
    const limites: LimitesHe = {
      maxMinDia: cfg.max_min_dia,
      maxMinSemana: cfg.max_min_semana,
      maxMinMes: cfg.max_min_mes,
      intervaloMinAposJornadaMin: cfg.intervalo_min_apos_jornada_min,
    }

    const d = janelaDia(data)
    const s = janelaSemana(data)
    const me = janelaMes(data)
    const [minDia, minSemana, minMes] = await Promise.all([
      repo.somaMinutosHe(tenantId, colaboradorId, d.inicio, d.fim, excluirId),
      repo.somaMinutosHe(tenantId, colaboradorId, s.inicio, s.fim, excluirId),
      repo.somaMinutosHe(tenantId, colaboradorId, me.inicio, me.fim, excluirId),
    ])

    return validarLancamentoHe({
      data,
      horaInicio,
      horaFim,
      jornada: {
        hora_inicio: jornada.hora_inicio,
        hora_fim: jornada.hora_fim,
        dias_semana: jornada.dias_semana as number[],
      },
      limites,
      minutosLancadosDia: minDia,
      minutosLancadosSemana: minSemana,
      minutosLancadosMes: minMes,
    })
  }

  // Minutos da jornada a compensar numa falta; valida que é dia de escala
  async function exigidoDaFalta(tenantId: string, colaboradorId: string, dataFaltaStr: string): Promise<number> {
    const dataFalta = new Date(`${dataFaltaStr}T00:00:00Z`)
    const jornada = await repo.jornadaVigente(colaboradorId, dataFalta)
    if (!jornada) throw { statusCode: 422, message: 'Colaborador sem jornada vigente na data da falta' }
    const ehEscala = (jornada.dias_semana as number[]).includes(dataFalta.getUTCDay())
    if (!ehEscala) throw { statusCode: 422, message: 'A data da falta não é um dia de trabalho na escala — não há jornada a compensar' }
    return duracaoMinutos(jornada.hora_inicio, jornada.hora_fim)
  }

  // Destino de uma HE realizada: COMPENSACAO → banco; REMUNERADA → JornadaApurada (folha)
  async function aplicarDestino(he: {
    id: string
    tenant_id: string
    colaborador_id: string
    data: Date
    hora_inicio: string
    hora_fim: string
    tipo: string
    compensacao_id: string | null
  }) {
    const minutos = duracaoMinutos(he.hora_inicio, he.hora_fim)
    if (minutos <= 0) return

    if (he.tipo === 'COMPENSACAO' || he.compensacao_id) {
      // Crédito no banco de horas
      await m5.creditarHorasExtras(he.tenant_id, he.colaborador_id, he.data, minutos, 0, 'ACORDO_INDIVIDUAL')
      return
    }

    // REMUNERADA → soma na JornadaApurada do dia para o M8/M12 exportarem
    const jornada = await repo.jornadaVigente(he.colaborador_id, he.data)
    const diaSemana = he.data.getUTCDay()
    const ehDiaTrabalho = jornada ? (jornada.dias_semana as number[]).includes(diaSemana) : false
    const ehFeriado = await repo.ehFeriado(he.tenant_id, he.data)
    const cem = ehFeriado || !ehDiaTrabalho // feriado ou DSR → 100%

    await db.jornadaApurada.upsert({
      where: { colaborador_id_data_referencia: { colaborador_id: he.colaborador_id, data_referencia: he.data } },
      update: cem
        ? { minutos_he_100: { increment: minutos } }
        : { minutos_he_50: { increment: minutos } },
      create: {
        tenant_id: he.tenant_id,
        colaborador_id: he.colaborador_id,
        data_referencia: he.data,
        status: 'PRESENTE',
        eh_feriado: ehFeriado,
        eh_dsr: !ehDiaTrabalho,
        minutos_he_50: cem ? 0 : minutos,
        minutos_he_100: cem ? minutos : 0,
      },
    })
  }

  return {
    aplicarDestino,

    // ── HE planejada (gestor) ────────────────────────────────────────────────
    async lancarHePlanejada(params: {
      tenantId: string
      gestorId: string
      role: string
      colaboradorId: string
      data: string
      horaInicio: string
      horaFim: string
      tipo: 'REMUNERADA' | 'COMPENSACAO'
      motivo?: string
    }) {
      const ids = await gestor.colaboradoresVisiveis(params.tenantId, params.gestorId, params.role)
      if (!ids.includes(params.colaboradorId)) {
        throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      }
      const data = new Date(`${params.data}T00:00:00Z`)
      const check = await checarRegras(params.tenantId, params.colaboradorId, data, params.horaInicio, params.horaFim)
      if (!check.ok) throw { statusCode: 422, message: check.erro }

      return db.heExtra.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          gestor_id: params.gestorId,
          data,
          hora_inicio: params.horaInicio,
          hora_fim: params.horaFim,
          tipo: params.tipo,
          status: 'PENDENTE_ACEITE',
          motivo: params.motivo ?? null,
        },
      })
    },

    // ── Aceite do colaborador ────────────────────────────────────────────────
    async listarMinhasHe(colaboradorId: string, tenantId: string) {
      await this.detectarFaltasHe(tenantId, [colaboradorId])
      return db.heExtra.findMany({
        where: { tenant_id: tenantId, colaborador_id: colaboradorId },
        orderBy: { data: 'desc' },
        take: 100,
      })
    },

    async aceitarHe(colaboradorId: string, tenantId: string, heId: string) {
      const he = await db.heExtra.findFirst({ where: { id: heId, tenant_id: tenantId, colaborador_id: colaboradorId } })
      if (!he) throw { statusCode: 404, message: 'HE não encontrada' }
      if (he.status !== 'PENDENTE_ACEITE') throw { statusCode: 422, message: 'HE não está pendente de aceite' }
      return db.heExtra.update({
        where: { id: heId },
        data: { status: 'AGUARDANDO_MARCACAO', timestamp_aceite: new Date() },
      })
    },

    async recusarHe(colaboradorId: string, tenantId: string, heId: string) {
      const he = await db.heExtra.findFirst({ where: { id: heId, tenant_id: tenantId, colaborador_id: colaboradorId } })
      if (!he) throw { statusCode: 404, message: 'HE não encontrada' }
      if (he.status !== 'PENDENTE_ACEITE') throw { statusCode: 422, message: 'HE não está pendente de aceite' }
      return db.heExtra.update({ where: { id: heId }, data: { status: 'RECUSADA' } })
    },

    // ── Cancelar / ajustar HE planejada (gestor) ─────────────────────────────
    async heEditavelDoGestor(tenantId: string, gestorId: string, role: string, heId: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, gestorId, role)
      const he = await db.heExtra.findFirst({ where: { id: heId, tenant_id: tenantId } })
      if (!he) throw { statusCode: 404, message: 'HE não encontrada' }
      if (!ids.includes(he.colaborador_id)) throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      if (he.compensacao_id) throw { statusCode: 422, message: 'HE de compensação — gerencie pelo fluxo de compensação' }
      if (!EDITAVEL.includes(he.status)) throw { statusCode: 422, message: 'Só é possível alterar HE que ainda não foi realizada' }
      return he
    },

    async cancelarHe(tenantId: string, gestorId: string, role: string, heId: string) {
      await this.heEditavelDoGestor(tenantId, gestorId, role, heId)
      return db.heExtra.update({ where: { id: heId }, data: { status: 'CANCELADA' } })
    },

    async ajustarHe(
      tenantId: string,
      gestorId: string,
      role: string,
      heId: string,
      campos: { data?: string; horaInicio: string; horaFim: string },
    ) {
      const he = await this.heEditavelDoGestor(tenantId, gestorId, role, heId)
      const novaData = campos.data ? new Date(`${campos.data}T00:00:00Z`) : he.data
      const check = await checarRegras(tenantId, he.colaborador_id, novaData, campos.horaInicio, campos.horaFim, heId)
      if (!check.ok) throw { statusCode: 422, message: check.erro }
      // Alterar os termos exige novo aceite do colaborador (conformidade CLT)
      return db.heExtra.update({
        where: { id: heId },
        data: {
          data: novaData,
          hora_inicio: campos.horaInicio,
          hora_fim: campos.horaFim,
          status: 'PENDENTE_ACEITE',
          timestamp_aceite: null,
        },
      })
    },

    // ── Compensação (colaborador solicita) ───────────────────────────────────
    // Jornada a compensar numa data (alvo de horas) + teto diário de HE
    async infoCompensacaoData(tenantId: string, colaboradorId: string, dataStr: string) {
      const data = new Date(`${dataStr}T00:00:00Z`)
      const cfg = await config.obter(tenantId)
      const jornada = await repo.jornadaVigente(colaboradorId, data)
      if (!jornada) {
        return {
          eh_dia_escala: false, minutos: 0, hora_inicio: null, hora_fim: null,
          max_min_dia: cfg.max_min_dia, dias_semana: [] as number[],
        }
      }
      const diasSemana = jornada.dias_semana as number[]
      const ehEscala = diasSemana.includes(data.getUTCDay())
      return {
        eh_dia_escala: ehEscala,
        minutos: ehEscala ? duracaoMinutos(jornada.hora_inicio, jornada.hora_fim) : 0,
        hora_inicio: jornada.hora_inicio,
        hora_fim: jornada.hora_fim,
        max_min_dia: cfg.max_min_dia,
        dias_semana: diasSemana,
      }
    },
    async solicitarCompensacao(params: {
      tenantId: string
      colaboradorId: string
      dataFalta: string
      motivo: string
      dias: DiaCompensacao[]
    }) {
      if (params.dias.length === 0) throw { statusCode: 422, message: 'Informe ao menos um dia de compensação' }

      // A falta precisa ser um dia de escala, e os dias devem cobrir a jornada inteira
      const exigido = await exigidoDaFalta(params.tenantId, params.colaboradorId, params.dataFalta)
      const totalProposto = params.dias.reduce((acc, d) => acc + duracaoMinutos(d.hora_inicio, d.hora_fim), 0)
      if (totalProposto < exigido) {
        throw {
          statusCode: 422,
          message: `Os dias somam ${formatarMin(totalProposto)}, mas a jornada a compensar é ${formatarMin(exigido)}. Adicione mais dias/horas.`,
        }
      }

      // Valida cada dia proposto (inclui exceção de sábado/dia sem escala)
      for (const dia of params.dias) {
        const data = new Date(`${dia.data}T00:00:00Z`)
        const check = await checarRegras(params.tenantId, params.colaboradorId, data, dia.hora_inicio, dia.hora_fim)
        if (!check.ok) throw { statusCode: 422, message: `${dia.data}: ${check.erro}` }
      }

      return db.solicitacaoCompensacao.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.colaboradorId,
          data_falta: new Date(`${params.dataFalta}T00:00:00Z`),
          motivo: params.motivo,
          status: 'PENDENTE_GESTOR',
          hes: {
            create: params.dias.map((dia) => ({
              tenant_id: params.tenantId,
              colaborador_id: params.colaboradorId,
              gestor_id: params.colaboradorId, // solicitante; definido o gestor real na aprovação
              data: new Date(`${dia.data}T00:00:00Z`),
              hora_inicio: dia.hora_inicio,
              hora_fim: dia.hora_fim,
              tipo: 'COMPENSACAO',
              status: 'PENDENTE_ACEITE', // aguardando aprovação do gestor (rastreado no pai)
            })),
          },
        },
        include: { hes: true },
      })
    },

    // Info da jornada a compensar de um colaborador do time (para o gestor montar os slots)
    async infoCompensacaoColaborador(tenantId: string, gestorId: string, role: string, colaboradorId: string, dataStr: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, gestorId, role)
      if (!ids.includes(colaboradorId)) throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      return this.infoCompensacaoData(tenantId, colaboradorId, dataStr)
    },

    // Gestor cria a compensação por slots já aprovada (vai direto para "aguardando marcação")
    async criarCompensacaoGestor(params: {
      tenantId: string
      gestorId: string
      role: string
      colaboradorId: string
      dataFalta: string
      motivo: string
      dias: DiaCompensacao[]
    }) {
      const ids = await gestor.colaboradoresVisiveis(params.tenantId, params.gestorId, params.role)
      if (!ids.includes(params.colaboradorId)) throw { statusCode: 403, message: 'Sem permissão sobre este colaborador' }
      if (params.dias.length === 0) throw { statusCode: 422, message: 'Informe ao menos um dia' }

      const exigido = await exigidoDaFalta(params.tenantId, params.colaboradorId, params.dataFalta)
      const total = params.dias.reduce((acc, d) => acc + duracaoMinutos(d.hora_inicio, d.hora_fim), 0)
      if (total < exigido) {
        throw { statusCode: 422, message: `Os dias somam ${formatarMin(total)}, mas a jornada a compensar é ${formatarMin(exigido)}.` }
      }
      for (const dia of params.dias) {
        const data = new Date(`${dia.data}T00:00:00Z`)
        const check = await checarRegras(params.tenantId, params.colaboradorId, data, dia.hora_inicio, dia.hora_fim)
        if (!check.ok) throw { statusCode: 422, message: `${dia.data}: ${check.erro}` }
      }

      return db.solicitacaoCompensacao.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.gestorId,
          data_falta: new Date(`${params.dataFalta}T00:00:00Z`),
          motivo: params.motivo,
          status: 'APROVADA',
          gestor_id: params.gestorId,
          gestor_at: new Date(),
          hes: {
            create: params.dias.map((dia) => ({
              tenant_id: params.tenantId,
              colaborador_id: params.colaboradorId,
              gestor_id: params.gestorId,
              data: new Date(`${dia.data}T00:00:00Z`),
              hora_inicio: dia.hora_inicio,
              hora_fim: dia.hora_fim,
              tipo: 'COMPENSACAO',
              status: 'AGUARDANDO_MARCACAO',
              timestamp_aceite: new Date(),
            })),
          },
        },
        include: { hes: true },
      })
    },

    async listarMinhasCompensacoes(colaboradorId: string, tenantId: string) {
      return db.solicitacaoCompensacao.findMany({
        where: { tenant_id: tenantId, colaborador_id: colaboradorId },
        include: { hes: true },
        orderBy: { created_at: 'desc' },
        take: 50,
      })
    },

    // ── Aprovação de compensação (gestor) ────────────────────────────────────
    async aprovarCompensacao(tenantId: string, gestorId: string, role: string, solicitacaoId: string) {
      const solic = await this.buscarCompensacaoVisivel(tenantId, gestorId, role, solicitacaoId)
      if (solic.status !== 'PENDENTE_GESTOR') throw { statusCode: 422, message: 'Solicitação não está pendente' }
      await db.$transaction([
        db.solicitacaoCompensacao.update({
          where: { id: solicitacaoId },
          data: { status: 'APROVADA', gestor_id: gestorId, gestor_at: new Date() },
        }),
        db.heExtra.updateMany({
          where: { compensacao_id: solicitacaoId },
          data: { status: 'AGUARDANDO_MARCACAO', gestor_id: gestorId, timestamp_aceite: new Date() },
        }),
      ])
      return { ok: true }
    },

    async reprovarCompensacao(tenantId: string, gestorId: string, role: string, solicitacaoId: string, obs: string) {
      const solic = await this.buscarCompensacaoVisivel(tenantId, gestorId, role, solicitacaoId)
      if (solic.status !== 'PENDENTE_GESTOR') throw { statusCode: 422, message: 'Solicitação não está pendente' }
      await db.$transaction([
        db.solicitacaoCompensacao.update({
          where: { id: solicitacaoId },
          data: { status: 'REPROVADA', gestor_id: gestorId, gestor_at: new Date(), gestor_obs: obs },
        }),
        db.heExtra.updateMany({ where: { compensacao_id: solicitacaoId }, data: { status: 'CANCELADA' } }),
      ])
      return { ok: true }
    },

    // Gestor altera os dias/horários propostos e aprova
    async alterarCompensacao(
      tenantId: string,
      gestorId: string,
      role: string,
      solicitacaoId: string,
      dias: DiaCompensacao[],
    ) {
      const solic = await this.buscarCompensacaoVisivel(tenantId, gestorId, role, solicitacaoId)
      if (solic.status !== 'PENDENTE_GESTOR') throw { statusCode: 422, message: 'Solicitação não está pendente' }
      if (dias.length === 0) throw { statusCode: 422, message: 'Informe ao menos um dia' }

      const exigido = await exigidoDaFalta(tenantId, solic.colaborador_id, solic.data_falta.toISOString().slice(0, 10))
      const totalProposto = dias.reduce((acc, d) => acc + duracaoMinutos(d.hora_inicio, d.hora_fim), 0)
      if (totalProposto < exigido) {
        throw {
          statusCode: 422,
          message: `Os dias somam ${formatarMin(totalProposto)}, mas a jornada a compensar é ${formatarMin(exigido)}.`,
        }
      }

      for (const dia of dias) {
        const data = new Date(`${dia.data}T00:00:00Z`)
        const check = await checarRegras(tenantId, solic.colaborador_id, data, dia.hora_inicio, dia.hora_fim)
        if (!check.ok) throw { statusCode: 422, message: `${dia.data}: ${check.erro}` }
      }

      await db.$transaction([
        db.heExtra.deleteMany({ where: { compensacao_id: solicitacaoId } }),
        db.heExtra.createMany({
          data: dias.map((dia) => ({
            tenant_id: tenantId,
            colaborador_id: solic.colaborador_id,
            gestor_id: gestorId,
            data: new Date(`${dia.data}T00:00:00Z`),
            hora_inicio: dia.hora_inicio,
            hora_fim: dia.hora_fim,
            tipo: 'COMPENSACAO',
            status: 'AGUARDANDO_MARCACAO',
            compensacao_id: solicitacaoId,
            timestamp_aceite: new Date(),
          })),
        }),
        db.solicitacaoCompensacao.update({
          where: { id: solicitacaoId },
          data: { status: 'APROVADA', gestor_id: gestorId, gestor_at: new Date(), gestor_obs: 'Ajustado pelo gestor' },
        }),
      ])
      return { ok: true }
    },

    async buscarCompensacaoVisivel(tenantId: string, usuarioId: string, role: string, solicitacaoId: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, usuarioId, role)
      const solic = await db.solicitacaoCompensacao.findFirst({
        where: { id: solicitacaoId, tenant_id: tenantId },
        include: { hes: true },
      })
      if (!solic) throw { statusCode: 404, message: 'Solicitação não encontrada' }
      if (!ids.includes(solic.colaborador_id)) throw { statusCode: 403, message: 'Sem permissão' }
      return solic
    },

    // ── Visão de gestão (todas as HE do time) ────────────────────────────────
    async listarHeDoTime(tenantId: string, usuarioId: string, role: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) {
        return { aguardandoAceite: [], aguardandoMarcacao: [], realizadas: [], faltaHe: [], compensacoesPendentes: [] }
      }

      await this.detectarFaltasHe(tenantId, ids)

      const [hes, compensacoes] = await Promise.all([
        db.heExtra.findMany({
          where: { tenant_id: tenantId, colaborador_id: { in: ids } },
          include: { colaborador: { select: { id: true, nome_completo: true, matricula: true } } },
          orderBy: { data: 'desc' },
          take: 300,
        }),
        db.solicitacaoCompensacao.findMany({
          where: { tenant_id: tenantId, colaborador_id: { in: ids }, status: 'PENDENTE_GESTOR' },
          include: {
            colaborador: { select: { id: true, nome_completo: true, matricula: true } },
            hes: true,
          },
          orderBy: { created_at: 'desc' },
        }),
      ])

      const view = (h: typeof hes[number]) => ({
        id: h.id,
        colaborador: h.colaborador,
        data: h.data.toISOString().slice(0, 10),
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        tipo: h.tipo,
        status: h.status,
        compensacao_id: h.compensacao_id,
        motivo: h.motivo,
      })

      // Aguardando aceite: só HE planejada avulsa (compensação é rastreada no pai)
      const avulsas = hes.filter((h) => !h.compensacao_id)
      return {
        aguardandoAceite: avulsas.filter((h) => h.status === 'PENDENTE_ACEITE').map(view),
        aguardandoMarcacao: hes.filter((h) => h.status === 'AGUARDANDO_MARCACAO').map(view),
        realizadas: hes.filter((h) => h.status === 'REALIZADA').map(view),
        faltaHe: hes.filter((h) => h.status === 'FALTA_HE').map(view),
        compensacoesPendentes: compensacoes.map((c) => ({
          id: c.id,
          colaborador: c.colaborador,
          data_falta: c.data_falta.toISOString().slice(0, 10),
          motivo: c.motivo,
          dias: c.hes.map((h) => ({
            data: h.data.toISOString().slice(0, 10),
            hora_inicio: h.hora_inicio,
            hora_fim: h.hora_fim,
          })),
        })),
      }
    },

    // ── Falta HE (lazy): janela passou sem marcação ──────────────────────────
    async detectarFaltasHe(tenantId: string, colaboradorIds: string[]) {
      const agora = new Date()
      const candidatas = await db.heExtra.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: colaboradorIds },
          status: 'AGUARDANDO_MARCACAO',
          saida_marcacao_id: null,
        },
        select: { id: true, data: true, hora_fim: true },
      })
      const vencidas: string[] = []
      for (const h of candidatas) {
        const [hf, mf] = h.hora_fim.split(':').map(Number) as [number, number]
        // janela em BRT (UTC-3): fim = data 00:00Z + horas BRT + 3h
        const fimUTC = new Date(h.data.getTime() + (hf * 60 + mf + 180) * 60 * 1000)
        if (agora > fimUTC) vencidas.push(h.id)
      }
      if (vencidas.length > 0) {
        await db.heExtra.updateMany({ where: { id: { in: vencidas } }, data: { status: 'FALTA_HE' } })
      }
    },

    async relatorioFaltaHe(tenantId: string, usuarioId: string, role: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return []
      await this.detectarFaltasHe(tenantId, ids)
      return db.heExtra.findMany({
        where: { tenant_id: tenantId, colaborador_id: { in: ids }, status: 'FALTA_HE' },
        include: { colaborador: { select: { id: true, nome_completo: true, matricula: true } } },
        orderBy: { data: 'desc' },
      })
    },

    // ── Reconciliação da compensação (na data da falta) ──────────────────────
    async reconciliarPendentes(tenantId: string, usuarioId: string, role: string) {
      const ids = await gestor.colaboradoresVisiveis(tenantId, usuarioId, role)
      if (ids.length === 0) return { reconciliadas: 0 }
      const hoje = new Date()
      const pendentes = await db.solicitacaoCompensacao.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: { in: ids },
          status: 'APROVADA',
          reconciliada_at: null,
          data_falta: { lte: hoje },
        },
        select: { id: true },
      })
      for (const s of pendentes) await this.reconciliarCompensacao(tenantId, s.id)
      return { reconciliadas: pendentes.length }
    },

    async reconciliarCompensacao(tenantId: string, solicitacaoId: string) {
      const solic = await db.solicitacaoCompensacao.findFirst({
        where: { id: solicitacaoId, tenant_id: tenantId },
        include: { hes: true },
      })
      if (!solic || solic.reconciliada_at) return

      const jornada = await repo.jornadaVigente(solic.colaborador_id, solic.data_falta)
      const exigido = jornada ? duracaoMinutos(jornada.hora_inicio, jornada.hora_fim) : 0

      const compensado = solic.hes
        .filter((h) => h.status === 'REALIZADA')
        .reduce((acc, h) => acc + duracaoMinutos(h.hora_inicio, h.hora_fim), 0)

      let resultado: 'ABONADA_TOTAL' | 'PARCIAL' | 'NAO_COMPENSADA'
      if (compensado >= exigido && exigido > 0) resultado = 'ABONADA_TOTAL'
      else if (compensado > 0) resultado = 'PARCIAL'
      else resultado = 'NAO_COMPENSADA'

      if (resultado === 'ABONADA_TOTAL') {
        // Falta abonada: marca o dia como COMPENSADO e debita o banco (as horas extras cobrem a falta)
        await db.jornadaApurada.upsert({
          where: { colaborador_id_data_referencia: { colaborador_id: solic.colaborador_id, data_referencia: solic.data_falta } },
          update: { status: 'COMPENSADO' },
          create: {
            tenant_id: tenantId,
            colaborador_id: solic.colaborador_id,
            data_referencia: solic.data_falta,
            status: 'COMPENSADO',
          },
        })
        await m5.debitarCompensacao(tenantId, solic.colaborador_id, solic.data_falta, exigido, `Compensação da falta de ${solic.data_falta.toISOString().slice(0, 10)}`)
      } else {
        // Parcial ou nenhuma: o dia permanece FALTA; horas trabalhadas seguem como crédito (excedente)
        await db.jornadaApurada.upsert({
          where: { colaborador_id_data_referencia: { colaborador_id: solic.colaborador_id, data_referencia: solic.data_falta } },
          update: { status: 'FALTA' },
          create: {
            tenant_id: tenantId,
            colaborador_id: solic.colaborador_id,
            data_referencia: solic.data_falta,
            status: 'FALTA',
          },
        })
      }

      await db.solicitacaoCompensacao.update({
        where: { id: solicitacaoId },
        data: { status: 'APROVADA', reconciliada_at: new Date(), resultado },
      })
    },
  }
}

export type HeService = ReturnType<typeof heService>
