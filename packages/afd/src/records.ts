// Construtores de cada tipo de registro do AFD
// ⚠️  Tamanhos e posições são referência do documento de negócio.
//     Validar contra Anexo V oficial da Portaria 671 antes do go-live.

import { padN, padA, formatDH, formatDate } from './encoding.js'
import { calcularCRC16 } from './crc16.js'
import type {
  Estabelecimento,
  RegistroTipo2,
  RegistroTipo5,
  RegistroTipo6,
  RegistroTipo7,
} from './types.js'

const FUSO_PADRAO = 'America/Sao_Paulo'

// ── Tipo 1: Cabeçalho ────────────────────────────────────────────────────────
// Tamanho: 302 chars + CRLF = 304 bytes
export function buildTipo1(estab: Estabelecimento, dataInicio: Date, dataFim: Date): string {
  const fuso = estab.fusoHorario ?? FUSO_PADRAO
  const corpo =
    padN('0', 9) +                    // campo 1: NSR fixo 000000000
    '1' +                              // campo 2: tipo
    '1' +                              // campo 3: tipo identificador empregador (1=CNPJ)
    padN(estab.cnpj, 14) +             // campo 4: CNPJ
    padA(estab.cnoOuCaepf ?? '', 14) + // campo 5: CNO/CAEPF
    padA(estab.razaoSocial, 150) +     // campo 6: razão social
    padN(estab.nrInpi, 17) +           // campo 7: registro INPI
    formatDate(dataInicio) +           // campo 8: data inicial (10)
    formatDate(dataFim) +              // campo 9: data final (10)
    formatDH(new Date(), fuso) +       // campo 10: data/hora geração (24)
    '003' +                            // campo 11: versão do layout
    '1' +                              // campo 12: tipo id fabricante (1=CNPJ)
    padN(estab.cnpjQick, 14) +         // campo 13: CNPJ Qick.ai
    padA('', 30)                       // campo 14: modelo (espaços para REP-P)

  const crc = calcularCRC16(corpo)
  return corpo + crc                   // campo 15: CRC-16
}

// ── Tipo 2: Identificação/alteração da empresa ────────────────────────────────
// Tamanho: 331 chars + CRLF = 333 bytes
export function buildTipo2(reg: RegistroTipo2): string {
  const fuso = reg.estabelecimento.fusoHorario ?? FUSO_PADRAO
  const corpo =
    padN(reg.nsr, 9) +
    '2' +
    formatDH(reg.timestampGravacao, fuso) +
    padN(reg.cpfResponsavel, 14) +
    '1' +
    padN(reg.estabelecimento.cnpj, 14) +
    padA(reg.estabelecimento.cnoOuCaepf ?? '', 14) +
    padA(reg.estabelecimento.razaoSocial, 150) +
    padA(reg.estabelecimento.endereco, 100)

  return corpo + calcularCRC16(corpo)
}

// ── Tipo 5: Inclusão/alteração/exclusão de colaborador ───────────────────────
// Tamanho: 118 chars + CRLF = 120 bytes
export function buildTipo5(reg: RegistroTipo5): string {
  const corpo =
    padN(reg.nsr, 9) +
    '5' +
    // ⚠️  DH de gravação: precisa do fuso do estabelecimento
    // Por ora usando UTC offset -0300 (São Paulo padrão); ajustar para multi-UF
    formatDH(reg.timestampGravacao, FUSO_PADRAO) +
    reg.tipoOperacao +                    // I / A / E
    padN(reg.cpf, 11) + ' ' +            // CPF 11 dígitos + 1 espaço = 12
    padA(reg.nome, 52) +
    padA('', 4) +                         // demais dados (uso interno)
    padN(reg.cpfResponsavel, 11)

  return corpo + calcularCRC16(corpo)
}

// ── Tipo 6: Eventos sensíveis do REP-P ───────────────────────────────────────
export function buildTipo6(reg: RegistroTipo6): string {
  const corpo =
    padN(reg.nsr, 9) +
    '6' +
    formatDH(reg.timestampGravacao, FUSO_PADRAO) +
    reg.tipoEvento   // "02" | "07" | "08"

  return corpo + calcularCRC16(corpo)
}

// ── Tipo 7: Marcação de ponto (REP-P) ────────────────────────────────────────
// Tamanho referência: 175 chars + CRLF = 177 bytes (sem CRC — usa SHA-256)
// ⚠️  Tamanho do campo CNPJ (campo 7): documento diz 12, mas CNPJ tem 14 dígitos.
//     Implementado com 14 para consistência. Validar contra Anexo V oficial.
export function buildTipo7(reg: RegistroTipo7, fusoEstab: string): string {
  return (
    padN(reg.nsr, 9) +
    '7' +
    formatDH(reg.timestampMarcacao, fusoEstab) +
    formatDH(reg.timestampGravacao, fusoEstab) +
    padN(reg.cpf, 11) +
    padA(reg.idColetor, 30) +
    padN(reg.cnpj, 14) +
    reg.hashSha256   // 64 chars hex minúsculo — sem CRC, conforme spec
  )
}

// ── Trailer/contador ──────────────────────────────────────────────────────────
// ⚠️  Formato exato (NSR 999999999, contagem por tipo) precisa de validação
//     contra Anexo V oficial da Portaria 671.
export function buildTrailer(contadores: {
  tipo2: number
  tipo5: number
  tipo6: number
  tipo7: number
}): string {
  return (
    padN('999999999', 9) +
    'T' +                          // literal do trailer (a confirmar no Anexo V)
    padN(contadores.tipo2, 9) +
    padN(contadores.tipo5, 9) +
    padN(contadores.tipo6, 9) +
    padN(contadores.tipo7, 9)
  )
}

// ── Linha de assinatura ───────────────────────────────────────────────────────
// ⚠️  Literal e tamanho a confirmar no Anexo V oficial
export function buildLinhaAssinatura(): string {
  return padA('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100)
}
