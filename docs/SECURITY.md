# SECURITY.md — UNICRÉDITOS

## 1. Riesgos regulatorios que requieren validación legal (no técnica)

Estos puntos **no se resuelven con código**. Se documentan para que el equipo legal/compliance los
cierre antes de operar con dinero real. Mientras no estén resueltos, los módulos correspondientes
quedan detrás de feature flags apagados.

| Riesgo | Por qué importa | Flag relacionado |
|---|---|---|
| Otorgar crédito al público en Argentina puede requerir inscripción como Proveedor No Financiero de Crédito (BCRA) | Operar sin registro habilitante expone a sanciones y nulidad de operaciones | — (bloqueante para producción real) |
| Captar fondos de "inversores" para prestarlos puede constituir oferta pública/colectiva de valores bajo órbita de la CNV | Distinto régimen legal que un simple préstamo entre partes | `ENABLE_INVESTOR_MODULE=false` por defecto |
| Ley de Protección de Datos Personales (25.326) sobre DNI, ingresos, biometría (selfie KYC) | Define qué se puede guardar, por cuánto tiempo y con qué consentimiento | ver §4 Minimización de datos |
| Inscripción como Sujeto Obligado ante UIF (AML/CFT) si aplica al modelo de negocio elegido | Régimen de reporte de operaciones sospechosas | `services/compliance` |
| Tasas de interés y CFT sujetos a normativa de defensa del consumidor | Un TEM/TNA mal calculado o no informado es un riesgo legal, no solo de producto | `FinancialCalculationService` (fuente de verdad único) |
| Validez de firma electrónica de contratos (Ley 25.506) | Define qué evidencia de aceptación es válida como firma | `ContractService` (hash + evidencia, ver DATABASE.md) |

**Regla operativa**: cualquier feature nueva que toque dinero de terceros o datos sensibles se
implementa, pero se lanza detrás de un flag apagado hasta confirmación legal explícita del negocio.

## 2. Modelo de amenazas — qué NO se repite del prototipo anterior

La auditoría del prototipo (`server/` actual) encontró estos patrones. Quedan prohibidos en la
arquitectura nueva:

1. **Hashing de contraseñas sin salt** (`sha256` plano) → reemplazar por `argon2id` con salt por
   usuario y parámetros de costo documentados en `packages/security`.
2. **Webhooks "fail-open"** (se validaban solo si la env var del secreto estaba seteada) → en la
   nueva arquitectura, si `MERCADOPAGO_WEBHOOK_SECRET`/`DIDIT_WEBHOOK_SECRET`/`ASTROPAY_SECRET` no
   están configurados, el servicio **no arranca** en `production`/`staging` (fail-closed).
3. **Endpoint de validación de CBU sin autenticación** → todo endpoint que consulte identidad de
   terceros (`BankAccountVerificationAdapter`) requiere sesión autenticada y queda auditado.
4. **CORS `origin: true` con `credentials: true`** → allowlist explícita de orígenes por ambiente,
   sin fallback abierto.
5. **Sesiones y tokens de reset sin expiración** → JWT de acceso corto (15 min) + refresh token
   rotativo con expiración e invalidación en logout; tokens de reset de contraseña con TTL (30 min)
   y de un solo uso.
6. **Store en memoria** → PostgreSQL con transacciones ACID para toda operación financiera.

## 3. Autenticación y sesión

- JWT de acceso de vida corta + refresh token rotativo (family detection: reuso de un refresh token
  ya rotado revoca toda la familia).
- MFA: TOTP obligatorio para roles de `admin` (`RISK_MANAGER`, `TREASURY_MANAGER`, `COMPLIANCE_MANAGER`,
  `SUPER_ADMIN`, etc.); TOTP u OTP por email/SMS opcional para clientes.
- Rate limiting por IP + por cuenta en `login`, `register`, `forgot` (backoff exponencial).
- CSRF: no aplica a la API pura con Bearer token; sí aplica si algún flujo usa cookies (ej. sesión
  del admin backoffice) → double-submit token.

## 4. Minimización y cifrado de datos sensibles

- Nunca se loguean: contraseñas, tokens, API keys, datos de tarjeta, CVV, secretos de ningún tipo.
- Resultado crudo de BCRA/ARCA/Didit se guarda cifrado a nivel de aplicación (`rawResultEncrypted`);
  solo el `normalizedResult` mínimo necesario queda en claro para la UI.
- No se guardan imágenes biométricas más tiempo del necesario para la verificación (política de
  retención documentada por producto/regulación, a definir con legal).
