import type { SistemaFolha } from '@prisma/client'
import type { PayrollConnector } from './connector.js'
import { questorConnector } from './questor.js'

const connectors: Record<SistemaFolha, PayrollConnector> = {
  QUESTOR: questorConnector,
}

export function getConnector(sistema: SistemaFolha): PayrollConnector {
  const c = connectors[sistema]
  if (!c) throw new Error(`Connector não implementado para sistema ${sistema}`)
  return c
}

export type { PayrollConnector, ContextoExportacao, EventoExportacao, ResultadoExportacao } from './connector.js'
