const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/**
 * Envío real vía Resend (master prompt §47, NotificationEngine). Si no hay API key configurada
 * (dev/test), loguea en vez de fallar — pero nunca finge un envío exitoso cuando sí hay key y la
 * llamada falla: eso se devuelve como { ok: false }.
 */
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info(`[email:dev] ${input.to} · ${input.subject}\n${input.text}`)
    return { ok: true, delivered: false }
  }

  // Nunca deja escapar una excepción: todos los callers disparan esto "fire-and-forget"
  // (`void notify(...)`) justo después de confirmar un desembolso o un pago — una falla de red
  // acá no debe volverse un unhandled rejection que tire abajo el proceso que ya movió la plata.
  let res: Response
  try {
    res = await fetch(RESEND_ENDPOINT, {
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
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', context: 'notifications', message: 'Resend no respondió', error: error instanceof Error ? error.message : String(error), to: input.to }))
    return { ok: false, delivered: false, error: 'network_error' }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // Nunca silencioso: si Resend rechaza el envío (dominio no verificado, destinatario
    // restringido en sandbox, etc.) queda en el log estructurado del servicio que llamó a notify().
    console.error(JSON.stringify({ level: 'error', context: 'notifications', message: 'Resend rechazó el envío', status: res.status, detail, to: input.to }))
    return { ok: false, delivered: false, error: `Resend ${res.status}: ${detail}` }
  }
  return { ok: true, delivered: true }
}
