import type { PrismaClient } from '@prisma/client'

export async function criarPeriodo(
  prisma: PrismaClient,
  tenantId: string,
  dataInicio: Date,
  dataFim: Date,
) {
  return prisma.periodoFechamento.create({
    data: {
      tenant_id: tenantId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
  })
}

export async function buscarPeriodo(prisma: PrismaClient, tenantId: string, periodoId: string) {
  return prisma.periodoFechamento.findFirst({
    where: { id: periodoId, tenant_id: tenantId },
    include: {
      espelhos: {
        include: {
          colaborador: {
            select: { id: true, nome_completo: true, matricula: true },
          },
        },
        orderBy: { colaborador: { nome_completo: 'asc' } },
      },
    },
  })
}

export async function listarPeriodos(prisma: PrismaClient, tenantId: string) {
  return prisma.periodoFechamento.findMany({
    where: { tenant_id: tenantId },
    orderBy: { data_inicio: 'desc' },
    include: {
      _count: { select: { espelhos: true } },
    },
  })
}

export async function fecharPeriodo(
  prisma: PrismaClient,
  tenantId: string,
  periodoId: string,
  fechadoPorId: string,
) {
  return prisma.periodoFechamento.update({
    where: { id: periodoId, tenant_id: tenantId },
    data: {
      fechado: true,
      fechado_at: new Date(),
      fechado_por: fechadoPorId,
    },
  })
}

export async function criarEspelhos(
  prisma: PrismaClient,
  tenantId: string,
  periodoId: string,
  colaboradorIds: string[],
) {
  return prisma.$transaction(
    colaboradorIds.map((id) =>
      prisma.espelhoPonto.upsert({
        where: { periodo_id_colaborador_id: { periodo_id: periodoId, colaborador_id: id } },
        create: {
          tenant_id: tenantId,
          periodo_id: periodoId,
          colaborador_id: id,
        },
        update: {},
      }),
    ),
  )
}

export async function buscarEspelhoComDados(
  prisma: PrismaClient,
  tenantId: string,
  espelhoId: string,
) {
  return prisma.espelhoPonto.findFirst({
    where: { id: espelhoId, tenant_id: tenantId },
    include: {
      periodo: true,
      colaborador: {
        include: { cnpj_estab: true },
      },
    },
  })
}

// Busca apurações do período para montar os dados do espelho
export async function buscarDiasApuradosParaEspelho(
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

export async function assinarEspelho(
  prisma: PrismaClient,
  tenantId: string,
  espelhoId: string,
  ip: string,
  assinadoPorId: string,
) {
  return prisma.espelhoPonto.update({
    where: { id: espelhoId, tenant_id: tenantId },
    data: {
      assinado: true,
      assinado_at: new Date(),
      assinado_ip: ip,
      assinado_por_id: assinadoPorId,
    },
  })
}

export async function marcarNaoManifestado(
  prisma: PrismaClient,
  tenantId: string,
  espelhoId: string,
) {
  return prisma.espelhoPonto.update({
    where: { id: espelhoId, tenant_id: tenantId },
    data: {
      nao_manifestado: true,
      nao_manifestado_at: new Date(),
    },
  })
}

export async function buscarColaboradoresAtivosNoPeriodo(
  prisma: PrismaClient,
  tenantId: string,
  cnpjEstabId: string,
  dataInicio: Date,
  dataFim: Date,
) {
  return prisma.colaborador.findMany({
    where: {
      tenant_id: tenantId,
      cnpj_estab_id: cnpjEstabId,
      ativo: true,
      data_admissao: { lte: dataFim },
      OR: [{ data_desligamento: null }, { data_desligamento: { gte: dataInicio } }],
    },
    select: { id: true },
  })
}
