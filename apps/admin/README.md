# admin — Backoffice real (Fase 9, en construcción)

Ya no es solo un shell de login: es un backoffice funcional contra los 6 servicios reales
(identity, credit, ledger, collection). Sidebar + router por hash, sin framework — mismo criterio
de simplicidad que el resto del prototipo hasta que haya una razón real para sumar uno.

## Páginas implementadas

- **Dashboard** — fondos de tesorería, desembolsado/cobrado, solicitudes en cola, casos de
  cobranza activos — todo en vivo.
- **Solicitudes** — cola de revisión (aprobar/rechazar) y cola de desembolso, con vista de
  detalle por solicitud (decisiones, cuotas si ya tiene crédito).
- **Créditos** — listado completo + cuotas por crédito.
- **Cobranzas** — casos activos, botón para correr el escaneo de mora, y acciones
  (contacto/promesa de pago/marcar recuperado).
- **Tesorería** — dashboard + reconciliación `Credit.balance` vs. ledger, con las filas que no
  coinciden resaltadas.
- **Auditoría** — lectura de `AuditLog` (append-only, `GET /audit-logs` en `identity`) con filtros
  por recurso/acción, paginación y detalle antes/después por evento. Solo `SUPER_ADMIN`, `CEO`,
  `COMPLIANCE_MANAGER` y `AUDITOR` tienen el rol necesario.

Todo protegido por rol vía los mismos endpoints que ya tenían RBAC (`@Roles(...)`) — un
`CUSTOMER` no ve nada de esto porque `/users/me` no le da acceso a las páginas, y aunque llegara,
cada llamada a la API la rechaza el backend igual (nunca se confía en el frontend).

## Pendiente (backoffice completo, master prompt §48)

Usuarios, Clientes, Inversores (bloqueado por Fase 7), Comercios, Compliance, Fraude, Documentos,
Contratos, Reportes, Notificaciones, Configuración, Sistema. Se suman incrementalmente.

## Correr local

```bash
npm --prefix apps/admin run dev
```

Sirve en `http://localhost:5174`. Requiere `identity` (3100), `credit` (3102), `ledger` (3104) y
`collection` (3105) corriendo, con `WEB_ORIGIN` incluyendo ese origen en sus `.env`.
