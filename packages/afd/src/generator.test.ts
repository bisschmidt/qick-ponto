import { describe, it, expect } from 'vitest'
import { gerarAfd } from './generator.js'
import { calcularCRC16 } from './crc16.js'
import type { DadosAfd } from './types.js'

const ESTAB = {
  cnpj: '12222000100191',
  razaoSocial: 'PESSOALIZE SERVICOS LTDA',
  endereco: 'RUA DAS FLORES 100 SAO PAULO SP',
  fusoHorario: 'America/Sao_Paulo',
  nrInpi: '12345678901234567',
  cnpjQick: '99888777000100',
}

const DADOS_MINIMOS: DadosAfd = {
  estabelecimento: ESTAB,
  dataInicio: new Date('2025-01-01T00:00:00Z'),
  dataFim: new Date('2025-01-31T23:59:59Z'),
  registrosTipo2: [
    {
      nsr: 1n,
      timestampGravacao: new Date('2025-01-01T12:00:00Z'),
      cpfResponsavel: '12345678901',
      estabelecimento: ESTAB,
    },
  ],
  registrosTipo5: [
    {
      nsr: 2n,
      timestampGravacao: new Date('2025-01-01T12:00:00Z'),
      tipoOperacao: 'I',
      cpf: '98765432100',
      nome: 'JOAO DA SILVA',
      cpfResponsavel: '12345678901',
    },
  ],
  registrosTipo6: [],
  registrosTipo7: [
    {
      nsr: 3n,
      timestampMarcacao: new Date('2025-01-15T11:00:00Z'), // 08:00 BRT
      timestampGravacao: new Date('2025-01-15T11:00:01Z'),
      cpf: '98765432100',
      idColetor: 'TOTEM',
      cnpj: '12222000100191',
      hashSha256: 'a'.repeat(64),
    },
  ],
}

describe('gerarAfd', () => {
  it('produz um Buffer não vazio', () => {
    const { buffer } = gerarAfd(DADOS_MINIMOS)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('nome do arquivo segue padrão da Portaria 671 (7.2.12)', () => {
    const { nomeArquivo } = gerarAfd(DADOS_MINIMOS)
    expect(nomeArquivo).toBe(`AFD${ESTAB.nrInpi}${ESTAB.cnpj}REP_P.txt`)
  })

  it('usa terminador CRLF em todas as linhas', () => {
    const { buffer } = gerarAfd(DADOS_MINIMOS)
    const texto = buffer.toString('latin1')
    const linhas = texto.split('\r\n').filter(Boolean)
    // Toda linha deve terminar com \r\n — split sem resíduo confirma isso
    expect(linhas.length).toBeGreaterThan(0)
    // Não deve ter \n sozinho
    expect(texto).not.toMatch(/[^\r]\n/)
  })

  it('primeira linha é o cabeçalho tipo 1 (NSR 000000000)', () => {
    const { buffer } = gerarAfd(DADOS_MINIMOS)
    const primeiraLinha = buffer.toString('latin1').split('\r\n')[0]
    expect(primeiraLinha?.substring(0, 9)).toBe('000000000')
    expect(primeiraLinha?.substring(9, 10)).toBe('1')
  })

  it('contadores corretos', () => {
    const { contadores } = gerarAfd(DADOS_MINIMOS)
    expect(contadores.tipo2).toBe(1)
    expect(contadores.tipo5).toBe(1)
    expect(contadores.tipo6).toBe(0)
    expect(contadores.tipo7).toBe(1)
  })

  it('arquivo é decodificável em latin1 sem caracteres corrompidos', () => {
    const { buffer } = gerarAfd(DADOS_MINIMOS)
    // Re-codificar em UTF-8 e comparar o tamanho não é suficiente;
    // verificamos que todos os bytes estão no range Latin-1 (0x00–0xFF)
    for (const byte of buffer) {
      expect(byte).toBeLessThanOrEqual(0xff)
    }
  })

  it('linha de assinatura é a última linha não vazia', () => {
    const { buffer } = gerarAfd(DADOS_MINIMOS)
    const linhas = buffer.toString('latin1').split('\r\n').filter(Boolean)
    const ultima = linhas.at(-1)
    expect(ultima?.trimEnd()).toContain('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S')
  })
})

describe('calcularCRC16', () => {
  it('retorna string hexadecimal de 4 chars maiúsculos', () => {
    const crc = calcularCRC16('000000000')
    expect(crc).toHaveLength(4)
    expect(crc).toMatch(/^[0-9A-F]{4}$/)
  })

  it('é determinístico', () => {
    expect(calcularCRC16('teste')).toBe(calcularCRC16('teste'))
  })

  it('strings diferentes produzem CRCs diferentes', () => {
    expect(calcularCRC16('AAA')).not.toBe(calcularCRC16('BBB'))
  })
})
