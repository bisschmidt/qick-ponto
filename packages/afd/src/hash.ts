import { createHash } from 'node:crypto'

// Hash SHA-256 do registro tipo 7 do AFD (M7.2.10).
// Calculado sobre a concatenação dos campos 1–7 antes do padding com espaços.
export function calcularHashMarcacao(params: {
  nsr: bigint
  timestampMarcacao: Date
  timestampGravacao: Date
  cpf: string
  idColetor: string // canal: "TOTEM" | "APP_MOBILE" | "WEB"
  cnpj: string
}): string {
  const { nsr, timestampMarcacao, timestampGravacao, cpf, idColetor, cnpj } = params

  const nsrStr = String(nsr).padStart(9, '0')
  const tipo = '7'
  const dhMarcacao = formatarDH(timestampMarcacao)
  const dhGravacao = formatarDH(timestampGravacao)

  const input = nsrStr + tipo + dhMarcacao + dhGravacao + cpf + idColetor + cnpj

  return createHash('sha256').update(input, 'utf8').digest('hex')
}

// Formato DH do AFD: AAAA-MM-ddThh:mm:00ZZZZZ (segundos sempre "00")
function formatarDH(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const ano = date.getUTCFullYear()
  const mes = pad(date.getUTCMonth() + 1)
  const dia = pad(date.getUTCDate())
  const hora = pad(date.getUTCHours())
  const min = pad(date.getUTCMinutes())
  // Timestamps armazenados em UTC; no AFD convertem para fuso do estabelecimento (na geração)
  return `${pad(ano, 4)}-${mes}-${dia}T${hora}:${min}:00+0000`
}
