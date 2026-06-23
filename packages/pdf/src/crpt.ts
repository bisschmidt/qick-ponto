// Gerador do CRPT — Comprovante de Registro de Ponto do Trabalhador (M2)
// Formato: PDF A4 simplificado, gerado assincronamente pelo worker.
// A assinatura PAdES é aplicada após a geração do PDF base (node-signpdf).

import PDFDocument from 'pdfkit'

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_HE: 'Saída HE',
  ENTRADA_HE: 'Entrada HE',
  ENTRADA_COMPENSACAO: 'Entrada Compensação',
  SAIDA_COMPENSACAO: 'Saída Compensação',
  SAIDA_INTERVALO: 'Saída Intervalo',
  RETORNO_INTERVALO: 'Retorno Intervalo',
  SAIDA_PAUSA_NR17: 'Saída Pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno Pausa NR-17',
  SAIDA_PAUSA_FISIOLOGICA: 'Saída Pausa Fisiológica',
  RETORNO_PAUSA_FISIOLOGICA: 'Retorno Pausa Fisiológica',
  SAIDA_PAUSA_CRITICA: 'Saída Pausa Crítica',
  RETORNO_PAUSA_CRITICA: 'Retorno Pausa Crítica',
}

export interface DadosCrpt {
  nsr: bigint | number
  timestampMarcacao: Date
  tipo: string
  canal: string
  hashSha256: string

  // Colaborador
  nomeColaborador: string
  cpf: string
  pis: string
  matricula: string

  // Estabelecimento
  razaoSocial: string
  cnpj: string
  fusoHorario: string
}

function fmtCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function fmtCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function fmtPis(pis: string): string {
  return pis.replace(/^(\d{3})(\d{5})(\d{2})(\d{1})$/, '$1.$2.$3-$4')
}

function fmtDataHora(d: Date, fuso: string): string {
  return d.toLocaleString('pt-BR', { timeZone: fuso, hour12: false })
    .replace(',', ' —')
}

export function gerarCrptPdf(dados: DadosCrpt): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // PDF em modo ticket — largura A7, altura suficiente
    const doc = new PDFDocument({ margin: 20, size: [226, 400] })
    const chunks: Buffer[] = []

    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 40

    // ── Cabeçalho ───────────────────────────────────────────────
    doc.fontSize(9).font('Helvetica-Bold').text('COMPROVANTE DE PONTO', { align: 'center', width: W })
    doc.fontSize(7).font('Helvetica').text('(CRPT — REP-P Portaria 671/2021)', { align: 'center', width: W })
    doc.moveDown(0.5)

    // Linha separadora
    doc.moveTo(20, doc.y).lineTo(20 + W, doc.y).stroke()
    doc.moveDown(0.3)

    // ── Dados da marcação ─────────────────────────────────────────
    const linha = (label: string, valor: string) => {
      doc.font('Helvetica-Bold').fontSize(7).text(`${label}: `, { continued: true })
      doc.font('Helvetica').text(valor)
    }

    linha('NSR', String(dados.nsr).padStart(9, '0'))
    linha('Data/Hora', fmtDataHora(dados.timestampMarcacao, dados.fusoHorario))
    linha('Tipo', TIPO_LABEL[dados.tipo] ?? dados.tipo)
    linha('Canal', dados.canal)

    doc.moveDown(0.4)
    doc.moveTo(20, doc.y).lineTo(20 + W, doc.y).stroke()
    doc.moveDown(0.3)

    // ── Dados do colaborador ──────────────────────────────────────
    linha('Colaborador', dados.nomeColaborador)
    linha('CPF', fmtCpf(dados.cpf))
    linha('PIS/NIT', fmtPis(dados.pis))
    linha('Matrícula', dados.matricula)

    doc.moveDown(0.4)
    doc.moveTo(20, doc.y).lineTo(20 + W, doc.y).stroke()
    doc.moveDown(0.3)

    // ── Empresa ───────────────────────────────────────────────────
    linha('Empresa', dados.razaoSocial)
    linha('CNPJ', fmtCnpj(dados.cnpj))

    doc.moveDown(0.4)
    doc.moveTo(20, doc.y).lineTo(20 + W, doc.y).stroke()
    doc.moveDown(0.3)

    // ── Hash de integridade ────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(6).text('Hash SHA-256 (integridade):')
    doc.font('Courier').fontSize(5.5).text(dados.hashSha256, { width: W })

    doc.moveDown(0.5)

    // ── Rodapé ─────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(6).fillColor('#666666')
    doc.text('Gerado por Qick Ponto — Qick.ai', { align: 'center', width: W })
    doc.text('Assinado digitalmente com certificado ICP-Brasil A1', { align: 'center', width: W })

    doc.end()
  })
}
