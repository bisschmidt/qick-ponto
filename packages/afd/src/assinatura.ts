import forge from 'node-forge'
import { createHash } from 'node:crypto'

export interface ResultadoAssinatura {
  p7s: Buffer
  hashSha256: string
}

// Assina o conteúdo do AFD usando CAdES Detached (PKCS#7)
// com o certificado ICP-Brasil A1 da Qick.ai.
//
// O arquivo .p7s resultante deve acompanhar o AFD.txt (mesmo nome base).
// Conforme Portaria MTP 671/2021, Anexo V, item 7.2.13.
export function assinarCadesDetached(
  conteudo: Buffer,
  pfxBase64: string,
  password: string,
): ResultadoAssinatura {
  // 1. Carrega o PKCS#12 (PFX) e extrai a chave privada + certificado
  const pfxDer = forge.util.decode64(pfxBase64)
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  let privateKey: forge.pki.PrivateKey | null = null
  let certificate: forge.pki.Certificate | null = null

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        privateKey = safeBag.key
      } else if (safeBag.type === forge.pki.oids.keyBag && safeBag.key) {
        privateKey = safeBag.key
      } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        if (!certificate) certificate = safeBag.cert
      }
    }
  }

  if (!privateKey || !certificate) {
    throw new Error('Certificado .pfx inválido — chave privada ou certificado não encontrado')
  }

  // 2. Cria o PKCS#7 SignedData com conteúdo destacado (detached)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(conteudo.toString('binary'))
  p7.addCertificate(certificate)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p7.addSigner({
    key: privateKey as forge.pki.rsa.PrivateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! } as { type: string; value: string },
      { type: forge.pki.oids.signingTime!, value: new Date() as unknown as string },
    ],
  })

  // detached: true → o conteúdo NÃO fica embutido no .p7s
  p7.sign({ detached: true })

  // 3. Serializa para DER (binário) — padrão para .p7s CAdES
  const asn1 = p7.toAsn1()
  const der = forge.asn1.toDer(asn1).getBytes()
  const p7s = Buffer.from(der, 'binary')

  const hashSha256 = createHash('sha256').update(conteudo).digest('hex')

  return { p7s, hashSha256 }
}
