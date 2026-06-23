export { gerarAfd } from './generator.js'
export { calcularCRC16 } from './crc16.js'
export { calcularHashMarcacao } from './hash.js'
export { assinarCadesDetached } from './assinatura.js'
export type { ResultadoAssinatura } from './assinatura.js'
export { gerarAej } from './aej-generator.js'
export type {
  DadosAej,
  ResultadoAej,
  EmpregadorAej,
  EmpregadoAej,
  MarcacaoDiaAej,
  OcorrenciaAej,
  JornadaContratualAej,
} from './aej-generator.js'
export type { DadosAfd, ResultadoAfd } from './generator.js'
export type {
  Estabelecimento,
  RegistroTipo2,
  RegistroTipo5,
  RegistroTipo6,
  RegistroTipo7,
} from './types.js'
