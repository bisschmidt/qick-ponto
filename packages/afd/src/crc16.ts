// CRC-16 para o AFD (Portaria 671, Anexo V)
//
// ⚠️  VALIDAÇÃO OBRIGATÓRIA ANTES DO GO-LIVE:
// A variante exata (polinômio, init, RefIn, RefOut, XorOut) DEVE ser confirmada
// contra o Anexo V oficial da Portaria 671 publicado em gov.br.
// A implementação abaixo usa CRC-16/IBM (polinômio 0x8005, init 0x0000,
// RefIn=true, RefOut=true, XorOut=0x0000) que é a variante mais comum em
// sistemas governamentais brasileiros, mas pode não ser a correta.
//
// Validação: obter um registro de exemplo do Anexo V com CRC esperado e
// testar com calcularCRC16() antes de gerar qualquer AFD de produção.

// Tabela de lookup pré-computada para CRC-16/IBM
const TABLE = buildTable()

function buildTable(): Uint16Array {
  const table = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1
    }
    table[i] = crc
  }
  return table
}

// Calcula o CRC-16 sobre o conteúdo em Latin-1
// Retorna string hexadecimal MAIÚSCULA de 4 chars (sem prefixo "0x")
export function calcularCRC16(conteudo: string): string {
  const bytes = Buffer.from(conteudo, 'latin1')
  let crc = 0x0000

  for (const byte of bytes) {
    const idx = (crc ^ byte) & 0xff
    const tableVal = TABLE[idx]
    if (tableVal === undefined) throw new Error('CRC table error')
    crc = (crc >>> 8) ^ tableVal
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}
