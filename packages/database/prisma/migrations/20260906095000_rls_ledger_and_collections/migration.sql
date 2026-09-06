-- Hallazgo de auditoría: el patrón de RLS de la migración enable_row_level_security
-- (docs/SECURITY.md §6.1) no se repitió para las tablas creadas en las migraciones "ledger" y
-- "collections" -- quedaron sin RLS, expuestas via PostgREST igual que el resto del schema
-- public si la anon key de Supabase se usara alguna vez desde un cliente. Se corrige acá.

ALTER TABLE "public"."ledger_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ledger_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."collection_cases" ENABLE ROW LEVEL SECURITY;
