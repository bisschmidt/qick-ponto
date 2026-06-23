import { encodeLinha } from './encoding.js'
import {
  buildTipo1,
  buildTipo2,
  buildTipo5,
  buildTipo6,
  buildTipo7,
  buildTrailer,
  buildLinhaAssinatura,
} from './records.js'
import type { DadosAfd } from './types.js'

export type { DadosAfd }

export interface ResultadoAfd {
  // Buffer com o arquivo .txt em ISO 8859-1 com CRLF
  buffer: Buffer
  // Nome do arquivo conforme padrão da Portaria 671 (7.2.12)
  nomeArquivo: string
  // Contagem de registros por tipo (para log e validação)
  contadores: { tipo2: number; tipo5: number; tipo6: number; tipo7: number }
}

// Gera o arquivo AFD completo em memória.
// A assinatura CAdES (.p7s) é responsabilidade do worker de geração,
// que tem acesso ao certificado ICP-Brasil A1 da Qick.ai.
export function gerarAfd(dados: DadosAfd): ResultadoAfd {
  const linhas: Buffer[] = []

  // 1. Cabeçalho (tipo 1) — NSR fixo 000000000
  linhas.push(encodeLinha(buildTipo1(dados.estabelecimento, dados.dataInicio, dados.dataFim)))

  // 2. Registros tipo 2 (empresa)
  for (const r of dados.registrosTipo2) {
    linhas.push(encodeLinha(buildTipo2(r)))
  }

  // 3. Registros tipo 5 (colaboradores)
  for (const r of dados.registrosTipo5) {
    linhas.push(encodeLinha(buildTipo5(r)))
  }

  // 4. Registros tipo 6 (eventos sensíveis REP-P)
  for (const r of dados.registrosTipo6) {
    linhas.push(encodeLinha(buildTipo6(r)))
  }

  // 5. Registros tipo 7 (marcações)
  for (const r of dados.registrosTipo7) {
    linhas.push(encodeLinha(buildTipo7(r, dados.estabelecimento.fusoHorario)))
  }

  const contadores = {
    tipo2: dados.registrosTipo2.length,
    tipo5: dados.registrosTipo5.length,
    tipo6: dados.registrosTipo6.length,
    tipo7: dados.registrosTipo7.length,
  }

  // 6. Trailer/contador
  linhas.push(encodeLinha(buildTrailer(contadores)))

  // 7. Linha de assinatura (indica que .p7s está em arquivo separado)
  linhas.push(encodeLinha(buildLinhaAssinatura()))

  const buffer = Buffer.concat(linhas)

  // Nome do arquivo: AFD + INPI + CNPJ + REP_P.txt (7.2.12)
  const nomeArquivo = `AFD${dados.estabelecimento.nrInpi}${dados.estabelecimento.cnpj}REP_P.txt`

  return { buffer, nomeArquivo, contadores }
}
