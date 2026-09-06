# @unicreditos/payment

Payment Engine: `PaymentIntent`, `PaymentRouterService`, `MercadoPagoAdapter`, webhook con firma
verificada e idempotencia real. Ver `docs/ROADMAP.md` Fase 4.

## Flujo (master prompt §14)

```
Installment → PaymentIntent → PaymentRouterService → MercadoPagoAdapter → Mercado Pago
```

`services/credit` nunca llama a Mercado Pago directamente — ni siquiera lo conoce. Todo pasa por
acá.

## Endpoints

- `POST /payment-intents` (auth) — crea un checkout real de Mercado Pago para una cuota pendiente.
- `GET /payment-intents/:id` (auth, dueño o staff).
- `GET /payment-intents/:id/receipt` (auth) — comprobante, solo si el pago está `APPROVED`.
- `POST /webhooks/mercadopago` — firma HMAC verificada **fail-closed** (sin secret o sin firma
  válida, 401 siempre — no como el prototipo auditado, que solo validaba si el secret estaba
  configurado). Idempotente vía `WebhookEvent(provider, providerEventId)`: un reintento del mismo
  evento no vuelve a acreditar el pago ni a duplicar el `AuditLog`.

## Regla dura

**El estado final de un pago viene siempre del webhook firmado**, nunca de que el usuario "vuelva"
del checkout (`back_urls.success`). El webhook llama a `MercadoPagoAdapter.getPayment()` — la
fuente de verdad es la API de Mercado Pago, no el payload del webhook en sí.

## Verificado (real, contra la sandbox de Mercado Pago y Supabase)

- Creación de checkout real: devuelve una URL válida de `sandbox.mercadopago.com.ar`.
- Webhook sin firma → 401. Webhook con firma inválida → 401.
- Webhook con firma **válida** (calculada con el secret real) pasa la verificación y llama a la
  API real de Mercado Pago — con un ID de pago inexistente, responde `PAYMENT_PROVIDER_UNAVAILABLE`
  ("Payment not found"), confirmando que habla con la API real y no con una simulación.
- El evento queda registrado en `WebhookEvent` con `processedAt: null` cuando falla antes de
  completarse, lo que permite reintentarlo — solo un evento con `processedAt` seteado se saltea.

## Pendiente

- Completar un pago real en la sandbox (tarjeta de prueba de Mercado Pago) para probar la
  acreditación de punta a punta — requiere un túnel HTTPS (ngrok o similar) para que Mercado Pago
  pueda llamar al webhook desde afuera, o completarlo manualmente simulando el webhook con un
  `providerPaymentId` real obtenido de un pago de sandbox.
- Reconciliación (`/admin/payments/reconciliation`, Provider vs Ledger vs Settlement) — Fase 5, cuando exista el ledger.
- Comprobante en PDF + envío por email — hoy es JSON.
- `AstroPayAdapter` — preparado en `PaymentRouterService.resolve()` como próximo país a agregar, pero no implementado sin documentación real de su API.
