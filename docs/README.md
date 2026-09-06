# UNICRÉDITOS — Documentación técnica

Índice de la "Primera entrega" (análisis antes de código, master prompt §113-120).

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Componentes, diagrama, Payment Engine, ledger, human-in-the-loop, árbol de carpetas |
| [DATABASE.md](./DATABASE.md) | Modelo de datos PostgreSQL/Prisma por dominio, índices y constraints |
| [API.md](./API.md) | Endpoints REST `/api/v1` por módulo, convenciones, códigos de error |
| [SECURITY.md](./SECURITY.md) | Modelo de amenazas, RBAC, gestión de secretos, riesgos regulatorios |
| [ROADMAP.md](./ROADMAP.md) | Plan por fases (1 a 10) con Definition of Done |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Variables de entorno por servicio y por ambiente |

## Estrategia de deployment (resumen)

- **Ambientes**: `development` (local, docker-compose) → `staging` (réplica de producción, datos
  sintéticos) → `production`. Nunca se comparten secretos entre ambientes.
- **Infraestructura objetivo**: Ubuntu 24.04 + Docker + Nginx (TLS) + PostgreSQL administrado +
  Redis + Object Storage S3-compatible. Un contenedor por servicio Nest (o por módulo del monolito
  modular en Fase 1-6) + uno por worker de colas (BullMQ).
- **CI/CD** (GitHub Actions): lint → typecheck → unit tests → integration tests → build → security
  scan (dependencias + SAST) → build de imagen Docker → deploy a staging → smoke tests → aprobación
  manual → deploy a producción. Ningún paso se saltea (`--no-verify` prohibido salvo excepción
  explícita del usuario).
- **Dominios sugeridos**: `unicreditos.com` (público), `app.` (customer), `invest.` (investor, detrás
  de flag), `admin.` (backoffice), `api.` (gateway), `docs.` (Swagger/OpenAPI), `status.` (uptime).
- **Backups**: diarios, cifrados, con verificación de restore periódica; PITR si la infraestructura
  elegida lo soporta.

## Riesgos técnicos (detalle en ARCHITECTURE.md §9 y ROADMAP.md)
1. Monolito modular vs. microservicios — se arranca modular, se separa por necesidad real.
2. Event bus / outbox pattern para no perder eventos financieros si Redis cae.
3. AstroPay sin contrato de API confirmado todavía — adapter listo, apagado hasta credenciales reales.
4. Proveedor de Object Storage y política de retención de biometría/documentos a definir antes de Fase 2.

## Riesgos regulatorios — requieren validación legal, no técnica (detalle en SECURITY.md §1)
1. Habilitación como proveedor de crédito ante BCRA.
2. Módulo de inversores: posible órbita de la CNV si se capta capital de terceros — **apagado por
   defecto** (`ENABLE_INVESTOR_MODULE=false`) hasta resolución legal.
3. Ley de Protección de Datos Personales sobre DNI/ingresos/biometría.
4. Inscripción como Sujeto Obligado ante UIF si corresponde al modelo elegido.
5. Validez de firma electrónica de contratos de crédito.

## Qué falta para pasar a "Fase 1 — construcción"

Este entregable es análisis y esqueleto (`/apps`, `/services`, `/packages`, `/docs`,
`/architecture`, `/database`, `/infrastructure`, `/tests` ya creados con un `README.md` cada uno).
Antes de escribir el monorepo real (Turborepo/pnpm, NestJS, Next.js, Prisma) falta una decisión del
negocio: **qué pasa con el prototipo actual** (`src/`, `server/` en la raíz) — se recomienda
conservarlo como referencia de producto (ya fue auditado, ver hallazgos de seguridad de la
conversación) pero no seguir extendiéndolo, y construir la plataforma nueva en paralelo bajo
`/apps` y `/services`.
