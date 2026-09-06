# customer — Portal real del cliente

Vite + TypeScript sin framework (mismo criterio que `apps/admin`): router por hash, sin build
step más allá de `tsc`+`vite build`. Es el primer frontend que un cliente final de UNICRÉDITOS
puede realmente usar — registro, verificación de identidad, simulación, solicitud de crédito y
pago de cuotas, todo contra los servicios reales.

## Páginas implementadas

**Público** (sin sesión): landing, catálogo de productos con tasas reales, login, registro.

**Cuenta** (autenticado):
- **Inicio** — estado real: perfil incompleto, KYC pendiente, solicitud activa, créditos activos.
- **Mi perfil** — completar teléfono/DNI/CUIL/ingreso (requisito real del backend antes de poder solicitar un crédito).
- **Verificación de identidad** — inicia una sesión real de Didit y muestra el estado real (`PENDING/IN_PROGRESS/APPROVED/REJECTED/EXPIRED`).
- **Solicitar crédito** — elige producto, cotiza con `POST /simulate` (TNA/TEA/CFT reales) y confirma con `POST /credit-applications` — la decisión (automática o revisión manual) es siempre real, nunca simulada acá.
- **Mis solicitudes** — lista + detalle con historial de decisiones y botón de aceptar contrato cuando corresponde.
- **Mis créditos** — lista + cuotas, con botón de pago que crea un `PaymentIntent` real (Mercado Pago o AstroPay) y redirige al checkout del proveedor.

## Pendiente

Refinanciación, pago parcial en la UI (el backend lo soporta pero no se armó la pantalla),
liquidación total en un solo pago (bloqueado en el backend, ver `docs/ROADMAP.md` Fase 6),
comprobante descargable en PDF.

## Correr local

```bash
npm --prefix apps/customer run dev
```

Sirve en `http://localhost:5175`. Requiere `identity` (3100), `kyc` (3101), `credit` (3102) y
`payment` (3103) corriendo, con `WEB_ORIGIN` de cada uno incluyendo ese origen.
