// Tipos internos do gerador de AFD

export interface Estabelecimento {
  cnpj: string          // 14 dígitos
  razaoSocial: string
  cnoOuCaepf?: string | undefined
  endereco: string
  fusoHorario: string   // ex.: "America/Sao_Paulo"
  nrInpi: string        // número de registro do REP-P no INPI
  cnpjQick: string      // CNPJ da Qick.ai (desenvolvedor)
}

export interface RegistroTipo2 {
  nsr: bigint
  timestampGravacao: Date
  cpfResponsavel: string
  estabelecimento: Estabelecimento
}

export interface RegistroTipo5 {
  nsr: bigint
  timestampGravacao: Date
  tipoOperacao: 'I' | 'A' | 'E'
  cpf: string
  nome: string
  cpfResponsavel: string
}

export interface RegistroTipo6 {
  nsr: bigint
  timestampGravacao: Date
  tipoEvento: '02' | '07' | '08'
}

export interface RegistroTipo7 {
  nsr: bigint
  timestampMarcacao: Date
  timestampGravacao: Date
  cpf: string
  idColetor: string
  cnpj: string
  hashSha256: string
}

export interface ContadorRegistros {
  tipo2: number
  tipo5: number
  tipo6: number
  tipo7: number
}

export interface DadosAfd {
  estabelecimento: Estabelecimento
  dataInicio: Date
  dataFim: Date
  registrosTipo2: RegistroTipo2[]
  registrosTipo5: RegistroTipo5[]
  registrosTipo6: RegistroTipo6[]
  registrosTipo7: RegistroTipo7[]
}
