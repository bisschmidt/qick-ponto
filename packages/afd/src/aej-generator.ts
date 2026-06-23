// Gerador do AEJ (Arquivo Eletrônico de Jornada) — Portaria MTP 671/2021, Anexo VI.
// O AEJ é o resultado da APURAÇÃO (jornadas calculadas), enquanto o AFD são as marcações brutas.

import { encodeLinha } from './encoding.js'

const pad = (s: string, len: number) => (s ?? '').padEnd(len, ' ').slice(0, len)
const padN = (n: string | number, len: number) => String(n).padStart(len, '0').slice(-len)

function fmtDataHora(d: Date): string {
  // YYYY-MM-DDThh:mm:ss-0300
  const z = (n: number) => String(n).padStart(2, '0')
  const tz = '-0300'
  // Converte para BRT
  const off = -3 * 60
  const brt = new Date(d.getTime() + (d.getTimezoneOffset() + off) * 60000)
  return `${brt.getFullYear()}-${z(brt.getMonth() + 1)}-${z(brt.getDate())}T${z(brt.getHours())}:${z(brt.getMinutes())}:${z(brt.getSeconds())}${tz}`
}

function fmtData(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`
}

function fmtHora(h: number, m: number): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${z(h)}:${z(m)}`
}

export interface EmpregadorAej {
  cnpj: string // 14 dígitos
  razaoSocial: string
  cnoOuCaepf?: string
  endereco: string
}

export interface EmpregadoAej {
  cpf: string // 11 dígitos
  pis: string // 11 ou 12 dígitos
  nome: string
  dataAdmissao: Date
  dataDesligamento?: Date | null
}

export interface MarcacaoDiaAej {
  cpf: string
  pis: string
  data: Date
  // Lista de horários "HH:MM" do dia, na ordem cronológica das marcações.
  marcacoes: string[]
}

export interface OcorrenciaAej {
  cpf: string
  pis: string
  data: Date
  codigo: string // ex.: "01" = falta abonada, "02" = atestado
  descricao: string
}

export interface JornadaContratualAej {
  cpf: string
  pis: string
  dataInicio: Date
  horaEntrada: string // "HH:MM"
  horaSaida: string   // "HH:MM"
  diasSemana: number[] // 0=Dom..6=Sáb
  intervalos: { inicio: string; duracaoMin: number }[]
}

export interface DadosAej {
  empregador: EmpregadorAej
  dataInicio: Date
  dataFim: Date
  empregados: EmpregadoAej[]
  jornadas: JornadaContratualAej[]
  marcacoes: MarcacaoDiaAej[]
  ocorrencias: OcorrenciaAej[]
}

export interface ResultadoAej {
  buffer: Buffer
  nomeArquivo: string
  contadores: { tipo2: number; tipo3: number; tipo4: number; tipo5: number; tipo6: number }
}

// ─── Builders ─────────────────────────────────────────────────────────────

function buildTipo1(emp: EmpregadorAej, dIni: Date, dFim: Date, agora: Date): string {
  return (
    '1' +
    '1' +                              // identificador = CNPJ
    padN(emp.cnpj, 14) +
    pad(emp.cnoOuCaepf ?? '', 14) +
    pad(emp.razaoSocial, 150) +
    pad('002', 25) +                   // versão do leiaute
    fmtData(dIni) +
    fmtData(dFim) +
    fmtDataHora(agora)
  )
}

function buildTipo2(emp: EmpregadorAej, agora: Date): string {
  return (
    '2' +
    fmtDataHora(agora) +
    '1' +
    padN(emp.cnpj, 14) +
    pad(emp.razaoSocial, 150) +
    pad(emp.endereco, 150)
  )
}

function buildTipo3(e: EmpregadoAej, agora: Date): string {
  return (
    '3' +
    fmtDataHora(agora) +
    'I' +                            // operação: I=inclusão
    padN(e.pis, 12) +
    padN(e.cpf, 11) +
    pad(e.nome, 52)
  )
}

function buildTipo4(m: MarcacaoDiaAej): string {
  // 7.2.5: marcações concatenadas separadas por hífen
  // Ex.: "08:00-10:00-10:10-12:00-12:10-14:00"
  const horarios = m.marcacoes.join('-')
  return (
    '4' +
    fmtData(m.data) +
    padN(m.pis, 12) +
    padN(m.cpf, 11) +
    pad(horarios, 200)
  )
}

function buildTipo5(j: JornadaContratualAej): string {
  // bitmap dias da semana (Dom..Sáb)
  const bitmap = [0, 1, 2, 3, 4, 5, 6].map((d) => (j.diasSemana.includes(d) ? '1' : '0')).join('')
  const intervalos = j.intervalos
    .map((i) => `${i.inicio}/${String(i.duracaoMin).padStart(3, '0')}`)
    .join('|')
  return (
    '5' +
    fmtData(j.dataInicio) +
    padN(j.pis, 12) +
    padN(j.cpf, 11) +
    j.horaEntrada +
    j.horaSaida +
    bitmap +
    pad(intervalos, 100)
  )
}

function buildTipo6(o: OcorrenciaAej): string {
  return (
    '6' +
    fmtData(o.data) +
    padN(o.pis, 12) +
    padN(o.cpf, 11) +
    pad(o.codigo, 2) +
    pad(o.descricao, 200)
  )
}

function buildTrailer(c: { tipo2: number; tipo3: number; tipo4: number; tipo5: number; tipo6: number }): string {
  return (
    '9' +
    padN(c.tipo2, 9) +
    padN(c.tipo3, 9) +
    padN(c.tipo4, 9) +
    padN(c.tipo5, 9) +
    padN(c.tipo6, 9)
  )
}

// ─── Gerador principal ────────────────────────────────────────────────────

export function gerarAej(dados: DadosAej): ResultadoAej {
  const agora = new Date()
  const linhas: Buffer[] = []

  linhas.push(encodeLinha(buildTipo1(dados.empregador, dados.dataInicio, dados.dataFim, agora)))
  linhas.push(encodeLinha(buildTipo2(dados.empregador, agora)))

  for (const e of dados.empregados) linhas.push(encodeLinha(buildTipo3(e, agora)))
  for (const m of dados.marcacoes)  linhas.push(encodeLinha(buildTipo4(m)))
  for (const j of dados.jornadas)   linhas.push(encodeLinha(buildTipo5(j)))
  for (const o of dados.ocorrencias) linhas.push(encodeLinha(buildTipo6(o)))

  const contadores = {
    tipo2: 1,
    tipo3: dados.empregados.length,
    tipo4: dados.marcacoes.length,
    tipo5: dados.jornadas.length,
    tipo6: dados.ocorrencias.length,
  }

  linhas.push(encodeLinha(buildTrailer(contadores)))

  const buffer = Buffer.concat(linhas)
  const nomeArquivo = `AEJ_${dados.empregador.cnpj}_${fmtData(dados.dataInicio)}_${fmtData(dados.dataFim)}.txt`
  return { buffer, nomeArquivo, contadores }
}
