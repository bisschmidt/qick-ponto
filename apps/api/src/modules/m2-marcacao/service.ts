import type { PrismaClient, Colaborador, CnpjEstabelecimento, Jornada, PausaConfig, TipoMarcacao } from '@prisma/client'
import type { RegistrarMarcacaoInput, AceiteLgpdInput } from './schema.js'
import { deduzirProximoTipo } from './sequencia.js'
import { persistirMarcacao } from './gravar.js'
import { Queue } from 'bullmq'

export function m2Service(db: PrismaClient, redisUrl: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crptQueue = redisUrl ? new Queue('crpt', { connection: { url: redisUrl } as any }) : null

  return {
    // ── Onboarding LGPD ───────────────────────────────────────────────────────

    async registrarAceiteLgpd(colaboradorId: string, tenantId: string, input: AceiteLgpdInput) {
      const colaborador = await db.colaborador.findFirst({
        where: { id: colaboradorId, tenant_id: tenantId },
      })
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
      if (colaborador.onboarding_ok) {
        throw { statusCode: 409, message: 'Aceite LGPD já registrado' }
      }

      await db.$transaction([
        db.aceiteLgpd.create({
          data: {
            colaborador_id: colaboradorId,
            timestamp_aceite: new Date(),
            ip: input.ip,
            versao_aviso: input.versao_aviso,
          },
        }),
        db.colaborador.update({
          where: { id: colaboradorId },
          data: { onboarding_ok: true },
        }),
      ])

      return { ok: true }
    },

    // ── Próximo evento esperado ────────────────────────────────────────────────

    async proximoEvento(colaboradorId: string, tenantId: string) {
      const { colaborador, jornada } = await resolverContexto(db, colaboradorId, tenantId)

      const agora = new Date()
      const { marcacoes, sessaoAnteriorAberta } = await buscarMarcacoesSessao(
        db, colaboradorId, tenantId, jornada, agora,
      )

      const proximo = deduzirProximoTipo(marcacoes, jornada.pausas)

      return {
        colaborador: { id: colaborador.id, nome: colaborador.nome_completo },
        proximoTipo: proximo,
        label: labelTipo(proximo),
        marcacoesHoje: marcacoes.map((m) => ({
          tipo: m.tipo,
          timestamp_marcacao: m.timestamp_marcacao.toISOString(),
        })),
        alerta: sessaoAnteriorAberta
          ? 'Ponto do turno anterior sem saída registrada. Solicite correção ao líder ou RH.'
          : null,
      }
    },

    // ── Registrar marcação ────────────────────────────────────────────────────

    async registrarMarcacao(colaboradorId: string, tenantId: string, input: RegistrarMarcacaoInput) {
      const { colaborador, cnpjEstab, jornada } = await resolverContexto(db, colaboradorId, tenantId)

      // Bloqueio: colaborador desligado não marca ponto
      if (!colaborador.ativo || colaborador.data_desligamento) {
        const desligado = colaborador.data_desligamento
          ? new Date(colaborador.data_desligamento) < new Date()
          : false
        if (desligado) {
          throw { statusCode: 403, message: 'Colaborador desligado — marcação bloqueada' }
        }
      }

      // Bloqueio: onboarding LGPD obrigatório antes da primeira marcação
      if (!colaborador.onboarding_ok) {
        throw {
          statusCode: 403,
          message: 'Aceite do Aviso de Tratamento de Dados pendente — conclua o onboarding primeiro',
        }
      }

      // Marcações da sessão atual (baseado na jornada, não no calendário)
      const hoje = new Date()
      const { marcacoes: marcacoesHoje, sessaoAnteriorAberta } = await buscarMarcacoesSessao(
        db, colaboradorId, tenantId, jornada, hoje,
      )

      const tipoMarcacao = deduzirProximoTipo(marcacoesHoje, jornada.pausas)

      // Bloquear retorno antecipado de pausa (NR-17 e intervalo refeição têm tempo mínimo obrigatório)
      if (tipoMarcacao === 'RETORNO_PAUSA_NR17' || tipoMarcacao === 'RETORNO_INTERVALO' || tipoMarcacao === 'RETORNO_PAUSA_FISIOLOGICA') {
        const tipoSaida = tipoMarcacao.replace('RETORNO', 'SAIDA') as string
        const ultimaSaida = [...marcacoesHoje].reverse().find((m) => m.tipo === tipoSaida)
        if (ultimaSaida) {
          let duracaoMinima = 10 // fallback

          if (tipoMarcacao === 'RETORNO_PAUSA_NR17') {
            // Qual NR-17 estamos retornando? Conta retornos já concluídos = índice da pausa atual
            const nr17Concluidas = marcacoesHoje.filter((m) => m.tipo === 'RETORNO_PAUSA_NR17').length
            const nr17Configs = jornada.pausas
              .filter((p) => p.eh_nr17 && !p.eh_intervalo_refeicao)
              .sort((a, b) => a.ordem - b.ordem)
            duracaoMinima = nr17Configs[nr17Concluidas]?.duracao_min ?? 10
          } else if (tipoMarcacao === 'RETORNO_INTERVALO') {
            // Intervalo de refeição: busca a pausa com eh_intervalo_refeicao=true
            const refeiConfig = jornada.pausas.find((p) => p.eh_intervalo_refeicao)
            duracaoMinima = refeiConfig?.duracao_min ?? 20
          } else {
            // Pausa fisiológica: pausa genérica sem flag especial
            const fisiConfig = jornada.pausas.find((p) => !p.eh_nr17 && !p.eh_intervalo_refeicao)
            duracaoMinima = fisiConfig?.duracao_min ?? 5
          }

          const decorridos = Math.floor((hoje.getTime() - ultimaSaida.timestamp_marcacao.getTime()) / 60000)
          if (decorridos < duracaoMinima) {
            const faltam = duracaoMinima - decorridos
            throw {
              statusCode: 422,
              message: `Pausa obrigatória: aguarde mais ${faltam} minuto(s) para retornar (mínimo ${duracaoMinima} min)`,
            }
          }
        }
      }

      // Verificar janela de marcação (sem bloquear — apenas flaggear)
      const foraJanela = verificarJanela(jornada, hoje, tipoMarcacao)

      // Verificar geofencing (sem bloquear — apenas flaggear)
      const foraArea = verificarGeofencing(input, cnpjEstab)

      // Gravar marcação com lastro fiscal (NSR + hash + AFD tipo 7 + CRPT)
      const { nsr, hashSha256, timestampMarcacao } = await persistirMarcacao(db, crptQueue, {
        tenantId,
        cnpjEstab,
        colaborador,
        tipo: tipoMarcacao,
        canal: input.canal,
        timestampDevice: input.timestamp_device ?? null,
        imagemRef: input.imagem_ref ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        foraArea,
        foraJanela,
      })

      // Alertar supervisor se fora da janela ou área
      if (foraJanela || foraArea) {
        // TODO: M10 — fila de alertas
      }

      return {
        nsr: nsr.toString(),
        tipo: tipoMarcacao,
        label: labelTipo(tipoMarcacao),
        timestamp_marcacao: timestampMarcacao.toISOString(),
        hash_sha256: hashSha256,
        fora_da_janela: foraJanela,
        fora_da_area: foraArea,
        crpt_disponivel_em_breve: true,
        alerta: sessaoAnteriorAberta
          ? 'Turno anterior sem saída registrada. Solicite correção ao líder ou RH.'
          : null,
      }
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolverContexto(db: PrismaClient, colaboradorId: string, tenantId: string) {
  const colaborador = await db.colaborador.findFirst({
    where: { id: colaboradorId, tenant_id: tenantId },
    include: {
      cnpj_estab: true,
      jornadas: {
        where: { data_fim: null },
        include: { jornada: { include: { pausas: { orderBy: { ordem: 'asc' } } } } },
        orderBy: { data_inicio: 'desc' },
        take: 1,
      },
    },
  })

  if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
  if (!colaborador.jornadas[0]) throw { statusCode: 422, message: 'Colaborador sem jornada ativa' }

  return {
    colaborador,
    cnpjEstab: colaborador.cnpj_estab,
    jornada: colaborador.jornadas[0].jornada,
  }
}

function verificarJanela(
  jornada: Jornada & { pausas: PausaConfig[] },
  agora: Date,
  _tipo: string,
): boolean {
  const [h, m] = jornada.hora_inicio.split(':').map(Number)
  if (h === undefined || m === undefined) return false

  const inicioMs = (h * 60 + m) * 60 * 1000
  const agoraMs = (agora.getHours() * 60 + agora.getMinutes()) * 60 * 1000
  const antecedenciaMs = jornada.janela_marcacao_min * 60 * 1000

  return agoraMs < inicioMs - antecedenciaMs
}

function verificarGeofencing(
  input: RegistrarMarcacaoInput,
  _cnpjEstab: CnpjEstabelecimento,
): boolean {
  // TODO: comparar com coordenadas e raio configurados no estabelecimento
  if (!input.latitude || !input.longitude) return false
  return false
}

// Calcula o início da janela de sessão baseado na jornada (não no calendário).
// Para jornadas noturnas (hora_fim < hora_inicio), quando estamos antes do fim,
// a sessão começou no dia anterior.
function calcularInicioJanelaSessao(jornada: { hora_inicio: string; hora_fim: string }, agora: Date): Date {
  const [hiH, hiM] = jornada.hora_inicio.split(':').map(Number) as [number, number]
  const [hfH, hfM] = jornada.hora_fim.split(':').map(Number) as [number, number]

  const inicioHoje = new Date(agora)
  inicioHoje.setHours(hiH, hiM, 0, 0)

  const fimHoje = new Date(agora)
  fimHoje.setHours(hfH, hfM, 0, 0)

  // Jornada noturna: hora_fim < hora_inicio (ex: 22:00–06:00)
  const ehNoturna = hfH < hiH || (hfH === hiH && hfM < hiM)
  if (ehNoturna && agora < fimHoje) {
    // Estamos na madrugada → sessão começou ontem às hora_inicio
    const inicioOntem = new Date(inicioHoje)
    inicioOntem.setDate(inicioOntem.getDate() - 1)
    return inicioOntem
  }

  return inicioHoje
}

// Busca as marcações da sessão atual usando janela baseada na jornada.
// Também detecta se há sessão anterior em aberto (ENTRADA sem SAIDA antes da janela atual).
async function buscarMarcacoesSessao(
  db: PrismaClient,
  colaboradorId: string,
  tenantId: string,
  jornada: { hora_inicio: string; hora_fim: string },
  agora: Date,
): Promise<{
  marcacoes: Array<{ tipo: TipoMarcacao; timestamp_marcacao: Date }>
  sessaoAnteriorAberta: boolean
}> {
  const inicioJanela = calcularInicioJanelaSessao(jornada, agora)

  const marcacoes = await db.marcacao.findMany({
    where: {
      colaborador_id: colaboradorId,
      tenant_id: tenantId,
      timestamp_marcacao: { gte: inicioJanela },
    },
    orderBy: { nsr: 'asc' },
    select: { tipo: true, timestamp_marcacao: true },
  })

  // Verifica sessão anterior em aberto: busca ENTRADA antes da janela atual sem SAIDA correspondente
  const marcacaoAnterior = await db.marcacao.findFirst({
    where: {
      colaborador_id: colaboradorId,
      tenant_id: tenantId,
      timestamp_marcacao: { lt: inicioJanela },
      tipo: 'ENTRADA',
    },
    orderBy: { nsr: 'desc' },
    select: { tipo: true, timestamp_marcacao: true },
  })

  let sessaoAnteriorAberta = false
  if (marcacaoAnterior) {
    // Verifica se essa ENTRADA tem uma SAIDA correspondente após ela e antes da janela atual
    const saidaAnterior = await db.marcacao.findFirst({
      where: {
        colaborador_id: colaboradorId,
        tenant_id: tenantId,
        timestamp_marcacao: {
          gt: marcacaoAnterior.timestamp_marcacao,
          lt: inicioJanela,
        },
        tipo: 'SAIDA',
      },
    })
    sessaoAnteriorAberta = !saidaAnterior
  }

  return { marcacoes, sessaoAnteriorAberta }
}

function labelTipo(tipo: string): string {
  const labels: Record<string, string> = {
    ENTRADA: 'Entrada',
    SAIDA_PAUSA_NR17: 'Saída — 1ª Pausa NR-17',
    RETORNO_PAUSA_NR17: 'Retorno — 1ª Pausa NR-17',
    SAIDA_INTERVALO: 'Saída para intervalo',
    RETORNO_INTERVALO: 'Retorno do intervalo',
    SAIDA_PAUSA_FISIOLOGICA: 'Saída — Pausa fisiológica',
    RETORNO_PAUSA_FISIOLOGICA: 'Retorno — Pausa fisiológica',
    SAIDA_PAUSA_CRITICA: 'Saída — Pausa por ocorrência crítica',
    RETORNO_PAUSA_CRITICA: 'Retorno — Pausa por ocorrência crítica',
    SAIDA: 'Saída (fim de jornada)',
    ENTRADA_HE: 'Entrada — Hora extra',
    SAIDA_HE: 'Saída — Hora extra',
  }
  return labels[tipo] ?? tipo
}

export type M2Service = ReturnType<typeof m2Service>
