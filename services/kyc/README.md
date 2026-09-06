# @unicreditos/kyc

Verificación de identidad (Didit), validación de cuenta bancaria (ArgenAPI) y el punto de entrada
para validación fiscal (ARCA, sin credenciales todavía). Ver `docs/ROADMAP.md` Fase 2.

## Qué implementa

- `POST /kyc/sessions` (auth) — crea una sesión real en Didit y la registra como `IN_PROGRESS`.
- `POST /kyc/webhooks/didit` — el estado final del KYC **siempre** viene de acá, nunca de que el
  usuario "vuelva" de la verificación (master prompt §94/109). Firma HMAC verificada fail-closed.
- `POST /kyc/bank-account/validate` (auth) — a diferencia del prototipo auditado, **requiere JWT**:
  el prototipo exponía esta consulta (nombre del titular de un CBU/alias ajeno) sin autenticación.
- `GET /kyc/sessions/latest` (auth) — último estado de KYC del usuario.
- `ArcaAdapter` — interfaz lista, pero `isConfigured()` devuelve `false` y cualquier llamada lanza
  `TAX_PROVIDER_NOT_CONFIGURED`: no hay credenciales de ARCA en este proyecto todavía, y la regla
  del master prompt es explícita — nunca se inventa una respuesta fiscal.

## Correr local

```bash
cp .env.example .env   # completar JWT_ACCESS_SECRET (el mismo que identity), DATABASE_URL,
                        # DIDIT_*, ARGENAPI_*
npm run build
npm start
```

Requiere que `services/identity` esté corriendo (o al menos comparta el mismo `JWT_ACCESS_SECRET`)
para que los tokens emitidos ahí sean válidos acá.
