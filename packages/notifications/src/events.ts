import { sendEmail } from './email'
import { prisma } from '@unicreditos/database'

/**
 * Catálogo de eventos del NotificationEngine (master prompt §47). Implementados hoy: los que
 * ya disparan flujos reales (desembolso, pago, mora, KYC). El resto queda listado para no perder
 * de vista el catálogo completo, pero no se inventa contenido para eventos que ningún servicio
 * dispara todavía.
 */
export type NotificationEvent =
  | { type: 'CREDIT_DISBURSED'; userId: string; to: string; firstName: string; publicId: string; amount: number; disbursedTo: string }
  | { type: 'PAYMENT_RECEIVED'; userId: string; to: string; firstName: string; installmentNumber: number; amount: number; creditPublicId: string }
  | { type: 'PAYMENT_OVERDUE'; userId: string; to: string; firstName: string; installmentNumber: number; daysOverdue: number; amount: number; creditPublicId: string }
  | { type: 'KYC_APPROVED'; userId: string; to: string; firstName: string }
  | { type: 'KYC_REJECTED'; userId: string; to: string; firstName: string }

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

function render(event: NotificationEvent): { subject: string; text: string } {
  switch (event.type) {
    case 'CREDIT_DISBURSED':
      return {
        subject: `Tu crédito ${event.publicId} fue acreditado`,
        text: `Hola ${event.firstName},\n\nAcreditamos ${money(event.amount)} en tu cuenta terminada en ${event.disbursedTo.slice(-4)}. Folio ${event.publicId}.\n\nUNICRÉDITOS`,
      }
    case 'PAYMENT_RECEIVED':
      return {
        subject: `Recibimos tu pago · cuota ${event.installmentNumber}`,
        text: `Hola ${event.firstName},\n\nRegistramos tu pago de ${money(event.amount)} correspondiente a la cuota ${event.installmentNumber} del crédito ${event.creditPublicId}.\n\nUNICRÉDITOS`,
      }
    case 'PAYMENT_OVERDUE':
      return {
        subject: `Cuota ${event.installmentNumber} vencida hace ${event.daysOverdue} días`,
        text: `Hola ${event.firstName},\n\nLa cuota ${event.installmentNumber} de tu crédito ${event.creditPublicId} (${money(event.amount)}) está vencida hace ${event.daysOverdue} día(s). Podés regularizarla desde tu cuenta cuando quieras — cualquier duda, escribinos.\n\nUNICRÉDITOS`,
      }
    case 'KYC_APPROVED':
      return { subject: 'Tu identidad fue verificada', text: `Hola ${event.firstName},\n\nTu verificación de identidad quedó aprobada. Ya podés solicitar tu crédito.\n\nUNICRÉDITOS` }
    case 'KYC_REJECTED':
      return { subject: 'No pudimos verificar tu identidad', text: `Hola ${event.firstName},\n\nNo pudimos validar tu verificación de identidad. Podés intentarlo de nuevo desde tu cuenta.\n\nUNICRÉDITOS` }
  }
}

/**
 * Deja rastro de lo que YA pasa (sendEmail nunca lanza -- ver email.ts) -- nunca deja que un
 * fallo al loguear tire abajo al caller, que ya llama a esto fire-and-forget justo después de
 * confirmar un desembolso o un pago (mismo criterio que sendEmail).
 */
export async function notify(event: NotificationEvent) {
  const { subject, text } = render(event)
  const result = await sendEmail({ to: event.to, subject, text })

  try {
    await prisma.notificationLog.create({
      data: {
        userId: event.userId,
        type: event.type,
        to: event.to,
        subject,
        status: result.ok ? 'SENT' : 'FAILED',
        error: result.ok ? undefined : result.error,
      },
    })
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', context: 'notifications', message: 'No se pudo loguear la notificación', error: error instanceof Error ? error.message : String(error) }))
  }

  return result
}
