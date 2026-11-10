-- Rode no Supabase: SQL Editor, DEPOIS de `npm run db:migrate`.
-- O app acessa o banco pelo Prisma (role postgres, que ignora RLS).
-- Ativar RLS sem políticas bloqueia o acesso público pela API REST/anon key do Supabase.
ALTER TABLE public.trucks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tires             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_trips     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_suppliers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
