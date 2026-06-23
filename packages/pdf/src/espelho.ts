// Gerador do Espelho de Ponto (M6)
// Documento legal — exibição fiel do que está no banco, sem arredondamentos não-rastreáveis.
// O PDF é gerado em memória e retornado como Buffer.

import PDFDocument from 'pdfkit'

export interface DiaEspelho {
  data: Date
  diaSemana: string      // "Seg", "Ter", ...
  entrada?: Date
  saida?: Date
  minutosTrabalhados: number
  minutosHe50: number
  minutosHe100: number
  minutosAtraso: number
  minutosAdNoturno: number
  pausasNr17Conformes: boolean
  status: string
}

export interface DadosEspelho {
  // Período
  dataInicio: Date
  dataFim: Date

  // Empresa
  razaoSocial: string
  cnpj: string

  // Colaborador
  nomeColaborador: string
  cpf: string
  matricula: string
  cargo: string

  // Dias
  dias: DiaEspelho[]

  // Totais (pré-calculados pelo M4)
  totalMinutosTrabalhados: number
  totalMinutosHe50: number
  totalMinutosHe100: number
  totalMinutosAtraso: number
  totalMinutosAdNoturno: number
}

// Formata minutos como "Xh Ym"
function fmtMin(min: number): string {
  if (min === 0) return '-'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtHora(d?: Date): string {
  if (!d) return '-'
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

function fmtData(d: Date): string {
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function gerarEspelhoPdf(dados: DadosEspelho): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 80 // largura útil

    // ── Cabeçalho ──────────────────────────────────────────────────────────────

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('ESPELHO DE PONTO', { align: 'center' })

    doc.fontSize(10).font('Helvetica').moveDown(0.3)

    doc.text(
      `Período: ${fmtData(dados.dataInicio)} a ${fmtData(dados.dataFim)}`,
      { align: 'center' },
    )

    doc.moveDown(0.5)

    // Dados da empresa / colaborador
    const col1 = 40
    const col2 = 320

    doc.font('Helvetica-Bold').text('Empresa:', col1, doc.y, { continued: true })
    doc.font('Helvetica').text(` ${dados.razaoSocial}`)

    doc.font('Helvetica-Bold').text('CNPJ:', col1, doc.y, { continued: true })
    doc.font('Helvetica').text(
      ` ${dados.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`,
    )

    const yColabLine = doc.y
    doc.font('Helvetica-Bold').text('Colaborador:', col1, yColabLine, { continued: true })
    doc.font('Helvetica').text(` ${dados.nomeColaborador}`, { continued: false })

    doc.font('Helvetica-Bold').text('CPF:', col1, doc.y, { continued: true })
    doc.font('Helvetica').text(
      ` ${dados.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`,
    )

    doc.font('Helvetica-Bold').text('Matrícula:', col1, doc.y, { continued: true })
    doc.font('Helvetica').text(` ${dados.matricula}`)

    doc.moveDown(0.8)

    // ── Tabela de dias ─────────────────────────────────────────────────────────

    const cols = [
      { label: 'Data', width: 60 },
      { label: 'Dia', width: 30 },
      { label: 'Entrada', width: 52 },
      { label: 'Saída', width: 52 },
      { label: 'Trab.', width: 42 },
      { label: 'HE50', width: 38 },
      { label: 'HE100', width: 38 },
      { label: 'Atraso', width: 42 },
      { label: 'Noturno', width: 44 },
      { label: 'NR17', width: 30 },
      { label: 'Status', width: W - 428 },
    ]

    const tableLeft = 40
    let xPos = tableLeft
    const headerY = doc.y

    // Cabeçalho da tabela
    doc.rect(tableLeft, headerY, W, 16).fillAndStroke('#4a4a4a', '#4a4a4a')
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8)

    xPos = tableLeft
    for (const col of cols) {
      doc.text(col.label, xPos + 2, headerY + 4, { width: col.width, align: 'center' })
      xPos += col.width
    }

    doc.fillColor('black').font('Helvetica').fontSize(8)

    let rowY = headerY + 16
    let isAlternate = false

    for (const dia of dados.dias) {
      if (rowY > doc.page.height - 120) {
        doc.addPage()
        rowY = 40
      }

      const rowHeight = 14
      if (isAlternate) {
        doc.rect(tableLeft, rowY, W, rowHeight).fill('#f5f5f5')
      }
      doc.fillColor('black')

      const cells = [
        fmtData(dia.data),
        dia.diaSemana,
        fmtHora(dia.entrada),
        fmtHora(dia.saida),
        fmtMin(dia.minutosTrabalhados),
        fmtMin(dia.minutosHe50),
        fmtMin(dia.minutosHe100),
        fmtMin(dia.minutosAtraso),
        fmtMin(dia.minutosAdNoturno),
        dia.pausasNr17Conformes ? 'OK' : 'NC',
        dia.status,
      ]

      xPos = tableLeft
      for (let i = 0; i < cols.length; i++) {
        doc.text(cells[i] ?? '', xPos + 2, rowY + 3, {
          width: (cols[i]?.width ?? 50) - 4,
          align: 'center',
          lineBreak: false,
        })
        xPos += cols[i]?.width ?? 50
      }

      // Linha separadora
      doc.moveTo(tableLeft, rowY + rowHeight).lineTo(tableLeft + W, rowY + rowHeight).stroke('#cccccc')

      rowY += rowHeight
      isAlternate = !isAlternate
    }

    // ── Totais ─────────────────────────────────────────────────────────────────

    rowY += 4
    if (rowY > doc.page.height - 80) {
      doc.addPage()
      rowY = 40
    }

    doc.font('Helvetica-Bold').fontSize(9)
    doc.text(`Total trabalhado: ${fmtMin(dados.totalMinutosTrabalhados)}`, tableLeft, rowY)
    doc.text(`HE 50%: ${fmtMin(dados.totalMinutosHe50)}`, tableLeft + 160, rowY)
    doc.text(`HE 100%: ${fmtMin(dados.totalMinutosHe100)}`, tableLeft + 270, rowY)
    rowY += 14
    doc.text(`Atraso total: ${fmtMin(dados.totalMinutosAtraso)}`, tableLeft, rowY)
    doc.text(`Adicional noturno: ${fmtMin(dados.totalMinutosAdNoturno)}`, tableLeft + 160, rowY)

    // ── Assinatura ─────────────────────────────────────────────────────────────

    rowY += 50
    if (rowY > doc.page.height - 80) {
      doc.addPage()
      rowY = 40
    }

    doc.font('Helvetica').fontSize(9)
    doc.moveTo(tableLeft, rowY + 30).lineTo(tableLeft + 200, rowY + 30).stroke()
    doc.text('Assinatura do Colaborador', tableLeft, rowY + 33, { width: 200, align: 'center' })

    doc.moveTo(tableLeft + 280, rowY + 30).lineTo(tableLeft + 480, rowY + 30).stroke()
    doc.text('Assinatura do Empregador', tableLeft + 280, rowY + 33, { width: 200, align: 'center' })

    doc.fontSize(7).fillColor('#888888')
    doc.text(
      `Documento gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — Qick Ponto (Qick.ai)`,
      tableLeft,
      doc.page.height - 40,
      { align: 'center', width: W },
    )

    doc.end()
  })
}
