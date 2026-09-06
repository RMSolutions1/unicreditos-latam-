-- Supabase expone automáticamente todas las tablas del schema "public" vía PostgREST a los
-- roles "anon"/"authenticated" (los que usa la anon key, pensada para ser pública en un
-- frontend). Sin RLS, esas tablas quedan legibles/escribibles sin pasar por nuestros
-- servicios NestJS si esa key llegara a filtrarse o a usarse desde un cliente Supabase directo.
--
-- Nuestros servicios se conectan como el rol "postgres" (superusuario), que siempre bypassea
-- RLS -- esta migración no cambia en nada su comportamiento. Es defensa en profundidad
-- específica de Supabase (docs/SECURITY.md §7), detectada por su linter de seguridad.
--
-- No se agregan políticas permisivas: con RLS habilitado y sin policies, el default es
-- denegar todo a los roles de PostgREST, que es exactamente lo que queremos hoy.

-- IF EXISTS: la shadow database que usa "prisma migrate dev" para calcular diffs replay las
-- migraciones sin pasar por el bookkeeping normal de Prisma, así que en ese contexto efímero
-- esta tabla puede no existir todavía. IF EXISTS lo vuelve un no-op ahí sin afectar la base real.
ALTER TABLE IF EXISTS "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kyc_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bank_account_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credit_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."installments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;
