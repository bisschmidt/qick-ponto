import type { PrismaClient } from '@prisma/client'
import { gerarEspelhoPdf, type DiaEspelho } from '@qick/pdf'
import {
  criarPeriodo,
  buscarPeriodo,
  listarPeriodos,
  fecharPeriodo,
  criarEspelhos,
  buscarEspelhoComDados,
  buscarDiasApuradosParaEspelho,
  assinarEspelho,
  marcarNaoManifestado,
  buscarColaboradoresAtivosNoPeriodo,
} from './repository.js'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function statusParaLabel(status: string): string {
  const mapa: Record<string, string> = {
    PRESENTE: 'Presente',
    FALTA: 'Falta',
    ATESTADO: 'Atestado',
    AFASTAMENTO_INSS: 'INSS',
    FOLGA: 'Folga',
    FERIAS: 'Férias',
    DSR: 'DSR',
    SUSPENSAO: 'Suspensão',
    FERIADO: 'Feriado',
    COMPENSADO: 'Compensado',
    A_COMPENSAR: 'A Compensar',
    LICENCA_MATERNIDADE: 'Lic. Mat.',
    LICENCA_PATERNIDADE: 'Lic. Pat.',
    LICENCA_NAO_REMUNERADA: 'LNR',
    LICENCA_OUTRAS: 'Licença',
  }
  return mapa[status] ?? status
}

export function m6Service(db: PrismaClient) {
  return {
    async criarPeriodo(tenantId: string, dataInicio: Date, dataFim: Date) {
      return criarPeriodo(db, tenantId, dataInicio, dataFim)
    },

    async listarPeriodos(tenantId: string) {
      return listarPeriodos(db, tenantId)
    },

    async buscarPeriodo(tenantId: string, periodoId: string) {
      const periodo = await buscarPeriodo(db, tenantId, periodoId)
      if (!periodo) return null
      return {
        ...periodo,
        espelhos: periodo.espelhos.map((e) => ({
          ...e,
          status: e.nao_manifestado ? 'NAO_MANIFESTADO' : e.assinado ? 'ASSINADO_COLAB' : 'PENDENTE',
          assinado_colaborador_at: e.assinado_at ?? null,
        })),
      }
    },

    // Fechar período: marca como fechado e cria EspelhoPonto para todos os colaboradores
    async fecharPeriodo(
      tenantId: string,
      periodoId: string,
      cnpjEstabId: string,
      usuarioId: string,
    ) {
      const periodo = await buscarPeriodo(db, tenantId, periodoId)
      if (!periodo) throw new Error('Período não encontrado')
      if (periodo.fechado) throw new Error('Período já fechado')

      // Cria espelhos para todos os colaboradores ativos no período
      const colaboradores = await buscarColaboradoresAtivosNoPeriodo(
        db,
        tenantId,
        cnpjEstabId,
        periodo.data_inicio,
        periodo.data_fim,
      )

      await criarEspelhos(
        db,
        tenantId,
        periodoId,
        colaboradores.map((c) => c.id),
      )

      return fecharPeriodo(db, tenantId, periodoId, usuarioId)
    },

    // Gera o PDF do espelho e o retorna como Buffer (upload para S3 é responsabilidade do caller)
    async gerarPdfEspelho(tenantId: string, espelhoId: string): Promise<Buffer> {
      const espelho = await buscarEspelhoComDados(db, tenantId, espelhoId)
      if (!espelho) throw new Error('Espelho não encontrado')

      const dias = await buscarDiasApuradosParaEspelho(
        db,
        tenantId,
        espelho.colaborador_id,
        espelho.periodo.data_inicio,
        espelho.periodo.data_fim,
      )

      const diasEspelho: DiaEspelho[] = dias.map((d) => ({
        data: d.data_referencia,
        diaSemana: DIAS_SEMANA[d.data_referencia.getUTCDay()] ?? '',
        ...(d.entrada_real ? { entrada: d.entrada_real } : {}),
        ...(d.saida_real ? { saida: d.saida_real } : {}),
        minutosTrabalhados: d.minutos_trabalhados,
        minutosHe50: d.minutos_he_50,
        minutosHe100: d.minutos_he_100,
        minutosAtraso: d.minutos_atraso,
        minutosAdNoturno: d.minutos_ad_noturno,
        pausasNr17Conformes: d.pausas_nr17_conformes,
        status: statusParaLabel(d.status),
      }))

      const totalMinutosTrabalhados = dias.reduce((s, d) => s + d.minutos_trabalhados, 0)
      const totalMinutosHe50 = dias.reduce((s, d) => s + d.minutos_he_50, 0)
      const totalMinutosHe100 = dias.reduce((s, d) => s + d.minutos_he_100, 0)
      const totalMinutosAtraso = dias.reduce((s, d) => s + d.minutos_atraso, 0)
      const totalMinutosAdNoturno = dias.reduce((s, d) => s + d.minutos_ad_noturno, 0)

      const colab = espelho.colaborador
      const estab = colab.cnpj_estab

      return gerarEspelhoPdf({
        dataInicio: espelho.periodo.data_inicio,
        dataFim: espelho.periodo.data_fim,
        razaoSocial: estab.razao_social,
        cnpj: estab.cnpj,
        nomeColaborador: colab.nome_completo,
        cpf: colab.cpf,
        matricula: colab.matricula,
        cargo: colab.operacao_cliente, // usa operação como cargo
        dias: diasEspelho,
        totalMinutosTrabalhados,
        totalMinutosHe50,
        totalMinutosHe100,
        totalMinutosAtraso,
        totalMinutosAdNoturno,
      })
    },

    async assinarEspelho(tenantId: string, espelhoId: string, ip: string, assinadoPorId: string) {
      const espelho = await buscarEspelhoComDados(db, tenantId, espelhoId)
      if (!espelho) throw new Error('Espelho não encontrado')
      if (espelho.assinado) throw new Error('Espelho já assinado')
      if (espelho.nao_manifestado) throw new Error('Espelho marcado como não manifestado')

      return assinarEspelho(db, tenantId, espelhoId, ip, assinadoPorId)
    },

    async marcarNaoManifestado(tenantId: string, espelhoId: string) {
      return marcarNaoManifestado(db, tenantId, espelhoId)
    },

    async buscarEspelho(tenantId: string, espelhoId: string) {
      return buscarEspelhoComDados(db, tenantId, espelhoId)
    },
  }
}
