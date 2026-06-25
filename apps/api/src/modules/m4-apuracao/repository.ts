import type { PrismaClient } from '@prisma/client'
import type { DiaApurado } from './types.js'

export async function buscarMarcacoesParaApuracao(
  prisma: PrismaClient,
  tenantId: string,
  colaboradorId: string,
  dataInicio: Date,
  dataFim: Date,
) {
  return prisma.marcacao.findMany({
    where: {
      tenant_id: tenantId,
      colaborador_id: colaboradorId,
      timestamp_marcacao: { gte: dataInicio, lte: dataFim },
    },
    orderBy: { timestamp_marcacao: 'asc' },
    select: {
      tipo: true,
      timestamp_marcacao: true,
    },
  })
}

export async function buscarJornadaVigente(
  prisma: PrismaClient,
  colaboradorId: string,
  data: Date,
) {
  const vigencia = await prisma.colaboradorJornada.findFirst({
    where: {
      colaborador_id: colaboradorId,
      data_inicio: { lte: data },
      OR: [{ data_fim: null }, { data_fim: { gte: data } }],
    },
    orderBy: { data_inicio: 'desc' },
    include: {
      jornada: {
        include: { pausas: true, horarios: true },
      },
    },
  })
  return vigencia?.jornada ?? null
}

export async function buscarFeriadosDoPeriodo(
  prisma: PrismaClient,
  tenantId: string,
  dataInicio: Date,
  dataFim: Date,
  uf: string,
  municipio: string | null,
) {
  return prisma.feriado.findMany({
    where: {
      data_inicio: { lte: dataFim },
      data_fim: { gte: dataInicio },
      OR: [
        { tipo: 'NACIONAL', tenant_id: null },
        { tipo: 'ESTADUAL', uf },
        ...(municipio ? [{ tipo: 'MUNICIPAL' as const, municipio }] : []),
        { tipo: 'FACULTATIVO', tenant_id: tenantId },
      ],
    },
    select: { data_inicio: true, data_fim: true },
  })
}

export async function salvarJornadasApuradas(
  prisma: PrismaClient,
  tenantId: string,
  dias: DiaApurado[],
) {
  const dados = dias.map((d) => ({
    tenant_id: tenantId,
    colaborador_id: d.colaboradorId,
    data_referencia: d.data,
    entrada_real: d.entradaReal ?? null,
    saida_real: d.saidaReal ?? null,
    minutos_trabalhados: d.minutosTrabalhados,
    minutos_he_50: d.minutosHe50,
    minutos_he_100: d.minutosHe100,
    minutos_atraso: d.minutosAtraso,
    minutos_saida_antecipada: d.minutosSaidaAntecipada,
    minutos_ad_noturno: d.minutosAdNoturno,
    minutos_hora_reduzida: d.minutosHoraReduzida,
    pausas_nr17_concedidas: d.pausasNr17Concedidas,
    pausas_nr17_conformes: d.pausasNr17Conformes,
    status: d.status,
    eh_feriado: d.ehFeriado,
    eh_dsr: d.ehDsr,
    inconsistencias: d.inconsistencias,
  }))

  return prisma.$transaction(
    dados.map((d) =>
      prisma.jornadaApurada.upsert({
        where: {
          colaborador_id_data_referencia: {
            colaborador_id: d.colaborador_id,
            data_referencia: d.data_referencia,
          },
        },
        create: d,
        update: {
          entrada_real:           d.entrada_real,
          saida_real:             d.saida_real,
          minutos_trabalhados:    d.minutos_trabalhados,
          minutos_he_50:          d.minutos_he_50,
          minutos_he_100:         d.minutos_he_100,
          minutos_atraso:         d.minutos_atraso,
          minutos_saida_antecipada: d.minutos_saida_antecipada,
          minutos_ad_noturno:     d.minutos_ad_noturno,
          minutos_hora_reduzida:  d.minutos_hora_reduzida,
          pausas_nr17_concedidas: d.pausas_nr17_concedidas,
          pausas_nr17_conformes:  d.pausas_nr17_conformes,
          status:                 d.status,
          inconsistencias:        d.inconsistencias,
        },
      }),
    ),
  )
}

export async function buscarJornadasApuradas(
  prisma: PrismaClient,
  tenantId: string,
  colaboradorId: string,
  dataInicio: Date,
  dataFim: Date,
) {
  return prisma.jornadaApurada.findMany({
    where: {
      tenant_id: tenantId,
      colaborador_id: colaboradorId,
      data_referencia: { gte: dataInicio, lte: dataFim },
    },
    orderBy: { data_referencia: 'asc' },
  })
}

export async function buscarResumoApuracao(
  prisma: PrismaClient,
  tenantId: string,
  dataInicio: Date,
  dataFim: Date,
) {
  return prisma.jornadaApurada.groupBy({
    by: ['colaborador_id'],
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
    _count: {
      _all: true,
    },
  })
}
