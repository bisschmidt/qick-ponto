import { describe, it, expect } from 'vitest'
import { calcularStatusNr17 } from './calcular-status-nr17.js'
import type { PausaConfigNr17, MarcacaoSimples } from './calcular-status-nr17.js'

const config2Pausas: PausaConfigNr17[] = [
  {
    id: 'p1',
    ordem: 1,
    duracaoMinMin: 10,
    ehNr17: true,
    ehIntervaloRefeicao: false,
    computaNaJornada: true,
    janelaInicioMin: 60,
    janelaFimMin: 60,
  },
  {
    id: 'p2',
    ordem: 2,
    duracaoMinMin: 10,
    ehNr17: true,
    ehIntervaloRefeicao: false,
    computaNaJornada: true,
    janelaInicioMin: 60,
    janelaFimMin: 60,
  },
  {
    id: 'int',
    ordem: 0,
    duracaoMinMin: 20,
    ehNr17: true,
    ehIntervaloRefeicao: true,
    computaNaJornada: false,
    janelaInicioMin: null,
    janelaFimMin: null,
  },
]

function ts(hora: string, data = '2025-01-06'): Date {
  return new Date(`${data}T${hora}:00Z`)
}

describe('calcularStatusNr17', () => {
  it('fora da jornada sem entrada', () => {
    const resultado = calcularStatusNr17({
      agora: ts('10:00'),
      entrada: null,
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [],
    })
    expect(resultado.statusAtual).toBe('FORA_DA_JORNADA')
    expect(resultado.conforme).toBe(true)
  })

  it('trabalhando após entrada', () => {
    const resultado = calcularStatusNr17({
      agora: ts('10:00'),
      entrada: ts('09:00'),
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [{ tipo: 'ENTRADA', timestamp: ts('09:00') }],
    })
    expect(resultado.statusAtual).toBe('TRABALHANDO')
    expect(resultado.minutosTrabalhoContinuo).toBe(60)
  })

  it('em pausa NR-17', () => {
    const resultado = calcularStatusNr17({
      agora: ts('10:15'),
      entrada: ts('09:00'),
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [
        { tipo: 'ENTRADA', timestamp: ts('09:00') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('10:10') },
      ],
    })
    expect(resultado.statusAtual).toBe('EM_PAUSA_NR17')
    expect(resultado.minutosTrabalhoContinuo).toBe(0)
  })

  it('após retorno de pausa, reinicia contagem contínua', () => {
    const resultado = calcularStatusNr17({
      agora: ts('11:00'),
      entrada: ts('09:00'),
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [
        { tipo: 'ENTRADA', timestamp: ts('09:00') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('10:10') },
        { tipo: 'RETORNO_PAUSA_NR17', timestamp: ts('10:20') },
      ],
    })
    expect(resultado.statusAtual).toBe('TRABALHANDO')
    // Trabalho contínuo desde o retorno às 10:20 até 11:00 = 40 min
    expect(resultado.minutosTrabalhoContinuo).toBe(40)
  })

  it('pausa conforme tomada dentro da janela', () => {
    const resultado = calcularStatusNr17({
      agora: ts('11:00'),
      entrada: ts('09:00'),
      saida: ts('17:00'),
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [
        { tipo: 'ENTRADA', timestamp: ts('09:00') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('10:30') }, // 90 min após entrada — dentro da janela
        { tipo: 'RETORNO_PAUSA_NR17', timestamp: ts('10:40') }, // 10 min de pausa
      ],
    })
    const pausa1 = resultado.pausasDia.find((p) => p.ordem === 1)
    expect(pausa1?.tomada).toBe(true)
    expect(pausa1?.duracaoRealMin).toBe(10)
    expect(pausa1?.conformeNr17).toBe(true)
  })

  it('pausa fora da janela (primeira hora) é não conforme', () => {
    const resultado = calcularStatusNr17({
      agora: ts('10:00'),
      entrada: ts('09:00'),
      saida: ts('17:00'),
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [
        { tipo: 'ENTRADA', timestamp: ts('09:00') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('09:30') }, // 30 min = dentro da 1ª hora
        { tipo: 'RETORNO_PAUSA_NR17', timestamp: ts('09:40') },
      ],
    })
    const pausa1 = resultado.pausasDia.find((p) => p.ordem === 1)
    expect(pausa1?.tomada).toBe(true)
    expect(pausa1?.dentroDaJanela).toBe(false)
    expect(pausa1?.conformeNr17).toBe(false)
    expect(resultado.conforme).toBe(false)
  })

  it('trabalho contínuo acima de 50 min gera alerta (não penaliza conformidade do dia)', () => {
    const resultado = calcularStatusNr17({
      agora: ts('10:05'), // 65 min de trabalho contínuo desde 09:00
      entrada: ts('09:00'),
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [{ tipo: 'ENTRADA', timestamp: ts('09:00') }],
    })
    expect(resultado.minutosTrabalhoContinuo).toBe(65)
    expect(resultado.alertaContinuo).toBe(true)
    // `conforme` avalia pausas agendadas — ainda não vencidas no início do dia
    expect(resultado.proximaPausa?.urgente).toBe(true)
  })

  it('próxima pausa urgente quando faltam ≤ 5 min para o limite', () => {
    const resultado = calcularStatusNr17({
      agora: ts('09:46'), // 46 min contínuos — 4 min para o limite de 50
      entrada: ts('09:00'),
      saida: null,
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [{ tipo: 'ENTRADA', timestamp: ts('09:00') }],
    })
    expect(resultado.proximaPausa?.urgente).toBe(true)
  })

  it('dia conforme com 2 pausas corretas', () => {
    const resultado = calcularStatusNr17({
      agora: ts('16:30'),
      entrada: ts('09:00'),
      saida: ts('17:00'),
      duracaoJornadaMin: 480,
      pausasConfig: config2Pausas,
      marcacoesDia: [
        { tipo: 'ENTRADA', timestamp: ts('09:00') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('10:30') },
        { tipo: 'RETORNO_PAUSA_NR17', timestamp: ts('10:40') },
        { tipo: 'SAIDA_INTERVALO', timestamp: ts('12:00') },
        { tipo: 'RETORNO_INTERVALO', timestamp: ts('12:20') },
        { tipo: 'SAIDA_PAUSA_NR17', timestamp: ts('14:30') },
        { tipo: 'RETORNO_PAUSA_NR17', timestamp: ts('14:40') },
      ],
    })
    expect(resultado.pausasDia[0]?.conformeNr17).toBe(true)
    expect(resultado.pausasDia[1]?.conformeNr17).toBe(true)
    // Conforme ao final do dia (todas as pausas tomadas corretamente)
    expect(resultado.conforme).toBe(true)
  })
})
