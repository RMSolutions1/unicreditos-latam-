# @unicreditos/database

Cliente Prisma compartido para todos los servicios. Esquema Fase 1: identidad, RBAC y auditoría
(ver `docs/DATABASE.md` para el modelo completo objetivo).

## Uso local

```bash
# 1) Levantar Postgres + Redis local (o usar una URL de Neon/Supabase gratuita)
docker compose -f ../../infrastructure/docker-compose.dev.yml up -d

# 2) Configurar la conexión
cp .env.example .env   # completar DATABASE_URL

# 3) Migrar y generar el cliente
npm run migrate:dev
npm run generate

# 4) (opcional) crear un SUPER_ADMIN de prueba
#    completar SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD en .env (mínimo 12 caracteres)
npm run seed
```

`npm run build` compila `src/client.ts` a `dist/` — es lo que consumen los servicios (`@unicreditos/database`
apunta a `dist/client.js`, no al `.ts` fuente).

## Reglas de este esquema

- Dinero: nunca `float`. A partir de la Fase 3 (crédito) todo monto es `NUMERIC` + moneda.
- `AuditLog` es append-only: no tiene `updatedAt`/`deletedAt` y no se expone ningún endpoint de borrado.
- Cambios de esquema van siempre por `prisma migrate dev --name <descripcion>`, nunca editando la base a mano.
