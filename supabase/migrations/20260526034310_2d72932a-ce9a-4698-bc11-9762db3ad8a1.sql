ALTER TABLE public.kelly_risk ADD COLUMN IF NOT EXISTS probability numeric;
NOTIFY pgrst, 'reload schema';