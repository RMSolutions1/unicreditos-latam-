-- NotificationEngine (Fase 6, docs/ROADMAP.md): packages/notifications enviaba emails reales via
-- Resend desde el día uno pero sin dejar rastro persistido. Este log es solo observabilidad de lo
-- que YA pasa, no agrega ningún evento nuevo al catálogo de NotificationEvent.
--
-- Nota de auditoría (2026-09-06): al generar esta migración se detectó drift real entre el
-- historial de migraciones y la DB viva (índices de performance en credit_applications/
-- installments/payment_intents y una columna provider_payload en payment_intents, agregados
-- directo a la DB fuera de Prisma). Se reconcilió schema.prisma contra la DB real vía
-- `prisma migrate diff --from-url ... --to-schema-datamodel ...` -- ese drift ya existe en la DB,
-- así que esta migración NO lo repite acá, solo agrega lo genuinamente nuevo (notification_logs).

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_type_idx" ON "notification_logs"("type");

-- Defensa en profundidad (docs/SECURITY.md §6.1, mismo patrón que el resto del schema): nuestros
-- servicios conectan como postgres y bypassean RLS igual, pero se habilita por si alguna vez se
-- usa la anon key de Supabase desde un cliente.
ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;
