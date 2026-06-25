import { z } from 'zod'

export const criarColaboradorSchema = z.object({
  nome_completo: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[A-Za-zÀ-ÿ\s]+$/, 'Nome não pode conter caracteres especiais (impacto eSocial)'),
  cpf: z.string().length(11).regex(/^\d+$/, 'CPF deve conter apenas dígitos'),
  pis_nit: z.string().length(11).regex(/^\d+$/, 'PIS/NIT deve conter apenas dígitos'),
  matricula: z.string().min(1).max(50),
  cnpj_estab_id: z.string().uuid(),
  regime: z.enum(['CLT', 'APRENDIZ', 'ESTAGIO', 'PJ']),
  tipo_jornada_id: z.string().uuid(),
  data_admissao: z.string().date(),
  centro_custo: z.string().min(1).max(100),
  operacao_cliente: z.string().min(1).max(100),
  email_corporativo: z.string().email().optional(),
  whatsapp: z.string().max(20).optional(),
})

export const criarJornadaSchema = z.object({
  nome: z.string().min(1).max(100),
  tipo: z.enum([
    'PADRAO_CLT',
    'CALL_CENTER_NR17',
    'CALL_CENTER_COMP',
    'JORNADA_12_36',
    'JORNADA_24_48',
    'PERSONALIZADA',
  ]),
  // Horário base (fallback para dias sem override em `horarios`)
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1),
  valida_feriado: z.boolean().default(false),
  // Horário por dia da semana (override do base). Cada dia só pode aparecer uma vez.
  horarios: z
    .array(
      z.object({
        dia_semana: z.number().int().min(0).max(6),
        hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
        hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
      }),
    )
    .optional(),
  hora_inicio_sab: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hora_fim_sab: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hora_inicio_dom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hora_fim_dom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tolerancia_atraso_entrada: z.number().int().min(0).max(60).default(5),
  tolerancia_atraso_intervalo: z.number().int().min(0).max(60).default(5),
  tolerancia_antec_saida: z.number().int().min(0).max(60).default(5),
  tolerancia_antec_inicio_interv: z.number().int().min(0).max(60).default(5),
  janela_marcacao_min: z.number().int().min(0).max(60).default(15),
  pausas: z
    .array(
      z.object({
        nome: z.string().min(1).max(100),
        ordem: z.number().int().min(1),
        duracao_min: z.number().int().min(1),
        eh_nr17: z.boolean().default(false),
        eh_intervalo_refeicao: z.boolean().default(false),
        computa_jornada: z.boolean().default(true),
        janela_inicio_min: z.number().int().optional(),
        janela_fim_min: z.number().int().optional(),
      }),
    )
    .default([]),
  ciente_art59a: z.boolean().optional(), // obrigatório para 12/36 e 24/48
})

export const criarActSchema = z.object({
  sindicato: z.string().min(1).max(200),
  uf: z.string().length(2),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
  tolerancia_ampliada_min: z.number().int().optional(),
  banco_horas_meses: z.union([z.literal(6), z.literal(12)]).optional(),
  periodicidade_fechamento: z.enum(['quinzenal', 'mensal']).optional(),
  he_comum_aliquota: z.number().min(50).default(50),
  he_feriado_aliquota: z.number().min(100).default(100),
  adicional_noturno_aliquota: z.number().min(20).default(20),
})

export const editarColaboradorSchema = z.object({
  nome_completo:    z.string().min(3).max(100).regex(/^[A-Za-zÀ-ÿ\s]+$/).optional(),
  // Nome social NÃO restringe caracteres do nome civil (pode conter acento/hífen/espaço);
  // continua só para EXIBIÇÃO — nome civil é o usado em AFD/AEJ e documentos legais.
  nome_social:      z.string().max(100).optional(),
  usar_nome_social: z.boolean().optional(),
  email_corporativo: z.string().email().optional(),
  whatsapp:         z.string().max(20).optional(),
  centro_custo:     z.string().min(1).max(100).optional(),
  operacao_cliente: z.string().min(1).max(100).optional(),
  cargo:            z.string().max(100).optional(),
  time_nome:        z.string().max(100).optional(),
  departamento:     z.string().max(100).optional(),
  nova_jornada_id:  z.string().uuid().optional(), // cria novo ColaboradorJornada se informado
})

// Configurações de marcação por colaborador (aba "Configurações")
export const configMarcacaoSchema = z.object({
  validacao_facial: z.boolean().optional(),
  canal_app:        z.boolean().optional(),
  canal_quiosque:   z.boolean().optional(),
  canal_computador: z.boolean().optional(),
})

export type CriarColaboradorInput = z.infer<typeof criarColaboradorSchema>
export type EditarColaboradorInput = z.infer<typeof editarColaboradorSchema>
export type ConfigMarcacaoInput = z.infer<typeof configMarcacaoSchema>
export type CriarJornadaInput = z.infer<typeof criarJornadaSchema>
export type CriarActInput = z.infer<typeof criarActSchema>
