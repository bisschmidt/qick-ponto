import { z } from 'zod'

export const registrarMarcacaoSchema = z.object({
  canal: z.enum(['TOTEM', 'APP_MOBILE', 'WEB']),
  // Imagem/evidência antifraude — referência ao arquivo já enviado (upload prévio)
  imagem_ref: z.string().max(500).optional(),
  // Coordenadas (app mobile com geofencing)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Timestamp da marcação (enviado pelo device; o servidor usa como timestamp_marcacao)
  // Se ausente, usa o horário do servidor
  timestamp_device: z.string().datetime({ offset: true }).optional(),
})

export const aceiteLgpdSchema = z.object({
  versao_aviso: z.string().min(1).max(20),
  ip: z.string().max(45),
})

export type RegistrarMarcacaoInput = z.infer<typeof registrarMarcacaoSchema>
export type AceiteLgpdInput = z.infer<typeof aceiteLgpdSchema>
