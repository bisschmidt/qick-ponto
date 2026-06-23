import { describe, it, expect } from 'vitest'
import { calcularDia } from './calcular-dia.js'
import type { EntradaApuracao } from '../types.js'

// Jornada padrão 8h: 09:00–18:00 (com 1h intervalo descontada = 8h)
const jornadaPadrao: EntradaApuracao['jornada'] = {
  horaInicio: '09:00',
  horaFim: '18:00',
  duracaoMinutos: 480, // 8h
  toleranciaEntradaMin: 5,
  toleranciaSaidaMin: 5,
  toleranciaIntervalMin: 5,
  pausas: [
    {
      ordemNaSequencia: 1,
      duracaoMinMin: 60,
      computaNaJornada: false, // intervalo de almoço não computa
      ehNr17: false,
      ehIntervaloRefeicao: true,
    },
  ],
}

function entrada(overrides: Partial<EntradaApuracao> = {}): EntradaApuracao {
  return {
    colaboradorId: 'colab-001',
    data: new Date('2025-01-06T00:00:00Z'), // segunda-feira
    jornada: jornadaPadrao,
    marcacoes: [],
    ehFeriado: false,
    ehDsr: false,
    aliquotaHe50: 50,
    aliquotaHe100: 100,
    aliquotaNoturno: 20,
    ...overrides,
  }
}

function ts(hora: string, data = '2025-01-06'): Date {
  return new Date(`${data}T${hora}:00Z`)
}

describe('calcularDia', () => {
  it('falta sem marcação', () => {
    const resultado = calcularDia(entrada())
    expect(resultado.status).toBe('FALTA')
    expect(resultado.minutosTrabalhados).toBe(0)
  })

  it('falta com entrada mas sem saída', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [{ tipo: 'ENTRADA', timestamp: ts('09:00') }],
      }),
    )
    expect(resultado.status).toBe('FALTA')
    expect(resultado.inconsistencias).toContain('Par quebrado: entrada sem saída')
  })

  it('dia normal — entrada e saída pontuais, desconta intervalo', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('09:00') },
          { tipo: 'SAIDA_INTERVALO', timestamp: ts('12:00') },
          { tipo: 'RETORNO_INTERVALO', timestamp: ts('13:00') },
          { tipo: 'SAIDA', timestamp: ts('18:00') },
        ],
      }),
    )
    // 9h bruto - 1h intervalo = 8h = 480 min
    expect(resultado.minutosTrabalhados).toBe(480)
    expect(resultado.minutosHe50).toBe(0)
    expect(resultado.minutosAtraso).toBe(0)
  })

  it('atraso dentro da tolerância é perdoado', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('09:04') }, // 4 min de atraso (dentro dos 5)
          { tipo: 'SAIDA', timestamp: ts('18:00') },
        ],
      }),
    )
    expect(resultado.minutosAtraso).toBe(0)
    // Entrada conta como 09:00 → 9h bruto, mas sem pausa marcada não desconta intervalo
    expect(resultado.minutosTrabalhados).toBe(540) // 9h sem intervalo
  })

  it('atraso acima da tolerância conta integral', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('09:10') }, // 10 min exatos — excede tolerância de 5
          { tipo: 'SAIDA', timestamp: ts('18:00') },
        ],
      }),
    )
    expect(resultado.minutosAtraso).toBe(10)
  })

  it('horas extras classificadas como HE50 em dia normal', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('09:00') },
          { tipo: 'SAIDA_HE', timestamp: ts('20:00') }, // 2h a mais
        ],
      }),
    )
    // 11h bruto − 0 desconto (sem pausa marcada) = 660 min − 480 contratados = 180 min HE
    expect(resultado.minutosHe50).toBe(180)
    expect(resultado.minutosHe100).toBe(0)
  })

  it('horas extras em feriado classificadas como HE100', () => {
    const resultado = calcularDia(
      entrada({
        ehFeriado: true,
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('09:00') },
          { tipo: 'SAIDA', timestamp: ts('19:00') },
        ],
      }),
    )
    expect(resultado.minutosHe100).toBe(120) // 2h extras
    expect(resultado.minutosHe50).toBe(0)
    expect(resultado.ehFeriado).toBe(true)
  })

  it('adicional noturno em jornada 22h–06h', () => {
    const jornadaNoturna: EntradaApuracao['jornada'] = {
      horaInicio: '22:00',
      horaFim: '06:00',
      duracaoMinutos: 480,
      toleranciaEntradaMin: 5,
      toleranciaSaidaMin: 5,
      toleranciaIntervalMin: 5,
      pausas: [],
    }

    const resultado = calcularDia(
      entrada({
        jornada: jornadaNoturna,
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('22:00') },
          { tipo: 'SAIDA', timestamp: ts('06:00', '2025-01-07') },
        ],
      }),
    )

    // 22h–05h = 7h = 420 min noturnos, 05h–06h = 60 min diurnos
    expect(resultado.minutosAdNoturno).toBe(420)
    expect(resultado.minutosHoraReduzida).toBeGreaterThan(0)
  })

  it('gap acima de 15h gera inconsistência', () => {
    const resultado = calcularDia(
      entrada({
        marcacoes: [
          { tipo: 'ENTRADA', timestamp: ts('06:00') },
          { tipo: 'SAIDA', timestamp: ts('22:00') }, // 16h de gap
        ],
      }),
    )
    expect(resultado.inconsistencias.some((i) => i.includes('Gap'))).toBe(true)
  })

  it('dia de DSR sem trabalho não gera HE', () => {
    const resultado = calcularDia(
      entrada({
        ehDsr: true,
        marcacoes: [], // domingo sem marcação = falta/DSR esperado
      }),
    )
    expect(resultado.minutosHe50).toBe(0)
    expect(resultado.minutosHe100).toBe(0)
  })
})
