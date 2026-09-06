# admin (shell mínimo)

Login real contra `services/identity` + una vista mínima autenticada que lista los productos de
crédito en vivo desde `services/credit`. Esto **no** es el Admin Backoffice completo de la Fase 9
de `docs/ROADMAP.md` (riesgo, compliance, tesorería, cobranzas) — es el mínimo necesario para
confirmar que login, RBAC y los servicios reales funcionan de punta a punta desde un navegador.
Cuando llegue la Fase 9, este shell se reemplaza por la app Next.js completa.

## Correr local

```bash
npm run dev --workspace @unicreditos/admin-web   # o: npm --prefix apps/admin run dev
```

Sirve en `http://localhost:5174`. Requiere `services/identity` (3100) y `services/credit` (3102)
corriendo, con `WEB_ORIGIN` incluyendo `http://localhost:5174` en sus `.env`.
