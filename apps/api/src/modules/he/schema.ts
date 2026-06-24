import { z } from 'zod'

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'horário deve ser HH:MM')
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const lancarHeSchema = z.object({
  colaborador_id: z.string().uuid(),
  data: ymd,
  hora_inicio: hhmm,
  hora_fim: hhmm,
  tipo: z.enum(['REMUNERADA', 'COMPENSACAO']),
  motivo: z.string().max(300).optional(),
})

export const diaCompensacaoSchema = z.object({
  data: ymd,
  hora_inicio: hhmm,
  hora_fim: hhmm,
})

export const solicitarCompensacaoSchema = z.object({
  data_falta: ymd,
  motivo: z.string().min(3).max(300),
  dias: z.array(diaCompensacaoSchema).min(1),
})

export const alterarCompensacaoSchema = z.object({
  dias: z.array(diaCompensacaoSchema).min(1),
})

export const ajustarHeSchema = z.object({
  data: ymd.optional(),
  hora_inicio: hhmm,
  hora_fim: hhmm,
})

export const jornadaDoDiaQuerySchema = z.object({ data: ymd })

export const jornadaColaboradorQuerySchema = z.object({
  colaborador_id: z.string().uuid(),
  data: ymd,
})

export const criarCompensacaoGestorSchema = z.object({
  colaborador_id: z.string().uuid(),
  data_falta: ymd,
  motivo: z.string().min(3).max(300),
  dias: z.array(diaCompensacaoSchema).min(1),
})

export const obsSchema = z.object({ obs: z.string().min(1).max(300) })

export const configHeSchema = z.object({
  max_min_dia: z.number().int().positive().max(1440),
  max_min_semana: z.number().int().positive().max(10080),
  max_min_mes: z.number().int().positive().max(44640),
  intervalo_min_apos_jornada_min: z.number().int().nonnegative().max(1440),
})

export const baterHeSchema = z.object({
  canal: z.enum(['TOTEM', 'APP_MOBILE', 'WEB']).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  imagem_ref: z.string().optional(),
  timestamp_device: z.string().datetime().optional(),
})
