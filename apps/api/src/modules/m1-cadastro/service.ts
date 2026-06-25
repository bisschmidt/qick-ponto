import { randomBytes } from 'node:crypto'
import type { M1Repository } from './repository.js'
import type { CriarColaboradorInput, EditarColaboradorInput, CriarJornadaInput, CriarActInput, ConfigMarcacaoInput } from './schema.js'
import { validarJornadaNR17 } from './validacoes-nr17.js'
import { hashSenha } from '../auth/router.js'
import { enviarEmailOnboarding } from '../../plugins/mailer.js'

export function m1Service(repo: M1Repository) {
  return {
    // ── Colaboradores ─────────────────────────────────────────────────────────

    async criarColaborador(tenantId: string, usuarioId: string, input: CriarColaboradorInput) {
      if (input.regime === 'PJ') {
        // PJ não gera ponto legal — pode cadastrar mas com flag
      }

      const existente = await repo.findColaboradorByCpf(tenantId, input.cpf)
      if (existente) {
        throw { statusCode: 409, message: 'CPF já cadastrado neste tenant' }
      }

      const cnpjEstab = await repo.findCnpjEstabById(tenantId, input.cnpj_estab_id)
      if (!cnpjEstab) {
        throw { statusCode: 422, message: 'Estabelecimento não encontrado neste tenant' }
      }

      const colaborador = await repo.createColaborador({
        tenant: { connect: { id: tenantId } },
        cnpj_estab: { connect: { id: input.cnpj_estab_id } },
        nome_completo: input.nome_completo,
        cpf: input.cpf,
        pis_nit: input.pis_nit,
        matricula: input.matricula,
        regime: input.regime,
        data_admissao: new Date(input.data_admissao),
        centro_custo: input.centro_custo,
        operacao_cliente: input.operacao_cliente,
        email_corporativo: input.email_corporativo ?? null,
        whatsapp: input.whatsapp ?? null,
      })

      if (input.tipo_jornada_id) {
        await repo.createColaboradorJornada({
          colaborador: { connect: { id: colaborador.id } },
          jornada:     { connect: { id: input.tipo_jornada_id } },
          data_inicio: new Date(input.data_admissao),
          usuario_id:  usuarioId,
        })
      }

      // Cria usuário com token de onboarding (72h)
      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 72 * 60 * 60 * 1000)
      await repo.createUsuario({
        colaborador: { connect: { id: colaborador.id } },
        tenant_id: tenantId,
        perfil: 'COLABORADOR',
        onboarding_token: token,
        onboarding_token_expires: expires,
      })

      // Envia email se o colaborador tem email cadastrado
      if (colaborador.email_corporativo) {
        try {
          await enviarEmailOnboarding({
            destinatario: colaborador.email_corporativo,
            nomeColaborador: colaborador.nome_completo,
            token,
          })
        } catch (err) {
          // Não falha o cadastro se o email não for enviado — loga apenas
          console.error('Erro ao enviar email de onboarding:', err)
        }
      }

      return colaborador
    },

    async editarColaborador(tenantId: string, colaboradorId: string, usuarioId: string, input: EditarColaboradorInput) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }

      const atualizado = await repo.updateColaborador(colaboradorId, {
        ...(input.nome_completo    ? { nome_completo: input.nome_completo }       : {}),
        ...(input.nome_social      !== undefined ? { nome_social: input.nome_social || null }              : {}),
        ...(input.usar_nome_social !== undefined ? { usar_nome_social: input.usar_nome_social }            : {}),
        ...(input.email_corporativo !== undefined ? { email_corporativo: input.email_corporativo ?? null } : {}),
        ...(input.whatsapp         !== undefined ? { whatsapp: input.whatsapp ?? null }                   : {}),
        ...(input.centro_custo     ? { centro_custo: input.centro_custo }         : {}),
        ...(input.operacao_cliente ? { operacao_cliente: input.operacao_cliente } : {}),
        ...(input.cargo            !== undefined ? { cargo: input.cargo || null }                : {}),
        ...(input.time_nome        !== undefined ? { time_nome: input.time_nome || null }        : {}),
        ...(input.departamento     !== undefined ? { departamento: input.departamento || null }  : {}),
      })

      if (input.nova_jornada_id) {
        // Encerra jornada atual
        const jornadaAtual = colaborador.jornadas[0]
        if (jornadaAtual) {
          await repo.encerrarColaboradorJornada(jornadaAtual.id, new Date())
        }
        // Cria nova vigência
        await repo.createColaboradorJornada({
          colaborador: { connect: { id: colaboradorId } },
          jornada:     { connect: { id: input.nova_jornada_id } },
          data_inicio: new Date(),
          usuario_id:  usuarioId,
        })
      }

      return atualizado
    },

    async listarColaboradores(tenantId: string, cnpjEstabId?: string) {
      return repo.findColaboradoresByTenant(tenantId, cnpjEstabId)
    },

    async buscarColaborador(tenantId: string, id: string) {
      const colaborador = await repo.findColaboradorById(tenantId, id)
      if (!colaborador) {
        throw { statusCode: 404, message: 'Colaborador não encontrado' }
      }
      return colaborador
    },

    // Configurações de marcação por colaborador (aba "Configurações")
    async configurarMarcacao(tenantId: string, colaboradorId: string, input: ConfigMarcacaoInput) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }

      return repo.updateColaborador(colaboradorId, {
        ...(input.validacao_facial !== undefined ? { validacao_facial: input.validacao_facial } : {}),
        ...(input.canal_app        !== undefined ? { canal_app: input.canal_app }               : {}),
        ...(input.canal_quiosque   !== undefined ? { canal_quiosque: input.canal_quiosque }     : {}),
        ...(input.canal_computador !== undefined ? { canal_computador: input.canal_computador } : {}),
      })
    },

    // Histórico bruto de marcações do colaborador (imutável; ajustes vêm como eventos separados).
    async historicoMarcacoes(tenantId: string, colaboradorId: string, limite = 200) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
      return repo.findMarcacoesByColaborador(tenantId, colaboradorId, limite)
    },

    // Dispositivos/canais a partir dos quais o colaborador registrou ponto (apoio antifraude).
    // Não há fingerprint de hardware — agrupamos por canal e sinalizamos marcações fora da área.
    async dispositivosColaborador(tenantId: string, colaboradorId: string) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
      const marcacoes = await repo.findMarcacoesByColaborador(tenantId, colaboradorId, 1000)

      const porCanal = new Map<string, { canal: string; total: number; primeiro: Date; ultimo: Date; foraDaArea: number }>()
      for (const m of marcacoes) {
        const atual = porCanal.get(m.canal)
        if (!atual) {
          porCanal.set(m.canal, {
            canal: m.canal,
            total: 1,
            primeiro: m.timestamp_marcacao,
            ultimo: m.timestamp_marcacao,
            foraDaArea: m.fora_da_area ? 1 : 0,
          })
        } else {
          atual.total++
          if (m.timestamp_marcacao < atual.primeiro) atual.primeiro = m.timestamp_marcacao
          if (m.timestamp_marcacao > atual.ultimo) atual.ultimo = m.timestamp_marcacao
          if (m.fora_da_area) atual.foraDaArea++
        }
      }
      return Array.from(porCanal.values()).sort((a, b) => b.ultimo.getTime() - a.ultimo.getTime())
    },

    async definirSenha(tenantId: string, colaboradorId: string, senha: string) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }

      const usuario = await repo.findUsuarioByColaboradorId(colaboradorId)
      if (!usuario) throw { statusCode: 404, message: 'Usuário não encontrado para este colaborador' }

      const hash = await hashSenha(senha)
      await repo.updateUsuarioSenha(usuario.id, hash)
    },

    async reenviarConvite(tenantId: string, colaboradorId: string) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }
      if (!colaborador.email_corporativo) throw { statusCode: 422, message: 'Colaborador sem email cadastrado' }

      const usuario = await repo.findUsuarioByColaboradorId(colaboradorId)
      if (!usuario) throw { statusCode: 404, message: 'Usuário não encontrado para este colaborador' }

      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 72 * 60 * 60 * 1000)

      await repo.updateUsuarioOnboardingToken(usuario.id, token, expires)

      await enviarEmailOnboarding({
        destinatario: colaborador.email_corporativo,
        nomeColaborador: colaborador.nome_completo,
        token,
      })
    },

    async registrarAceiteLgpd(tenantId: string, colaboradorId: string, ip: string) {
      const colaborador = await repo.findColaboradorById(tenantId, colaboradorId)
      if (!colaborador) throw { statusCode: 404, message: 'Colaborador não encontrado' }

      await repo.upsertAceiteLgpd(colaboradorId, ip)
      await repo.setOnboardingOk(colaboradorId)
    },

    // ── Jornadas ──────────────────────────────────────────────────────────────

    async criarJornada(tenantId: string, input: CriarJornadaInput) {
      // Jornadas 12/36 e 24/48 exigem ciência do Art. 59-A
      const requerCiencia = ['JORNADA_12_36', 'JORNADA_24_48'].includes(input.tipo)
      if (requerCiencia && !input.ciente_art59a) {
        throw {
          statusCode: 422,
          message: 'Jornadas 12/36 e 24/48 exigem marcação de "Ciente das obrigações legais" (Art. 59-A)',
        }
      }

      // Horários por dia só fazem sentido em dias da escala, e cada dia uma vez
      const horarios = input.horarios ?? []
      const diasVistos = new Set<number>()
      for (const h of horarios) {
        if (!input.dias_semana.includes(h.dia_semana)) {
          throw { statusCode: 422, message: `Horário definido para um dia fora da escala (dia ${h.dia_semana})` }
        }
        if (diasVistos.has(h.dia_semana)) {
          throw { statusCode: 422, message: `Dia ${h.dia_semana} tem mais de um horário` }
        }
        diasVistos.add(h.dia_semana)
      }

      // Jornadas NR-17: validação hard das pausas (horário base + cada dia)
      const ehNR17 = ['CALL_CENTER_NR17', 'CALL_CENTER_COMP'].includes(input.tipo)
      if (ehNR17) {
        const erroNR17 = validarJornadaNR17(input)
        if (erroNR17) {
          throw { statusCode: 422, message: erroNR17 }
        }
      }

      return repo.createJornada({
        tenant: { connect: { id: tenantId } },
        nome: input.nome,
        tipo: input.tipo,
        hora_inicio: input.hora_inicio,
        hora_fim: input.hora_fim,
        dias_semana: input.dias_semana,
        valida_feriado: input.valida_feriado,
        hora_inicio_sab: input.hora_inicio_sab ?? null,
        hora_fim_sab: input.hora_fim_sab ?? null,
        hora_inicio_dom: input.hora_inicio_dom ?? null,
        hora_fim_dom: input.hora_fim_dom ?? null,
        tolerancia_atraso_entrada: input.tolerancia_atraso_entrada,
        tolerancia_atraso_intervalo: input.tolerancia_atraso_intervalo,
        tolerancia_antec_saida: input.tolerancia_antec_saida,
        tolerancia_antec_inicio_interv: input.tolerancia_antec_inicio_interv,
        janela_marcacao_min: input.janela_marcacao_min,
        requer_act: requerCiencia,
        ciente_art59a: input.ciente_art59a ?? false,
        pausas: {
          create: input.pausas.map((p) => ({
            nome: p.nome,
            ordem: p.ordem,
            duracao_min: p.duracao_min,
            eh_nr17: p.eh_nr17,
            eh_intervalo_refeicao: p.eh_intervalo_refeicao,
            computa_jornada: p.computa_jornada,
            janela_inicio_min: p.janela_inicio_min ?? null,
            janela_fim_min: p.janela_fim_min ?? null,
          })),
        },
        horarios: {
          create: horarios.map((h) => ({
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio,
            hora_fim: h.hora_fim,
          })),
        },
      })
    },

    async listarJornadas(tenantId: string) {
      return repo.findJornadasByTenant(tenantId)
    },

    async listarJornadasGestao(tenantId: string) {
      return repo.findJornadasGestao(tenantId)
    },

    async inativarJornada(tenantId: string, id: string, ativo: boolean) {
      const j = await repo.findJornadaById(tenantId, id)
      if (!j) throw { statusCode: 404, message: 'Jornada não encontrada' }
      return repo.setJornadaAtivo(id, ativo)
    },

    // Só exclui se nunca foi usada por nenhum colaborador — preserva histórico/auditoria.
    async excluirJornada(tenantId: string, id: string) {
      const j = await repo.findJornadaById(tenantId, id)
      if (!j) throw { statusCode: 404, message: 'Jornada não encontrada' }
      const vinculos = await repo.contarVinculosJornada(id)
      if (vinculos > 0) {
        throw {
          statusCode: 409,
          message: 'Esta jornada já foi usada por colaboradores e não pode ser excluída. Use "Inativar" para retirá-la de novos vínculos sem quebrar o histórico.',
        }
      }
      await repo.deleteJornada(id)
      return { ok: true }
    },

    // ── ACT ───────────────────────────────────────────────────────────────────

    async criarAct(tenantId: string, input: CriarActInput) {
      const inicio = new Date(input.data_inicio)
      const fim = new Date(input.data_fim)

      if (fim <= inicio) {
        throw { statusCode: 422, message: 'Data fim deve ser posterior à data início' }
      }

      return repo.createAct({
        tenant: { connect: { id: tenantId } },
        sindicato: input.sindicato,
        uf: input.uf,
        data_inicio: inicio,
        data_fim: fim,
        tolerancia_ampliada_min: input.tolerancia_ampliada_min ?? null,
        banco_horas_meses: input.banco_horas_meses ?? null,
        periodicidade_fechamento: input.periodicidade_fechamento ?? null,
        he_comum_aliquota: input.he_comum_aliquota,
        he_feriado_aliquota: input.he_feriado_aliquota,
        adicional_noturno_aliquota: input.adicional_noturno_aliquota,
      })
    },
  }
}

export type M1Service = ReturnType<typeof m1Service>
