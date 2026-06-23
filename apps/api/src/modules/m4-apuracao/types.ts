import type { TipoMarcacao, StatusPonto } from '@prisma/client'

// Entrada do engine: dados de um dia de um colaborador
export interface EntradaApuracao {
  colaboradorId: string
  data: Date // dia referência (sempre a data da marcação de ENTRADA)

  // Jornada contratual do dia
  jornada: {
    horaInicio: string  // "HH:MM"
    horaFim: string
    duracaoMinutos: number
    toleranciaEntradaMin: number
    toleranciaSaidaMin: number
    toleranciaIntervalMin: number
    pausas: Array<{
      ordemNaSequencia: number
      duracaoMinMin: number
      computaNaJornada: boolean
      ehNr17: boolean
      ehIntervaloRefeicao: boolean
    }>
  }

  // Marcações brutas do dia (imutáveis — vêm do AFD)
  marcacoes: Array<{
    tipo: TipoMarcacao
    timestamp: Date
  }>

  // Contexto do dia
  ehFeriado: boolean
  ehDsr: boolean // domingo ou folga semanal

  // Alíquotas (do ACT vigente ou padrão legal)
  aliquotaHe50: number   // padrão 50
  aliquotaHe100: number  // padrão 100 (feriado/DSR)
  aliquotaNoturno: number // padrão 20
}

// Resultado da apuração de um dia
export interface DiaApurado {
  colaboradorId: string
  data: Date

  // Horários reais (após tolerância)
  entradaReal?: Date
  saidaReal?: Date

  // Tudo em minutos inteiros
  minutosTrabalhados: number
  minutosHe50: number         // HE comum (+50%)
  minutosHe100: number        // HE em feriado/DSR não compensado (+100%)
  minutosAtraso: number
  minutosSaidaAntecipada: number
  minutosAdNoturno: number    // minutos dentro do período noturno (22h–5h)
  minutosHoraReduzida: number // bônus de hora reduzida (cada 52'30" conta como 60')

  // Status do ponto
  status: StatusPonto
  ehFeriado: boolean
  ehDsr: boolean

  // Pausas NR-17
  pausasNr17Concedidas: number
  pausasNr17Conformes: boolean

  // Inconsistências encontradas (vão para M9)
  inconsistencias: string[]
}
