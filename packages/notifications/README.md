# @unicreditos/notifications

Librería compartida para el NotificationEngine (master prompt §47). `sendEmail()` envía por
Resend real; `notify(event)` arma el asunto/cuerpo de un catálogo fijo de eventos y llama a
`sendEmail`. Se importa desde `services/credit` (desembolso), `services/payment` (pago recibido)
y `services/collection` (mora).

## Eventos implementados hoy

`CREDIT_DISBURSED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `KYC_APPROVED`, `KYC_REJECTED`.

Del catálogo completo del master prompt faltan: `PaymentDue` (recordatorio antes del vencimiento),
`PaymentFailed`, `ContractReady`, `SecurityAlert` — no se agregó contenido para eventos que ningún
servicio dispara todavía.

## Canales

Solo email (Resend) por ahora. SMS/WhatsApp quedan para cuando exista una integración autorizada
real (master prompt §47 — "cuando exista integración autorizada").

## Limitación conocida

El dominio de envío no está verificado en la cuenta de Resend del proyecto, así que en modo
sandbox solo se puede enviar a la dirección de prueba de la cuenta — cualquier otro destinatario
recibe `422` de Resend. La integración en sí es real y funciona (probado contra la API real); falta
verificar un dominio en el dashboard de Resend. Los rechazos quedan logueados
(`console.error` con el detalle de Resend), nunca en silencio.
