// Questor — Leiaute 01 (55 posições)
//
// Linha: 0;PPPP;000;CCCCCCCCC;EEEE;0000;hhhhhhhhhnn;VVVVVVVVVVV;
//   col 1: "0" fixo
//   col 2: código empresa, 4 dígitos
//   col 3: "000" fixo
//   col 4: código funcionário, 9 dígitos
//   col 5: código evento, 4 dígitos
//   col 6: "0000" fixo
//   col 7: referência em horas, 11 dígitos (últimos 2 = minutos, demais = horas)
//   col 8: valor R$, 11 dígitos, 2 casas decimais — sempre zeros (folha calcula pelo salário)
// Cada coluna seguida de ";", inclusive a última.

import type { PayrollConnector, ContextoExportacao, ResultadoExportacao } from './connector.js'

function padN(v: string | number, len: number): string {
  return String(v).padStart(len, '0').slice(-len)
}

// minutos totais → "hhhhhhhhhnn" (11 dígitos)
function formatarHorasMinutos(minutosTotal: number): string {
  const horas = Math.floor(minutosTotal / 60)
  const minutos = minutosTotal % 60
  return padN(horas, 9) + padN(minutos, 2)
}

// dias → minutos (jornada padrão CLT 8h, mas para REP-P NR-17 são 6h)
// Por hora, considera 8h fixo (col 7 vai representar a jornada do dia em horas).
// TODO: parametrizar por jornada do colaborador quando houver dados confiáveis no período.
function diasParaMinutos(dias: number): number {
  return dias * 8 * 60
}

export const questorConnector: PayrollConnector = {
  sistema: 'QUESTOR',

  gerarArquivo(ctx: ContextoExportacao): ResultadoExportacao {
    const linhas: string[] = []
    const codigoEmpresa = padN(ctx.codigoEmpresa.replace(/\D/g, ''), 4)

    for (const ev of ctx.eventos) {
      const codFunc = padN(ev.codigoExternoColaborador.replace(/\D/g, ''), 9)
      const codEvento = padN(ev.codigoExternoEvento.replace(/\D/g, ''), 4)

      // Soma minutos diretos + dias convertidos. Eventos podem ter os dois (ex: hora extra
      // em horas, falta em dias).
      const minutosTotal =
        (ev.quantidadeMinutos ?? 0) +
        (ev.quantidadeDias ? diasParaMinutos(ev.quantidadeDias) : 0)
      if (minutosTotal <= 0) continue

      const referenciaHoras = formatarHorasMinutos(minutosTotal)
      const valor = padN(0, 11) // sempre zero — Questor calcula pelo salário cadastrado

      const linha = `0;${codigoEmpresa};000;${codFunc};${codEvento};0000;${referenciaHoras};${valor};`
      linhas.push(linha)
    }

    // CRLF entre linhas (padrão Windows usado por sistemas de folha)
    const conteudo = linhas.join('\r\n') + (linhas.length > 0 ? '\r\n' : '')
    const buffer = Buffer.from(conteudo, 'latin1')

    const ini = ctx.competenciaInicio.toISOString().slice(0, 7).replace('-', '')
    const nomeArquivo = `QUESTOR_${codigoEmpresa}_${ini}.txt`

    return {
      buffer,
      nomeArquivo,
      totalLinhas: linhas.length,
      contentType: 'text/plain; charset=iso-8859-1',
    }
  },
}
