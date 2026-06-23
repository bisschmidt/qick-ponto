import { ServerClient } from 'postmark'

let client: ServerClient | null = null

function getClient(): ServerClient {
  if (!client) {
    const token = process.env['POSTMARK_SERVER_TOKEN']
    if (!token) throw new Error('POSTMARK_SERVER_TOKEN não configurado')
    client = new ServerClient(token)
  }
  return client
}

export async function enviarEmailOnboarding(params: {
  destinatario: string
  nomeColaborador: string
  token: string
}) {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3001'
  const from = process.env['FROM_EMAIL'] ?? 'ponto@qick.ai'
  const link = `${appUrl}/onboarding?token=${params.token}`

  await getClient().sendEmail({
    From: from,
    To: params.destinatario,
    Subject: 'Seu acesso ao Qick Ponto',
    HtmlBody: `
      <p>Olá, <strong>${params.nomeColaborador}</strong>!</p>
      <p>Você foi cadastrado no sistema de ponto eletrônico Qick Ponto.</p>
      <p>Clique no link abaixo para definir sua senha e aceitar o Aviso de Tratamento de Dados (LGPD):</p>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Acessar e definir senha</a></p>
      <p>Este link é válido por 72 horas.</p>
      <p>Se você não esperava este email, ignore-o.</p>
    `,
    TextBody: `Olá, ${params.nomeColaborador}!\n\nAcesse o link para definir sua senha:\n${link}\n\nLink válido por 72 horas.`,
    MessageStream: 'outbound',
  })
}
