// Interface base para conectores de sistemas de folha externos.
// Cada sistema (Questor, Sankhya, Senior, etc.) implementa essa interface.

import type { EventoFolhaTipo, SistemaFolha } from '@prisma/client'

// Um evento já totalizado por colaborador para o período de exportação
export interface EventoExportacao {
  colaboradorId: string
  colaboradorNome: string
  codigoExternoColaborador: string
  evento: EventoFolhaTipo
  codigoExternoEvento: string
  // Quantidade totalizada do evento. Para eventos em horas → minutos. Para faltas → dias.
  // Cada connector decide como formatar.
  quantidadeMinutos?: number
  quantidadeDias?: number
}

export interface ContextoExportacao {
  sistema: SistemaFolha
  codigoEmpresa: string
  cnpjEstabId: string
  competenciaInicio: Date
  competenciaFim: Date
  tenantId: string
  eventos: EventoExportacao[]
}

export interface ResultadoExportacao {
  buffer: Buffer
  nomeArquivo: string
  totalLinhas: number
  contentType: string
}

export interface PayrollConnector {
  sistema: SistemaFolha
  // Gera o arquivo. Validação prévia (eventos sem mapeamento, colab sem código) é feita no service.
  gerarArquivo(ctx: ContextoExportacao): ResultadoExportacao
}
