# ENVIRONMENT_VARIABLES.md — UNICRÉDITOS

Regla: `production` nunca comparte valores con `development`/`staging`. Ninguna clave real de
producción se guarda en un archivo `.env` dentro del repo — desde `staging` en adelante se inyectan
vía secrets manager del proveedor de hosting/CI. Los `.env.example` de cada app/servicio solo listan
nombres, nunca valores reales.

## Core / plataforma
```
NODE_ENV                      development | staging | production
PORT
API_BASE_URL
WEB_ORIGIN                    allowlist explícita, sin fallback abierto
PUBLIC_SITE_URL
JWT_ACCESS_SECRET
JWT_ACCESS_TTL                 ej. 15m
JWT_REFRESH_SECRET
JWT_REFRESH_TTL                ej. 30d
```

## Base de datos / cache / colas
```
DATABASE_URL                   PostgreSQL
REDIS_URL
QUEUE_PREFIX
```

## Object storage
```
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
OBJECT_STORAGE_REGION
```

## Mercado Pago
```
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_PUBLIC_KEY
MERCADOPAGO_WEBHOOK_SECRET      obligatorio en staging/production (fail-closed si falta)
MERCADOPAGO_NOTIFICATION_URL
```

## AstroPay (preparado, apagado hasta credenciales reales)
```
ASTROPAY_API_KEY
ASTROPAY_SECRET
ASTROPAY_ENVIRONMENT            sandbox | production
ENABLE_ASTROPAY                 false por defecto
```

## Didit (KYC)
```
DIDIT_API_KEY
DIDIT_API_SECRET
DIDIT_WORKFLOW_ID
DIDIT_WEBHOOK_SECRET            obligatorio en staging/production (fail-closed si falta)
```

## ARCA (identidad fiscal)
```
ARCA_API_KEY                    vía secrets manager, nunca en texto plano
ARCA_BASE_URL
```

## BCRA
```
BCRA_BASE_URL
```
(BCRA no requiere API key hoy; documentar si eso cambia.)

## ArgenAPI (validación CBU/CVU/alias)
```
ARGENAPI_API_KEY
ARGENAPI_BASE_URL
ARGENAPI_TIMEOUT_MS
```

## Email / notificaciones
```
RESEND_API_KEY
EMAIL_FROM
SMS_PROVIDER_API_KEY            cuando se integre
WHATSAPP_PROVIDER_API_KEY       cuando se integre
```

## Feature flags
```
ENABLE_INVESTOR_MODULE          false por defecto (ver SECURITY.md §1)
ENABLE_ASTROPAY                 false por defecto
ENABLE_MERCADOPAGO               true
ENABLE_QR                        false hasta validar con Mercado Pago
ENABLE_CASH_PAYMENTS             true (Rapipago/Pago Fácil vía Mercado Pago)
ENABLE_EARLY_SETTLEMENT          true
```

## Observabilidad
```
OTEL_EXPORTER_OTLP_ENDPOINT
LOG_LEVEL
```

## Nota sobre el prototipo actual
El `.env.local` del prototipo (`server/`) contiene claves reales mezcladas con claves de test,
incluida al menos una que aparenta ser de producción (`ARGENAPI_API_KEY` con prefijo `ps_live_`).
Antes de continuar cualquier desarrollo: **rotar esa clave** y no reutilizar ese archivo como base
de configuración de los nuevos servicios — cada servicio define su propio `.env.example` con solo
los nombres que necesita.