- No se almacena número de tarjeta ni CVV en ningún momento — el checkout de tarjeta ocurre
  enteramente en el proveedor (Mercado Pago/AstroPay), UNICRÉDITOS solo recibe el resultado.
- Campos PII (DNI, CUIL, domicilio, teléfono) cifrados en reposo a nivel de columna donde el motor
  de base lo permita razonablemente, con rotación de claves gestionada fuera del repo (secrets
  manager, no `.env` en producción).

## 5. RBAC — roles y separación de funciones

Roles: `SUPER_ADMIN, CEO, CFO, CTO, RISK_MANAGER, COMPLIANCE_MANAGER, TREASURY_MANAGER,
COLLECTION_MANAGER, OPERATIONS_MANAGER, SUPPORT, AUDITOR, ANALYST, MERCHANT_ADMIN, CUSTOMER, INVESTOR`.

Principio: **least privilege** + **segregación de funciones**. Ejemplo concreto que se aplica en
`credit`/`treasury`: quien aprueba una solicitud (`RISK_MANAGER`/`COMPLIANCE_MANAGER`) no es la misma
persona que autoriza el desembolso (`TREASURY_MANAGER`), y ninguna de las dos puede modificar el
resultado de la conciliación de esa misma operación. Esto se modela como una constraint de
aplicación (verificación de `actorId` distinto en pasos consecutivos de un mismo `applicationId`),
no solo como una convención de UI.

`AUDITOR` tiene acceso de solo lectura transversal a `audit`, `ledger`, `compliance` — sin capacidad
de mutar nada.

## 6. Impersonación de admin (si se implementa)

Requiere: motivo escrito, permiso explícito de un rol superior, `AuditLog` con actor real + actor
impersonado, timestamp y duración limitada de la sesión de impersonación. Nunca acceso silencioso.

## 6.1 Row Level Security (Supabase)

Supabase expone automáticamente todas las tablas del schema `public` vía PostgREST a los roles
`anon`/`authenticated` — los que usa la *anon key*, pensada para ser pública en un frontend. Sin
RLS, esas tablas quedan legibles/escribibles sin pasar por nuestros servicios NestJS si esa key
llegara a filtrarse o a usarse desde un cliente Supabase directo en el futuro.

Nuestros servicios se conectan a Postgres como el rol `postgres` (superusuario) vía Prisma —
ese rol siempre bypassea RLS, así que habilitarlo no cambia en nada el comportamiento actual de
`identity`, `kyc` o `credit`. Es defensa en profundidad específica de Supabase, detectada por su
linter de seguridad (`get_advisors`) y corregida en la migración `enable_row_level_security`
(RLS habilitado en las 12 tablas del schema, sin políticas permisivas — el default sin policies
es denegar todo a los roles de PostgREST).

## 7. Seguridad de red y headers

TLS obligatorio en todos los ambientes salvo `localhost` de desarrollo. Headers: `Strict-Transport-
Security`, `Content-Security-Policy` (sin `unsafe-inline` en producción), `X-Content-Type-Options`,
`X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`. Rate limiting a nivel de Nginx además del
aplicativo.

## 8. Gestión de secretos

- Desarrollo local: `.env.local` (ya excluido de git). **Ninguna clave real de producción vive en
  archivos `.env` del repo, ni siquiera local** — usar un secrets manager (Doppler/Vault/1Password
  Secrets Automation/variables de entorno del proveedor de hosting) desde staging en adelante.
- `production` nunca comparte secretos con `development` (ver `docs/ENVIRONMENT_VARIABLES.md`).
- Cualquier secreto que haya circulado en texto plano (chat, commit, log) se considera comprometido
  y se rota, no se "esconde".

## 9. Manejo de errores

Nunca se muestra un stack trace al usuario. Todo error de dominio mapea a un `code` fijo (ver
`docs/API.md` §Reglas de error) + `requestId` para correlacionar con logs estructurados/traces.

## 10. Testing de seguridad mínimo antes de producción

- Pruebas de idempotencia de webhooks (evento duplicado no duplica pago/desembolso).
- Pruebas de que ningún balance puede quedar negativo de forma indebida (ledger).
- Pruebas de RBAC negativas (un rol sin permiso recibe 403, no un error genérico que filtre info).
- Escaneo de dependencias (`npm audit`/`osv-scanner`) en CI antes de build.
- Revisión de seguridad (`/security-review` o equivalente) en cada PR que toque `payment`, `ledger`,
  `identity` o `kyc`.
