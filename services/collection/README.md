# @unicreditos/collection

Collection Engine: detección de mora a partir de fechas de vencimiento reales, casos de cobranza,
y notificaciones cuando un caso empeora. Ver `docs/ROADMAP.md` Fase 6.

## Cómo funciona

`POST /collections/scan` (rol `COLLECTION_MANAGER`/`SUPER_ADMIN`):

1. Busca créditos `ACTIVE` con cuotas `PENDING`/`PARTIALLY_PAID`/`OVERDUE` vencidas.
2. Calcula los días de atraso reales (`hoy - dueDate`) y marca esas cuotas como `OVERDUE` si
   todavía estaban `PENDING`.
3. Clasifica el caso según umbrales de días (`GRACE_PERIOD` ≤5, `OVERDUE` ≤30,
   `INTENSIVE_COLLECTION` ≤60, `LEGAL_REVIEW` ≤90, `DEFAULTED` >90 — constantes explícitas en
   `collections.service.ts`, no números inventados al vuelo).
4. Solo notifica por email cuando el caso **empeora** respecto del último scan (nunca reenvía el
   mismo aviso en cada corrida — cobranza responsable, master prompt §45).

Es manual por ahora (`POST /collections/scan` bajo demanda). El master prompt (§70) pide que esto
sea un cron job — se deja documentado como próximo paso cuando exista infraestructura de colas
(Redis/BullMQ, todavía no montada en este proyecto). Correrlo dos veces seguidas da el mismo
resultado (idempotente): no duplica casos ni reenvía notificaciones si el estado no cambió.

## Otros endpoints

- `GET /collections/cases` — casos activos (no `CURRENT`), para `COLLECTION_MANAGER`/`RISK_MANAGER`/`SUPER_ADMIN`/`AUDITOR`.
- `POST /collections/cases/:id/action` — registra `CONTACT_ATTEMPT`/`PROMISE_TO_PAY`/`MARK_RECOVERED` en `AuditLog`; `MARK_RECOVERED` cierra el caso.

## Cobranza responsable (master prompt §45)

Este servicio **solo calcula estado**, nunca genera contenido de comunicación agresivo. Las
plantillas de notificación (`@unicreditos/notifications`) son fijas y neutrales — no hay lugar en
el código para redactar un mensaje distinto por caso.

## Probado (real, contra Supabase)

Se simuló un atraso real (se adelantó la fecha de vencimiento de una cuota 10 días hacia atrás, de
forma explícita y documentada — no se inventó un caso de mora en la base) y se corrió el scan:
detectó correctamente `OVERDUE` con `maxDaysOverdue: 10`, marcó la cuota como `OVERDUE`, y un
crédito sin atraso quedó en `CURRENT`. El intento de notificación por email llegó a golpear la API
real de Resend (ver limitación abajo). RBAC probado: un `CUSTOMER` no puede correr el scan (403).

## Limitación conocida: Resend en sandbox

El dominio de envío (`unicreditos.com`) no está verificado en la cuenta de Resend del proyecto —
en ese modo, Resend rechaza (`422`) el envío a cualquier destinatario que no sea la dirección de
prueba de la cuenta. La integración es real (la autenticación funciona, la API responde
correctamente) — falta verificar un dominio en el dashboard de Resend para que los emails salgan
de verdad. `packages/notifications` ahora loguea el rechazo en vez de fallar en silencio.
