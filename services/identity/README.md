# @unicreditos/identity

Registro, login, refresh/logout, RBAC y auditoría. Primer servicio real de la Fase 1
(ver `docs/ROADMAP.md`).

## Qué implementa

- Contraseñas con `argon2id` (nunca sha256 sin salt — ver hallazgo de la auditoría del prototipo).
- Access token JWT de corta vida + refresh token rotativo, hasheado en DB, con **detección de reuso**:
  si un refresh ya rotado se reutiliza, se revoca toda la familia de sesión.
- El servicio **no arranca** si falta `JWT_ACCESS_SECRET` (fail-closed, no fail-open como los
  webhooks del prototipo).
- CORS con allowlist explícita (`WEB_ORIGIN`) — sin fallback abierto.
- RBAC: guard `@Roles(...)` + `RolesGuard`, listo para usarse en los próximos servicios.
- Errores estandarizados `{ code, message, requestId }`, nunca un stack trace al cliente.
- `AuditLog` real en cada registro/login (append-only).
- Rate limiting en memoria sobre `/auth/register` y `/auth/login` (placeholder de un solo proceso;
  se reemplaza por uno respaldado en Redis cuando el servicio corra en más de una instancia).

## Correr local

```bash
cp .env.example .env   # completar JWT_ACCESS_SECRET (ej: openssl rand -hex 48) y DATABASE_URL
npm run build
npm start
```

Endpoints: `GET /health`, `GET /ready`, `POST /auth/register`, `POST /auth/login`,
`POST /auth/refresh`, `POST /auth/logout`, `GET /users/me` (requiere `Authorization: Bearer`).

## Pendiente para cerrar Fase 1 (ver docs/ROADMAP.md)

- MFA (TOTP) para roles de admin.
- Rate limiting respaldado en Redis.
- Tests automatizados (unit + e2e) de los flujos de auth.
