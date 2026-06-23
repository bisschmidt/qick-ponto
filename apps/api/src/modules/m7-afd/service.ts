import type { PrismaClient } from '@prisma/client'
import { gerarAfd, gerarAej, assinarCadesDetached } from '@qick/afd'
import type {
  DadosAfd,
  RegistroTipo5,
  RegistroTipo7,
  EmpregadoAej,
  JornadaContratualAej,
  MarcacaoDiaAej,
  OcorrenciaAej,
} from '@qick/afd'

// CNPJ da Qick.ai — assina todos os AFDs como desenvolvedora do REP-P
// (FAQ MTE questão 44 — usar CNPJ da desenvolvedora, não do tenant)
const CNPJ_QICK = process.env['CNPJ_QICK'] ?? '00000000000000'

// Número de registro do REP-P no INPI da Qick.ai
const NR_INPI = process.env['NR_INPI_QICK'] ?? '00000000000000000'

export function m7Service(db: PrismaClient) {
  return {
    async gerarAfdPorPeriodo(
      tenantId: string,
      cnpjEstabId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      // 1. Carregar o estabelecimento
      const estab = await db.cnpjEstabelecimento.findFirst({
        where: { id: cnpjEstabId, tenant_id: tenantId, ativo: true },
      })
      if (!estab) throw { statusCode: 404, message: 'Estabelecimento não encontrado' }

      // 2. Registros tipo 2: usar o registro do próprio estabelecimento
      //    (na prática, buscamos alterações de cadastro no período)
      const tipo2: DadosAfd['registrosTipo2'] = [
        {
          nsr: 1n, // NSR será o do primeiro registro tipo 2 no AfdRegistro
          timestampGravacao: estab.created_at,
          cpfResponsavel: '00000000000', // TODO: CPF do admin que cadastrou
          estabelecimento: {
            cnpj: estab.cnpj,
            razaoSocial: estab.razao_social,
            cnoOuCaepf: estab.cno_caepf ?? undefined,
            endereco: estab.endereco,
            fusoHorario: estab.fuso_horario,
            nrInpi: NR_INPI,
            cnpjQick: CNPJ_QICK,
          },
        },
      ]

      // 3. Registros tipo 5: colaboradores com movimento no período
      const colaboradores = await db.colaborador.findMany({
        where: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstabId,
          OR: [
            { data_admissao: { gte: dataInicio, lte: dataFim } },
            { data_desligamento: { gte: dataInicio, lte: dataFim } },
            // colaboradores ativos com marcações no período
            { marcacoes: { some: { timestamp_marcacao: { gte: dataInicio, lte: dataFim } } } },
          ],
        },
        orderBy: { created_at: 'asc' },
      })

      const tipo5: RegistroTipo5[] = colaboradores.map((c, i) => ({
        nsr: BigInt(i + 2), // NSRs tipo 5 começam após o tipo 2
        timestampGravacao: c.created_at,
        tipoOperacao: c.data_desligamento ? 'E' : 'I',
        cpf: c.cpf,
        nome: c.nome_completo,
        cpfResponsavel: '00000000000', // TODO: CPF do admin responsável
      }))

      // 4. Registros tipo 6: eventos de disponibilidade (por ora vazio — implementar com monitoramento)
      const tipo6: DadosAfd['registrosTipo6'] = []

      // 5. Registros tipo 7: marcações do período (do AfdRegistro — já gravados imutavelmente)
      const afdRegistros = await db.afdRegistro.findMany({
        where: {
          cnpj_estab_id: cnpjEstabId,
          tipo_registro: 7,
        },
        orderBy: { nsr: 'asc' },
      })

      // Também buscar as marcações para ter os timestamps e dados completos
      const marcacoes = await db.marcacao.findMany({
        where: {
          cnpj_estab_id: cnpjEstabId,
          tenant_id: tenantId,
          timestamp_marcacao: { gte: dataInicio, lte: dataFim },
        },
        include: { colaborador: true },
        orderBy: { nsr: 'asc' },
      })

      const tipo7: RegistroTipo7[] = marcacoes.map((m) => ({
        nsr: m.nsr,
        timestampMarcacao: m.timestamp_marcacao,
        timestampGravacao: m.timestamp_gravacao,
        cpf: m.colaborador.cpf,
        idColetor: m.canal,
        cnpj: estab.cnpj,
        hashSha256: m.hash_sha256,
      }))

      // 6. Gerar o arquivo
      const resultado = gerarAfd({
        estabelecimento: {
          cnpj: estab.cnpj,
          razaoSocial: estab.razao_social,
          cnoOuCaepf: estab.cno_caepf ?? undefined,
          endereco: estab.endereco,
          fusoHorario: estab.fuso_horario,
          nrInpi: NR_INPI,
          cnpjQick: CNPJ_QICK,
        },
        dataInicio,
        dataFim,
        registrosTipo2: tipo2,
        registrosTipo5: tipo5,
        registrosTipo6: tipo6,
        registrosTipo7: tipo7,
      })

      // 6b. Assinar o AFD com o certificado ICP-Brasil A1 (se disponível)
      const pfxB64 = process.env['CERT_PFX_BASE64']
      const pfxPwd = process.env['CERT_PFX_PASSWORD']
      let assinatura: { p7s: Buffer; nomeP7s: string; hashSha256: string } | null = null
      if (pfxB64 && pfxPwd) {
        const r = assinarCadesDetached(resultado.buffer, pfxB64, pfxPwd)
        assinatura = {
          p7s: r.p7s,
          nomeP7s: resultado.nomeArquivo.replace(/\.txt$/, '.p7s'),
          hashSha256: r.hashSha256,
        }
      }

      // 7. Registrar log da geração
      await db.geracaoArquivoFiscal.create({
        data: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstabId,
          tipo: 'AFD',
          data_inicio: dataInicio,
          data_fim: dataFim,
          solicitante_id: '00000000-0000-0000-0000-000000000000', // TODO: pegar do JWT
          concluido: true,
        },
      })

      return { ...resultado, assinatura }
    },

    async gerarAejPorPeriodo(
      tenantId: string,
      cnpjEstabId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      const estab = await db.cnpjEstabelecimento.findFirstOrThrow({
        where: { id: cnpjEstabId, tenant_id: tenantId },
      })

      // 1. Empregados com jornada vinculada (exclui admins/usuários sem regime de ponto)
      const colaboradores = await db.colaborador.findMany({
        where: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstabId,
          jornadas: { some: {} },
        },
        orderBy: { matricula: 'asc' },
      })

      const empregados: EmpregadoAej[] = colaboradores.map((c) => ({
        cpf: c.cpf,
        pis: c.pis_nit,
        nome: c.nome_completo,
        dataAdmissao: c.data_admissao,
        dataDesligamento: c.data_desligamento,
      }))

      // 2. Marcações agrupadas por colaborador + dia
      const marcacoesBrutas = await db.marcacao.findMany({
        where: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstabId,
          timestamp_marcacao: { gte: dataInicio, lte: dataFim },
        },
        orderBy: { timestamp_marcacao: 'asc' },
        include: { colaborador: { select: { cpf: true, pis_nit: true } } },
      })

      const grupo = new Map<string, MarcacaoDiaAej>()
      for (const m of marcacoesBrutas) {
        // Calcula dia em BRT (-3h da hora UTC)
        const brt = new Date(m.timestamp_marcacao.getTime() - 3 * 3600 * 1000)
        const diaStr = brt.toISOString().slice(0, 10)
        const key = `${m.colaborador_id}|${diaStr}`
        const horaStr = `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
        if (!grupo.has(key)) {
          grupo.set(key, {
            cpf: m.colaborador.cpf,
            pis: m.colaborador.pis_nit,
            data: new Date(`${diaStr}T00:00:00Z`),
            marcacoes: [],
          })
        }
        grupo.get(key)!.marcacoes.push(horaStr)
      }
      const marcacoes = Array.from(grupo.values())

      // 3. Jornadas contratuais vigentes no período
      const colabJornadas = await db.colaboradorJornada.findMany({
        where: {
          colaborador: { tenant_id: tenantId, cnpj_estab_id: cnpjEstabId },
          data_inicio: { lte: dataFim },
          OR: [{ data_fim: null }, { data_fim: { gte: dataInicio } }],
        },
        include: {
          colaborador: { select: { cpf: true, pis_nit: true } },
          jornada: true,
        },
      })

      const jornadas: JornadaContratualAej[] = colabJornadas.map((cj) => ({
        cpf: cj.colaborador.cpf,
        pis: cj.colaborador.pis_nit,
        dataInicio: cj.data_inicio,
        horaEntrada: cj.jornada.hora_inicio,
        horaSaida: cj.jornada.hora_fim,
        diasSemana: cj.jornada.dias_semana,
        intervalos: [],
      }))

      // 4. Ocorrências = ajustes aprovados no período (faltas justificadas)
      const ajustes = await db.ajuste.findMany({
        where: {
          tenant_id: tenantId,
          status: 'APROVADO_RH',
          data_ponto: { gte: dataInicio, lte: dataFim },
          colaborador: { cnpj_estab_id: cnpjEstabId },
        },
        include: {
          colaborador: { select: { cpf: true, pis_nit: true } },
          motivo: { select: { descricao: true } },
        },
      })

      const ocorrencias: OcorrenciaAej[] = ajustes.map((a) => ({
        cpf: a.colaborador.cpf,
        pis: a.colaborador.pis_nit,
        data: a.data_ponto,
        codigo: '10', // 10 = falta justificada (atestado/abono)
        descricao: `${a.motivo.descricao} - ${a.justificativa}`.slice(0, 200),
      }))

      // 4b. Faltas injustificadas (jornada com status FALTA e SEM ajuste aprovado)
      const faltasInj = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          status: 'FALTA',
          data_referencia: { gte: dataInicio, lte: dataFim },
          colaborador: { cnpj_estab_id: cnpjEstabId },
        },
        include: { colaborador: { select: { cpf: true, pis_nit: true } } },
      })

      const ajustePorChave = new Set(
        ajustes.map((a) => `${a.colaborador_id}|${a.data_ponto.toISOString().slice(0, 10)}`),
      )

      for (const f of faltasInj) {
        const chave = `${f.colaborador_id}|${f.data_referencia.toISOString().slice(0, 10)}`
        if (ajustePorChave.has(chave)) continue
        ocorrencias.push({
          cpf: f.colaborador.cpf,
          pis: f.colaborador.pis_nit,
          data: f.data_referencia,
          codigo: '99', // 99 = falta injustificada
          descricao: 'Falta injustificada',
        })
      }

      // 5. Gerar o arquivo
      const resultado = gerarAej({
        empregador: {
          cnpj: estab.cnpj,
          razaoSocial: estab.razao_social,
          ...(estab.cno_caepf ? { cnoOuCaepf: estab.cno_caepf } : {}),
          endereco: estab.endereco,
        },
        dataInicio,
        dataFim,
        empregados,
        jornadas,
        marcacoes,
        ocorrencias,
      })

      // 6. Assinar com A1 (se disponível)
      const pfxB64 = process.env['CERT_PFX_BASE64']
      const pfxPwd = process.env['CERT_PFX_PASSWORD']
      let assinatura: { p7s: Buffer; nomeP7s: string; hashSha256: string } | null = null
      if (pfxB64 && pfxPwd) {
        const r = assinarCadesDetached(resultado.buffer, pfxB64, pfxPwd)
        assinatura = {
          p7s: r.p7s,
          nomeP7s: resultado.nomeArquivo.replace(/\.txt$/, '.p7s'),
          hashSha256: r.hashSha256,
        }
      }

      // 7. Log
      await db.geracaoArquivoFiscal.create({
        data: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstabId,
          tipo: 'AEJ',
          data_inicio: dataInicio,
          data_fim: dataFim,
          solicitante_id: '00000000-0000-0000-0000-000000000000',
          concluido: true,
        },
      })

      return { ...resultado, assinatura }
    },

    async listarGeracoes(tenantId: string, cnpjEstabId: string) {
      return db.geracaoArquivoFiscal.findMany({
        where: { tenant_id: tenantId, cnpj_estab_id: cnpjEstabId },
        orderBy: { created_at: 'desc' },
        take: 50,
      })
    },
  }
}

export type M7Service = ReturnType<typeof m7Service>
