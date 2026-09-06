const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendEmail(input: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info(`[email] (dev) ${input.to} · ${input.subject}\n${input.text}`)
    return { ok: true, delivered: false }
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'UNICRÉDITOS <no-responder@unicreditos.com>',
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html || `<p>${input.text.replace(/\n/g, '<br/>')}</p>`,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return { ok: false, delivered: false, error: `Resend ${res.status}` }
  return { ok: true, delivered: true }
}

export const emailStatus = { configured: isEmailConfigured() }
